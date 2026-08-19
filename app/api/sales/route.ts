import { randomUUID } from "node:crypto";
import { getRuntimeEnv } from "../../../db/runtime-env";
import { requireAccess } from "../../../db/authz";
export async function POST(req: Request) {
  const access = await requireAccess(req, "pos", "create");
  if (access.error) return access.error;
  const T = access.user.tenantId,
    B = access.user.branchId;
  const body = (await req.json()) as {
    localId?: string;
    method?: string;
    received?: number;
    customerId?: string;
    items?: { productId: string; quantity: number }[];
    payments?: { method: string; amount: number }[];
    discountPercent?: number;
    discountReason?: string;
  };
  if (!body.localId || !body.items?.length)
    return Response.json({ error: "Venta incompleta" }, { status: 400 });
  const d = getRuntimeEnv().DB,
    user = access.user.id,
    session = await d
      .prepare(
        "SELECT id FROM cash_sessions WHERE tenant_id=? AND user_id=? AND status='open' ORDER BY opened_at DESC LIMIT 1",
      )
      .bind(T, user)
      .first<{ id: string }>();
  if (!session)
    return Response.json(
      { error: "Debe abrir la caja antes de vender", needsCashOpen: true },
      { status: 409 },
    );
  const existing = await d
    .prepare("SELECT id,total FROM sales WHERE tenant_id=? AND local_id=?")
    .bind(T, body.localId)
    .first();
  if (existing) return Response.json({ sale: existing, duplicate: true });
  let subtotal = 0;
  const lines: {
    id: string;
    productId: string;
    quantity: number;
    price: number;
    lineTotal: number;
    balance: number;
  }[] = [];
  for (const item of body.items) {
    const p = await d
      .prepare(
        "SELECT id,price,stock FROM products WHERE id=? AND tenant_id=? AND active=1",
      )
      .bind(item.productId, T)
      .first<{ id: string; price: number; stock: number }>();
    if (!p || item.quantity <= 0)
      return Response.json(
        { error: "Producto o cantidad inválida" },
        { status: 400 },
      );
    if (p.stock < item.quantity)
      return Response.json({ error: "Stock insuficiente" }, { status: 409 });
    const lineTotal = p.price * item.quantity;
    subtotal += lineTotal;
    lines.push({
      id: randomUUID(),
      productId: p.id,
      quantity: item.quantity,
      price: p.price,
      lineTotal,
      balance: p.stock - item.quantity,
    });
  }
  const discountPercent = Math.min(
    100,
    Math.max(0, Number(body.discountPercent || 0)),
  );
  if (discountPercent > 10 && !["owner", "admin"].includes(access.user.role))
    return Response.json(
      {
        error:
          "Los descuentos superiores al 10% requieren autorización administrativa",
        needsAuthorization: true,
      },
      { status: 403 },
    );
  const discount = Math.round((subtotal * discountPercent) / 100),
    total = subtotal - discount,
    payments = body.payments?.length
      ? body.payments
      : [{ method: body.method || "cash", amount: total }],
    paid = payments.reduce((s, p) => s + Number(p.amount), 0);
  if (Math.abs(paid - total) > 1)
    return Response.json(
      { error: "La suma de los pagos debe coincidir con el total" },
      { status: 400 },
    );
  if (payments.some((p) => p.method === "credit") && !body.customerId)
    return Response.json(
      { error: "Seleccione cliente para el pago a crédito" },
      { status: 400 },
    );
  if (body.customerId && payments.some((p) => p.method === "credit")) {
    const credit = payments
        .filter((p) => p.method === "credit")
        .reduce((s, p) => s + p.amount, 0),
      c = await d
        .prepare(
          "SELECT credit_limit creditLimit,credit_days creditDays,COALESCE((SELECT SUM(balance) FROM receivables WHERE customer_id=customers.id),0) currentBalance FROM customers WHERE id=? AND tenant_id=? AND active=1",
        )
        .bind(body.customerId, T)
        .first<{
          creditLimit: number;
          creditDays: number;
          currentBalance: number;
        }>();
    if (!c || c.currentBalance + credit > c.creditLimit)
      return Response.json(
        { error: "El crédito supera el cupo disponible" },
        { status: 409 },
      );
  }
  const saleId = randomUUID(),
    stmts = [
      d
        .prepare(
          "INSERT INTO sales (id,tenant_id,branch_id,user_id,customer_id,local_id,total) VALUES (?,?,?,?,?,?,?)",
        )
        .bind(saleId, T, B, user, body.customerId || null, body.localId, total),
      ...lines.map((l) =>
        d
          .prepare(
            "INSERT INTO sale_lines (id,sale_id,product_id,quantity,unit_price,line_total) VALUES (?,?,?,?,?,?)",
          )
          .bind(l.id, saleId, l.productId, l.quantity, l.price, l.lineTotal),
      ),
      ...payments.map((p) =>
        d
          .prepare(
            "INSERT INTO sale_payments (id,sale_id,method,amount,reference) VALUES (?,?,?,?,?)",
          )
          .bind(
            randomUUID(),
            saleId,
            p.method,
            p.amount,
            p.method === "cash" ? null : `PAY-${Date.now()}`,
          ),
      ),
      ...lines.map((l) =>
        d
          .prepare(
            "UPDATE products SET stock=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?",
          )
          .bind(l.balance, l.productId),
      ),
      ...lines.map((l) =>
        d
          .prepare(
            "INSERT INTO inventory_movements (id,tenant_id,branch_id,product_id,user_id,movement_type,quantity,balance_after,reason,reference) VALUES (?,?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            randomUUID(),
            T,
            B,
            l.productId,
            user,
            "sale",
            -l.quantity,
            l.balance,
            "Venta POS",
            saleId,
          ),
      ),
      d
        .prepare(
          "INSERT INTO sync_events (id,tenant_id,node_id,event_type,entity_id,payload,status) VALUES (?,?,?,?,?,?,?)",
        )
        .bind(
          randomUUID(),
          T,
          body.localId.split("-")[0] || "pos",
          "sale.completed",
          saleId,
          JSON.stringify({ localId: body.localId, total, payments }),
          "applied",
        ),
    ];
  if (discount > 0)
    stmts.push(
      d
        .prepare(
          "INSERT INTO sale_discounts (id,tenant_id,sale_id,user_id,authorized_by,discount_type,value,amount,reason) VALUES (?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          randomUUID(),
          T,
          saleId,
          user,
          ["owner", "admin"].includes(access.user.role) ? user : null,
          "percent",
          discountPercent,
          discount,
          body.discountReason || "Descuento comercial",
        ),
    );
  for (const p of payments) {
    stmts.push(
      d
        .prepare(
          "INSERT INTO cash_movements (id,tenant_id,session_id,user_id,movement_type,amount,reason,reference) VALUES (?,?,?,?,?,?,?,?)",
        )
        .bind(
          randomUUID(),
          T,
          session.id,
          user,
          p.method === "cash"
            ? "sale_cash"
            : p.method === "credit"
              ? "sale_credit"
              : "sale_other",
          p.method === "credit" ? 0 : p.amount,
          `Venta ${p.method}`,
          saleId,
        ),
    );
    if (p.method === "credit" && body.customerId) {
      const days = await d
          .prepare("SELECT credit_days days FROM customers WHERE id=?")
          .bind(body.customerId)
          .first<{ days: number }>(),
        due = new Date(Date.now() + Math.max(0, days?.days || 0) * 86400000)
          .toISOString()
          .slice(0, 10);
      stmts.push(
        d
          .prepare(
            "INSERT INTO receivables (id,tenant_id,customer_id,sale_id,original_amount,balance,due_date,status) VALUES (?,?,?,?,?,?,?,'pending')",
          )
          .bind(
            randomUUID(),
            T,
            body.customerId,
            saleId,
            p.amount,
            p.amount,
            due,
          ),
      );
    }
  }
  await d.batch(stmts);
  return Response.json(
    {
      sale: {
        id: saleId,
        number: `V-${saleId.slice(0, 8).toUpperCase()}`,
        subtotal,
        discount,
        total,
        payments,
        status: "completed",
        syncStatus: "synced",
        change: Math.max(
          0,
          Number(body.received || total) -
            payments
              .filter((p) => p.method === "cash")
              .reduce((s, p) => s + p.amount, 0),
        ),
      },
    },
    { status: 201 },
  );
}
