import { randomUUID } from "node:crypto";
import { getRuntimeEnv } from "../../../db/runtime-env";
import { roleModules, roles } from "../../../db/authz";

const emailOf = (r: Request) =>
  r.headers.get("oai-authenticated-user-email") || "preview@pos360.local";
const nameOf = (r: Request) => {
  const raw = r.headers.get("oai-authenticated-user-full-name");
  try {
    return raw ? decodeURIComponent(raw) : "Administrador POS360";
  } catch {
    return "Administrador POS360";
  }
};
async function actor(req: Request, tenantId: string) {
  return getRuntimeEnv()
    .DB.prepare(
      "SELECT id,role,active FROM app_users WHERE tenant_id=? AND email=?",
    )
    .bind(tenantId, emailOf(req))
    .first<{ id: string; role: string; active: number }>();
}
async function authorized(req: Request, tenantId: string) {
  const a = await actor(req, tenantId);
  return a && a.active && ["owner", "admin"].includes(a.role) ? a : null;
}
async function audit(
  tenantId: string,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  details: string,
) {
  return getRuntimeEnv()
    .DB.prepare(
      "INSERT INTO audit_logs (id,tenant_id,user_id,action,entity_type,entity_id,details) VALUES (?,?,?,?,?,?,?)",
    )
    .bind(
      randomUUID(),
      tenantId,
      userId,
      action,
      entityType,
      entityId,
      details,
    );
}

export async function GET(req: Request) {
  const d = getRuntimeEnv().DB,
    email = emailOf(req),
    url = new URL(req.url),
    requested = url.searchParams.get("tenantId");
  const companies = await d
    .prepare(
      "SELECT t.id,t.name,t.country,t.status,u.role,(SELECT COUNT(*) FROM branches b WHERE b.tenant_id=t.id) branchCount,(SELECT COUNT(*) FROM app_users x WHERE x.tenant_id=t.id AND x.active=1) userCount FROM app_users u JOIN tenants t ON t.id=u.tenant_id WHERE u.email=? ORDER BY t.name",
    )
    .bind(email)
    .all();
  const available = (companies.results || []) as { id: string }[],
    tenantId =
      requested && available.some((x) => x.id === requested)
        ? requested
        : available[0]?.id;
  if (!tenantId)
    return Response.json(
      { error: "No tiene acceso a esta empresa" },
      { status: 403 },
    );
  const a = await actor(req, tenantId);
  if (!a)
    return Response.json(
      { error: "No tiene acceso a esta empresa" },
      { status: 403 },
    );
  const [branches, users, permissions, logs] = await Promise.all([
    d
      .prepare(
        "SELECT id,name,created_at createdAt FROM branches WHERE tenant_id=? ORDER BY name",
      )
      .bind(tenantId)
      .all(),
    d
      .prepare(
        "SELECT id,email,display_name displayName,role,active,created_at createdAt,(SELECT GROUP_CONCAT(b.name,', ') FROM user_branch_access uba JOIN branches b ON b.id=uba.branch_id WHERE uba.user_id=u.id) branches,(SELECT GROUP_CONCAT(uba.branch_id,',') FROM user_branch_access uba WHERE uba.user_id=u.id) branchIds FROM app_users u WHERE tenant_id=? ORDER BY active DESC,display_name",
      )
      .bind(tenantId)
      .all(),
    d
      .prepare(
        "SELECT role,module,can_view canView,can_create canCreate,can_edit canEdit,can_delete canDelete FROM role_permissions WHERE tenant_id=? ORDER BY role,module",
      )
      .bind(tenantId)
      .all(),
    d
      .prepare(
        "SELECT l.action,l.entity_type entityType,l.details,l.created_at createdAt,COALESCE(u.display_name,'Sistema') userName FROM audit_logs l LEFT JOIN app_users u ON u.id=l.user_id WHERE l.tenant_id=? ORDER BY l.created_at DESC LIMIT 20",
      )
      .bind(tenantId)
      .all(),
  ]);
  return Response.json({
    companies: companies.results,
    tenantId,
    currentUser: a,
    branches: branches.results,
    users: users.results,
    permissions: permissions.results,
    logs: logs.results,
    roleModules,
  });
}

