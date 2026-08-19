import { randomUUID } from "node:crypto";
import { getRuntimeEnv } from "../../../db/runtime-env";
import { requireAccess } from "../../../db/authz";
export async function GET(req: Request) {
  const access = await requireAccess(req, "pos");
  if (access.error) return access.error;
  const d = getRuntimeEnv().DB,
    user = access.user.id,
    T = access.user.tenantId;
  const session = await d
    .prepare(
      "SELECT s.id,s.opening_amount openingAmount,s.status,s.opened_at openedAt,r.name registerName,COALESCE((SELECT SUM(amount) FROM cash_movements WHERE session_id=s.id),0) movements FROM cash_sessions s JOIN cash_registers r ON r.id=s.register_id WHERE s.tenant_id=? AND s.user_id=? AND s.status='open' ORDER BY s.opened_at DESC LIMIT 1",
    )
    .bind(T, user)
    .first();
  return Response.json({ session });
}
export async function POST(req: Request) {
  const access = await requireAccess(req, "pos", "create");
  if (access.error) return access.error;
  const p = (await req.json()) as {
      action?: "open" | "close";
      amount?: number;
    },
    d = getRuntimeEnv().DB,
    user = access.user.id,
    T = access.user.tenantId;
  const register = await d
    .prepare(
      "SELECT id,name FROM cash_registers WHERE tenant_id=? AND branch_id=? AND active=1 ORDER BY name LIMIT 1",
    )
    .bind(T, access.user.branchId)
    .first<{ id: string; name: string }>();
  if (!register)
    return Response.json(
      { error: "Configure una caja activa para esta sede" },
      { status: 409 },
    );
  if (p.action === "open") {
    const current = await d
      .prepare(
        "SELECT id FROM cash_sessions WHERE tenant_id=? AND user_id=? AND status='open'",
      )
      .bind(T, user)
      .first();
    if (current)
      return Response.json(
        { error: "Ya existe una caja abierta" },
        { status: 409 },
      );
    const id = randomUUID(),
      amount = Number(p.amount || 0);
    await d.batch([
      d
        .prepare(
          "INSERT INTO cash_sessions (id,tenant_id,register_id,user_id,opening_amount,status) VALUES (?,?,?,?,?,'open')",
        )
        .bind(id, T, register.id, user, amount),
      d
        .prepare(
          "INSERT INTO cash_movements (id,tenant_id,session_id,user_id,movement_type,amount,reason,reference) VALUES (?,?,?,?,?,?,?,?)",
        )
        .bind(
          randomUUID(),
          T,
          id,
          user,
          "opening",
          amount,
          "Base inicial",
          `AP-${Date.now()}`,
        ),
    ]);
    return Response.json(
      {
        session: {
          id,
          openingAmount: amount,
          status: "open",
          registerName: register.name,
        },
      },
      { status: 201 },
    );
  }
  if (p.action === "close") {
    const s = await d
      .prepare(
        "SELECT id,opening_amount FROM cash_sessions WHERE tenant_id=? AND user_id=? AND status='open'",
      )
      .bind(T, user)
      .first<{ id: string; opening_amount: number }>();
    if (!s)
      return Response.json({ error: "No hay caja abierta" }, { status: 404 });
    const totals = await d
        .prepare(
          "SELECT COALESCE(SUM(amount),0) total FROM cash_movements WHERE session_id=?",
        )
        .bind(s.id)
        .first<{ total: number }>(),
      declared = Number(p.amount || 0);
    await d
      .prepare(
        "UPDATE cash_sessions SET status='closed',closing_amount=?,expected_amount=?,closed_at=CURRENT_TIMESTAMP WHERE id=?",
      )
      .bind(declared, totals?.total || 0, s.id)
      .run();
    return Response.json({
      closed: true,
      declared,
      expected: totals?.total || 0,
      difference: declared - (totals?.total || 0),
    });
  }
  return Response.json({ error: "Acción inválida" }, { status: 400 });
}
