import { randomUUID } from "node:crypto";
import { getRuntimeEnv } from "../../../db/runtime-env";
import { requireAccess } from "../../../db/authz";
export async function GET(req: Request) {
  const access = await requireAccess(req, "customers");
  if (access.error) return access.error;
  const d = getRuntimeEnv().DB,
    q = `%${new URL(req.url).searchParams.get("q") || ""}%`;
  const rows = await d
    .prepare(
      "SELECT c.id,c.document_type documentType,c.document_number documentNumber,c.name,c.phone,c.email,c.credit_limit creditLimit,c.credit_days creditDays,c.active,COALESCE(SUM(r.balance),0) balance,COALESCE(SUM(CASE WHEN r.balance>0 AND r.due_date<date('now') THEN r.balance ELSE 0 END),0) overdue FROM customers c LEFT JOIN receivables r ON r.customer_id=c.id WHERE c.tenant_id=? AND (c.name LIKE ? OR c.document_number LIKE ? OR c.phone LIKE ?) GROUP BY c.id ORDER BY c.active DESC,c.name LIMIT 200",
    )
    .bind(access.user.tenantId, q, q, q)
    .all();
  return Response.json({ customers: rows.results });
}
export async function POST(req: Request) {
  const access = await requireAccess(req, "customers", "create");
  if (access.error) return access.error;
  const p = (await req.json()) as {
    documentType?: string;
    documentNumber?: string;
    name?: string;
    phone?: string;
    email?: string;
    creditLimit?: number;
    creditDays?: number;
  };
  if (!p.documentNumber?.trim() || !p.name?.trim())
    return Response.json(
      { error: "Documento y nombre son obligatorios" },
      { status: 400 },
    );
  try {
    const d = getRuntimeEnv().DB,
      id = randomUUID();
    await d
      .prepare(
        "INSERT INTO customers (id,tenant_id,document_type,document_number,name,phone,email,credit_limit,credit_days) VALUES (?,?,?,?,?,?,?,?,?)",
      )
      .bind(
        id,
        access.user.tenantId,
        p.documentType || "CC",
        p.documentNumber.trim(),
        p.name.trim(),
        p.phone?.trim() || null,
        p.email?.trim() || null,
        Number(p.creditLimit || 0),
        Number(p.creditDays || 0),
      )
      .run();
    return Response.json(
      { customer: { id, ...p, balance: 0, overdue: 0, active: 1 } },
      { status: 201 },
    );
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof Error && e.message.includes("UNIQUE")
            ? "Ya existe un cliente con ese documento"
            : "No fue posible guardar el cliente",
      },
      { status: 409 },
    );
  }
}
export async function PATCH(req: Request) {
  const access = await requireAccess(req, "customers", "edit");
  if (access.error) return access.error;
  const p = (await req.json()) as {
    id?: string;
    amount?: number;
    method?: string;
    receivableId?: string;
  };
  if (!p.id || Number(p.amount) <= 0)
    return Response.json(
      { error: "Cliente y valor son obligatorios" },
      { status: 400 },
    );
  const d = getRuntimeEnv().DB,
    amount = Number(p.amount),
    open = await d
      .prepare(
        "SELECT id,balance FROM receivables WHERE tenant_id=? AND customer_id=? AND balance>0 ORDER BY due_date,created_at LIMIT 1",
      )
      .bind(access.user.tenantId, p.id)
      .first<{ id: string; balance: number }>();
  if (!open)
    return Response.json(
      { error: "El cliente no tiene cartera pendiente" },
      { status: 409 },
    );
  const applied = Math.min(amount, open.balance),
    remaining = open.balance - applied,
    paymentId = randomUUID();
  await d.batch([
    d
      .prepare(
        "INSERT INTO customer_payments (id,tenant_id,customer_id,receivable_id,user_id,amount,method,reference) VALUES (?,?,?,?,?,?,?,?)",
      )
      .bind(
        paymentId,
        access.user.tenantId,
        p.id,
        open.id,
        access.user.id,
        applied,
        p.method || "cash",
        `AB-${Date.now()}`,
      ),
    d
      .prepare("UPDATE receivables SET balance=?,status=? WHERE id=?")
      .bind(remaining, remaining <= 0 ? "paid" : "partial", open.id),
  ]);
  return Response.json({
    payment: { id: paymentId, amount: applied, remaining },
  });
}
