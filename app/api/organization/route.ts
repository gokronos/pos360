import { randomUUID } from "node:crypto";
import { requireAccess } from "../../../db/authz";
import { getRuntimeEnv } from "../../../db/runtime-env";

export async function GET(req: Request) {
  const access = await requireAccess(req, "settings");
  if (access.error) return access.error;
  const d = getRuntimeEnv().DB,
    T = access.user.tenantId;
  const [branches, warehouses, registers, terminals] = await Promise.all([
    d
      .prepare("SELECT id,name FROM branches WHERE tenant_id=? ORDER BY name")
      .bind(T)
      .all(),
    d
      .prepare(
        "SELECT w.id,w.name,w.code,w.branch_id branchId,b.name branchName,w.active FROM warehouses w JOIN branches b ON b.id=w.branch_id WHERE w.tenant_id=? ORDER BY w.name",
      )
      .bind(T)
      .all(),
    d
      .prepare(
        "SELECT r.id,r.name,r.branch_id branchId,b.name branchName,r.active FROM cash_registers r JOIN branches b ON b.id=r.branch_id WHERE r.tenant_id=? ORDER BY r.name",
      )
      .bind(T)
      .all(),
    d
      .prepare(
        "SELECT t.id,t.name,t.code,t.branch_id branchId,b.name branchName,t.register_id registerId,t.status,t.last_seen_at lastSeenAt FROM terminals t JOIN branches b ON b.id=t.branch_id WHERE t.tenant_id=? ORDER BY t.name",
      )
      .bind(T)
      .all(),
  ]);
  return Response.json({
    branches: branches.results,
    warehouses: warehouses.results,
    registers: registers.results,
    terminals: terminals.results,
  });
}

export async function POST(req: Request) {
  const access = await requireAccess(req, "settings", "create");
  if (access.error) return access.error;
  const p = (await req.json()) as {
    action?: "warehouse" | "register" | "terminal";
    branchId?: string;
    registerId?: string;
    name?: string;
    code?: string;
  };
  if (!p.action || !p.branchId || !p.name)
    return Response.json(
      { error: "Tipo, sede y nombre requeridos" },
      { status: 400 },
    );
  const d = getRuntimeEnv().DB,
    T = access.user.tenantId,
    branch = await d
      .prepare("SELECT id FROM branches WHERE id=? AND tenant_id=?")
      .bind(p.branchId, T)
      .first();
  if (!branch)
    return Response.json(
      { error: "La sede no pertenece a la empresa activa" },
      { status: 403 },
    );
  const id = randomUUID();
  if (p.action === "warehouse") {
    if (!p.code)
      return Response.json(
        { error: "Código de bodega requerido" },
        { status: 400 },
      );
    await d
      .prepare(
        "INSERT INTO warehouses (id,tenant_id,branch_id,name,code,active) VALUES (?,?,?,?,?,1)",
      )
      .bind(id, T, p.branchId, p.name, p.code)
      .run();
  } else if (p.action === "register") {
    await d
      .prepare(
        "INSERT INTO cash_registers (id,tenant_id,branch_id,name,active) VALUES (?,?,?,?,1)",
      )
      .bind(id, T, p.branchId, p.name)
      .run();
  } else {
    if (!p.code)
      return Response.json(
        { error: "Código de terminal requerido" },
        { status: 400 },
      );
    if (p.registerId) {
      const register = await d
        .prepare(
          "SELECT id FROM cash_registers WHERE id=? AND tenant_id=? AND branch_id=?",
        )
        .bind(p.registerId, T, p.branchId)
        .first();
      if (!register)
        return Response.json(
          { error: "La caja no pertenece a esta sede" },
          { status: 403 },
        );
    }
    await d.batch([
      d
        .prepare(
          "INSERT INTO terminals (id,tenant_id,branch_id,register_id,name,code,status) VALUES (?,?,?,?,?,?,'active')",
        )
        .bind(id, T, p.branchId, p.registerId || null, p.name, p.code),
      d
        .prepare(
          "INSERT OR IGNORE INTO terminal_user_access (id,tenant_id,terminal_id,user_id,active,granted_by) SELECT lower(hex(randomblob(16))),?,?,u.id,1,? FROM app_users u JOIN user_branch_access a ON a.user_id=u.id AND a.branch_id=? WHERE u.tenant_id=? AND u.active=1",
        )
        .bind(T, id, access.user.id, p.branchId, T),
    ]);
  }
  await d
    .prepare(
      "INSERT INTO audit_logs (id,tenant_id,user_id,action,entity_type,entity_id,details) VALUES (?,?,?,?,?,?,?)",
    )
    .bind(
      randomUUID(),
      T,
      access.user.id,
      "create",
      p.action,
      id,
      `${p.name} creado`,
    )
    .run();
  return Response.json({ id }, { status: 201 });
}