export async function POST(req: Request) {
  const d = getRuntimeEnv().DB,
    p = (await req.json()) as {
      action?: "company" | "branch" | "user";
      tenantId?: string;
      name?: string;
      country?: string;
      email?: string;
      displayName?: string;
      role?: string;
      branchId?: string;
    };
  if (p.action === "company") {
    if (!p.name)
      return Response.json(
        { error: "Ingrese el nombre de la empresa" },
        { status: 400 },
      );
    const tenantId = randomUUID(),
      branchId = randomUUID(),
      userId = randomUUID(),
      email = emailOf(req),
      name = nameOf(req);
    const stmts = [
      d
        .prepare(
          "INSERT INTO tenants (id,name,country,status) VALUES (?,?,?,'active')",
        )
        .bind(tenantId, p.name, p.country || "CO"),
      d
        .prepare("INSERT INTO branches (id,tenant_id,name) VALUES (?,?,?)")
        .bind(branchId, tenantId, "Sede Principal"),
      d
        .prepare(
          "INSERT INTO app_users (id,tenant_id,email,display_name,role,active) VALUES (?,?,?,?,?,1)",
        )
        .bind(userId, tenantId, email, name, "owner"),
      d
        .prepare(
          "INSERT INTO user_branch_access (id,tenant_id,user_id,branch_id) VALUES (?,?,?,?)",
        )
        .bind(randomUUID(), tenantId, userId, branchId),
      d
        .prepare(
          "INSERT INTO business_settings (id,tenant_id,main_branch_id,onboarding_completed) VALUES (?,?,?,0)",
        )
        .bind(randomUUID(), tenantId, branchId),
    ];
    for (const [role, modules] of Object.entries(roleModules))
      for (const moduleName of modules)
        stmts.push(
          d
            .prepare(
              "INSERT INTO role_permissions (id,tenant_id,role,module,can_view,can_create,can_edit,can_delete) VALUES (?,?,?,?,?,?,?,?)",
            )
            .bind(
              randomUUID(),
              tenantId,
              role,
              moduleName,
              1,
              ["owner", "admin"].includes(role) ||
                ["cashier", "warehouse"].includes(role)
                ? 1
                : 0,
              ["owner", "admin"].includes(role) ? 1 : 0,
              role === "owner" ? 1 : 0,
            ),
        );
    stmts.push(
      await audit(
        tenantId,
        userId,
        "create",
        "tenant",
        tenantId,
        `Empresa ${p.name} creada`,
      ),
    );
    await d.batch(stmts);
    return Response.json({ tenantId }, { status: 201 });
  }
  if (!p.tenantId)
    return Response.json({ error: "Empresa requerida" }, { status: 400 });
  const a = await authorized(req, p.tenantId);
  if (!a)
    return Response.json(
      {
        error:
          "Solo propietarios y administradores pueden realizar esta acción",
      },
      { status: 403 },
    );
  if (p.action === "branch") {
    if (!p.name)
      return Response.json(
        { error: "Ingrese el nombre de la sede" },
        { status: 400 },
      );
    const id = randomUUID();
    await d.batch([
      d
        .prepare("INSERT INTO branches (id,tenant_id,name) VALUES (?,?,?)")
        .bind(id, p.tenantId, p.name),
      await audit(
        p.tenantId,
        a.id,
        "create",
        "branch",
        id,
        `Sede ${p.name} creada`,
      ),
    ]);
    return Response.json({ id }, { status: 201 });
  }
  if (p.action === "user") {
    if (
      !p.email ||
      !p.displayName ||
      !p.role ||
      !roles.includes(p.role as (typeof roles)[number])
    )
      return Response.json(
        { error: "Complete los datos del usuario" },
        { status: 400 },
      );
    if (p.branchId) {
      const branch = await d
        .prepare("SELECT id FROM branches WHERE id=? AND tenant_id=?")
        .bind(p.branchId, p.tenantId)
        .first();
      if (!branch)
        return Response.json(
          { error: "La sede no pertenece a esta empresa" },
          { status: 403 },
        );
    }
    const id = randomUUID();
    try {
      const stmts = [
        d
          .prepare(
            "INSERT INTO app_users (id,tenant_id,email,display_name,role,active) VALUES (?,?,?,?,?,1)",
          )
          .bind(id, p.tenantId, p.email.toLowerCase(), p.displayName, p.role),
      ];
      if (p.branchId)
        stmts.push(
          d
            .prepare(
              "INSERT INTO user_branch_access (id,tenant_id,user_id,branch_id) VALUES (?,?,?,?)",
            )
            .bind(randomUUID(), p.tenantId, id, p.branchId),
        );
      stmts.push(
        await audit(
          p.tenantId,
          a.id,
          "create",
          "user",
          id,
          `Usuario ${p.displayName} creado como ${p.role}`,
        ),
      );
      await d.batch(stmts);
      return Response.json({ id }, { status: 201 });
    } catch {
      return Response.json(
        { error: "El correo ya está registrado en esta empresa" },
        { status: 409 },
      );
    }
  }
  return Response.json({ error: "Acción inválida" }, { status: 400 });
}

export async function PATCH(req: Request) {
  const d = getRuntimeEnv().DB,
    p = (await req.json()) as {
      action?: "user" | "permission";
      tenantId?: string;
      userId?: string;
      role?: string;
      module?: string;
      permission?: "view" | "create" | "edit" | "delete";
      value?: boolean;
      active?: boolean;
      branchId?: string | null;
    };
  if (!p.tenantId)
    return Response.json({ error: "Datos incompletos" }, { status: 400 });
  const a = await authorized(req, p.tenantId);
  if (!a) return Response.json({ error: "No autorizado" }, { status: 403 });
  if (p.action === "permission") {
    if (
      !p.role ||
      !p.module ||
      !p.permission ||
      !roles.includes(p.role as (typeof roles)[number])
    )
      return Response.json({ error: "Permiso incompleto" }, { status: 400 });
    const column = {
      view: "can_view",
      create: "can_create",
      edit: "can_edit",
      delete: "can_delete",
    }[p.permission];
    const values = { view: 0, create: 0, edit: 0, delete: 0 };
    values[p.permission] = Number(Boolean(p.value));
    await d.batch([
      d
        .prepare(
          `INSERT INTO role_permissions (id,tenant_id,role,module,can_view,can_create,can_edit,can_delete) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id,role,module) DO UPDATE SET ${column}=?`,
        )
        .bind(
          randomUUID(),
          p.tenantId,
          p.role,
          p.module,
          values.view,
          values.create,
          values.edit,
          values.delete,
          Number(Boolean(p.value)),
        ),
      await audit(
        p.tenantId,
        a.id,
        "update",
        "role_permission",
        `${p.role}:${p.module}`,
        `${p.permission}=${Boolean(p.value)}`,
      ),
    ]);
    return Response.json({ updated: true });
  }
  if (!p.userId)
    return Response.json({ error: "Usuario requerido" }, { status: 400 });
  const target = await d
    .prepare(
      "SELECT role,display_name displayName FROM app_users WHERE id=? AND tenant_id=?",
    )
    .bind(p.userId, p.tenantId)
    .first<{ role: string; displayName: string }>();
  if (!target)
    return Response.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (target.role === "owner" && a.id !== p.userId)
    return Response.json(
      { error: "El propietario no puede ser modificado por otro usuario" },
      { status: 403 },
    );
  if (p.role && !roles.includes(p.role as (typeof roles)[number]))
    return Response.json({ error: "Rol inválido" }, { status: 400 });
  if (p.branchId) {
    const branch = await d
      .prepare("SELECT id FROM branches WHERE id=? AND tenant_id=?")
      .bind(p.branchId, p.tenantId)
      .first();
    if (!branch)
      return Response.json(
        { error: "La sede no pertenece a esta empresa" },
        { status: 403 },
      );
  }
  const stmts = [
    d
      .prepare(
        "UPDATE app_users SET role=COALESCE(?,role),active=COALESCE(?,active) WHERE id=? AND tenant_id=?",
      )
      .bind(
        p.role || null,
        p.active === undefined ? null : Number(p.active),
        p.userId,
        p.tenantId,
      ),
    await audit(
      p.tenantId,
      a.id,
      "update",
      "user",
      p.userId,
      `Permisos actualizados para ${target.displayName}`,
    ),
  ];
  if (p.branchId !== undefined) {
    stmts.push(
      d
        .prepare("DELETE FROM user_branch_access WHERE user_id=?")
        .bind(p.userId),
    );
    if (p.branchId)
      stmts.push(
        d
          .prepare(
            "INSERT INTO user_branch_access (id,tenant_id,user_id,branch_id) VALUES (?,?,?,?)",
          )
          .bind(randomUUID(), p.tenantId, p.userId, p.branchId),
      );
  }
  await d.batch(stmts);
  return Response.json({ updated: true });
}
