import { randomUUID } from "node:crypto";
import { getRuntimeEnv } from "../../../db/runtime-env";
import { requireAccess } from "../../../db/authz";
export async function GET(req: Request) {
  const access = await requireAccess(req, "purchases");
  if (access.error) return access.error;
  const T = access.user.tenantId,
    d = getRuntimeEnv().DB,
    orders = await d
      .prepare(
        "SELECT o.id,o.number,o.status,o.total,o.created_at createdAt,s.name supplierName,s.id supplierId,COALESCE((SELECT balance FROM payables WHERE order_id=o.id),0) balance,COALESCE((SELECT due_date FROM payables WHERE order_id=o.id),'') dueDate,(SELECT COUNT(*) FROM purchase_receipts WHERE order_id=o.id) receiptCount FROM purchase_orders o JOIN suppliers s ON s.id=o.supplier_id WHERE o.tenant_id=? ORDER BY o.created_at DESC LIMIT 100",
      )
      .bind(T)
      .all();
  return Response.json({ orders: orders.results });
}
export async function POST(req: Request) {
  const access = await requireAccess(req, "purchases", "create");
  if (access.error) return access.error;
  const p = (await req.json()) as {
    supplierId?: string;
    notes?: string;
    lines?: { productId: string; quantity: number; unitCost: number }[];
  };
  if (!p.supplierId || !p.lines?.length)
    return Response.json(
      { error: "Seleccione proveedor y productos" },
      { status: 400 },
    );
  if (p.lines.some((l) => Number(l.quantity) <= 0 || Number(l.unitCost) < 0))
    return Response.json(
      { error: "Revise cantidades y costos" },
      { status: 400 },
    );
  const T = access.user.tenantId,
    B = access.user.branchId,
    d = getRuntimeEnv().DB;
  const supplier = await d
    .prepare("SELECT id FROM suppliers WHERE id=? AND tenant_id=?")
    .bind(p.supplierId, T)
    .first();
  const products = await Promise.all(
    p.lines.map((line) =>
      d
        .prepare("SELECT id FROM products WHERE id=? AND tenant_id=?")
        .bind(line.productId, T)
        .first(),
    ),
  );
  if (!supplier || products.some((product) => !product))
    return Response.json(
      { error: "Proveedor o producto ajeno a la empresa activa" },
      { status: 403 },
    );
  const id = randomUUID(),
    number = `OC-${Date.now().toString().slice(-7)}`,
    total = p.lines.reduce(
      (s, l) => s + Number(l.quantity) * Number(l.unitCost),
      0,
    );
  await d.batch([
    d
      .prepare(
        "INSERT INTO purchase_orders (id,tenant_id,branch_id,supplier_id,user_id,number,status,total,notes) VALUES (?,?,?,?,?,?,'ordered',?,?)",
      )
      .bind(
        id,
        T,
        B,
        p.supplierId,
        access.user.id,
        number,
        total,
        p.notes || null,
      ),
    ...p.lines.map((l) =>
      d
        .prepare(
          "INSERT INTO purchase_order_lines (id,order_id,product_id,quantity,received_quantity,unit_cost,line_total) VALUES (?,?,?,?,0,?,?)",
        )
        .bind(
          randomUUID(),
          id,
          l.productId,
          Number(l.quantity),
          Number(l.unitCost),
          Number(l.quantity) * Number(l.unitCost),
        ),
    ),
  ]);
  return Response.json(
    { order: { id, number, total, status: "ordered" } },
    { status: 201 },
  );
}
export async function PATCH(req: Request) {
  const access = await requireAccess(req, "purchases", "edit");
  if (access.error) return access.error;
  const p = (await req.json()) as {
    action?: "receive" | "pay" | "return";
    orderId?: string;
    amount?: number;
    method?: string;
    percent?: number;
    quantity?: number;
    productId?: string;
    reason?: string;
  };
  if (!p.orderId)
    return Response.json({ error: "Orden requerida" }, { status: 400 });
  const T = access.user.tenantId,
    d = getRuntimeEnv().DB,
    order = await d
      .prepare(
        "SELECT o.*,s.payment_days paymentDays FROM purchase_orders o JOIN suppliers s ON s.id=o.supplier_id WHERE o.id=? AND o.tenant_id=?",
      )
      .bind(p.orderId, T)
      .first<{
        id: string;
        supplier_id: string;
        total: number;
        status: string;
        paymentDays: number;
      }>();
  if (!order)
    return Response.json({ error: "Orden no encontrada" }, { status: 404 });
  if (p.action === "receive") {
    if (order.status === "received")
      return Response.json(
        { error: "La orden ya fue recibida" },
        { status: 409 },
      );
    const percent = Math.min(100, Math.max(1, Number(p.percent || 100))) / 100;
    const lines = await d
        .prepare(
          "SELECT l.*,p.stock currentStock FROM purchase_order_lines l JOIN products p ON p.id=l.product_id WHERE l.order_id=?",
        )
        .bind(order.id)
        .all<{
          id: string;
          product_id: string;
          quantity: number;
          received_quantity: number;
          unit_cost: number;
          currentStock: number;
        }>(),
      pending = (lines.results || []).filter(
        (l) => l.quantity > l.received_quantity,
      );
    if (!pending.length)
      return Response.json(
        { error: "No hay mercancía pendiente" },
        { status: 409 },
      );
    const receipt = randomUUID(),
      ref = `REC-${Date.now()}`;
    let receiptTotal = 0,
      complete = true;
    const stmts = [];
    for (const l of pending) {
      const remaining = l.quantity - l.received_quantity,
        qty =
          percent >= 1
            ? remaining
            : Math.min(
                remaining,
                Math.max(0.01, Math.round(remaining * percent * 100) / 100),
              ),
        newReceived = l.received_quantity + qty,
        balance = l.currentStock + qty;
      receiptTotal += qty * l.unit_cost;
      if (newReceived < l.quantity) complete = false;
      stmts.push(
        d
          .prepare(
            "UPDATE purchase_order_lines SET received_quantity=? WHERE id=?",
          )
          .bind(newReceived, l.id),
        d
          .prepare(
            "UPDATE products SET stock=?,cost=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?",
          )
          .bind(balance, l.unit_cost, l.product_id),
        d
          .prepare(
            "INSERT INTO inventory_movements (id,tenant_id,branch_id,product_id,user_id,movement_type,quantity,balance_after,reason,reference) VALUES (?,?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            randomUUID(),
            T,
            B,
            l.product_id,
            access.user.id,
            "purchase",
            qty,
            balance,
            "Recepción de compra",
            ref,
          ),
        d
          .prepare(
            "INSERT INTO purchase_receipt_lines (id,receipt_id,order_line_id,product_id,quantity,unit_cost,line_total) VALUES (?,?,?,?,?,?,?)",
          )
          .bind(
            randomUUID(),
            receipt,
            l.id,
            l.product_id,
            qty,
            l.unit_cost,
            qty * l.unit_cost,
          ),
      );
    }
    stmts.unshift(
      d
        .prepare(
          "INSERT INTO purchase_receipts (id,tenant_id,order_id,user_id,reference,total) VALUES (?,?,?,?,?,?)",
        )
        .bind(receipt, T, order.id, access.user.id, ref, receiptTotal),
    );
    stmts.push(
      d
        .prepare("UPDATE purchase_orders SET status=? WHERE id=?")
        .bind(complete ? "received" : "partial", order.id),
    );
    const payable = await d
        .prepare("SELECT id FROM payables WHERE order_id=?")
        .bind(order.id)
        .first<{ id: string }>(),
      due = new Date(
        Date.now() + Math.max(0, order.paymentDays || 0) * 86400000,
      )
        .toISOString()
        .slice(0, 10);
    if (payable)
      stmts.push(
        d
          .prepare(
            "UPDATE payables SET original_amount=original_amount+?,balance=balance+?,status='pending' WHERE id=?",
          )
          .bind(receiptTotal, receiptTotal, payable.id),
      );
    else
      stmts.push(
        d
          .prepare(
            "INSERT INTO payables (id,tenant_id,supplier_id,order_id,original_amount,balance,due_date,status) VALUES (?,?,?,?,?,?,?,'pending')",
          )
          .bind(
            randomUUID(),
            T,
            order.supplier_id,
            order.id,
            receiptTotal,
            receiptTotal,
            due,
          ),
      );
    await d.batch(stmts);
    return Response.json({
      received: true,
      reference: ref,
      total: receiptTotal,
      status: complete ? "received" : "partial",
    });
  }
  if (p.action === "pay") {
    const payable = await d
      .prepare(
        "SELECT id,supplier_id,balance FROM payables WHERE order_id=? AND balance>0",
      )
      .bind(order.id)
      .first<{ id: string; supplier_id: string; balance: number }>();
    if (!payable)
      return Response.json(
        { error: "La orden no tiene saldo pendiente" },
        { status: 409 },
      );
    const amount = Math.min(Number(p.amount || 0), payable.balance),
      remaining = payable.balance - amount;
    if (amount <= 0)
      return Response.json(
        { error: "Ingrese un valor válido" },
        { status: 400 },
      );
    await d.batch([
      d
        .prepare(
          "INSERT INTO supplier_payments (id,tenant_id,supplier_id,payable_id,user_id,amount,method,reference) VALUES (?,?,?,?,?,?,?,?)",
        )
        .bind(
          randomUUID(),
          T,
          payable.supplier_id,
          payable.id,
          access.user.id,
          amount,
          p.method || "transfer",
          `PAG-${Date.now()}`,
        ),
      d
        .prepare("UPDATE payables SET balance=?,status=? WHERE id=?")
        .bind(remaining, remaining <= 0 ? "paid" : "partial", payable.id),
    ]);
    return Response.json({ paid: amount, remaining });
  }
  if (p.action === "return") {
    if (!p.productId || Number(p.quantity) <= 0)
      return Response.json(
        { error: "Seleccione producto y cantidad" },
        { status: 400 },
      );
    const line = await d
      .prepare(
        "SELECT l.product_id,l.unit_cost,p.stock FROM purchase_order_lines l JOIN products p ON p.id=l.product_id WHERE l.order_id=? AND l.product_id=?",
      )
      .bind(order.id, p.productId)
      .first<{ product_id: string; unit_cost: number; stock: number }>();
    if (!line || line.stock < Number(p.quantity))
      return Response.json(
        { error: "Existencia insuficiente para devolver" },
        { status: 409 },
      );
    const qty = Number(p.quantity),
      total = qty * line.unit_cost,
      ref = `DEV-${Date.now()}`,
      returnId = randomUUID(),
      balance = line.stock - qty,
      payable = await d
        .prepare("SELECT id,balance FROM payables WHERE order_id=?")
        .bind(order.id)
        .first<{ id: string; balance: number }>(),
      stmts = [
        d
          .prepare(
            "INSERT INTO purchase_returns (id,tenant_id,order_id,supplier_id,user_id,reference,total,reason) VALUES (?,?,?,?,?,?,?,?)",
          )
          .bind(
            returnId,
            T,
            order.id,
            order.supplier_id,
            access.user.id,
            ref,
            total,
            p.reason || "Devolución al proveedor",
          ),
        d
          .prepare(
            "INSERT INTO purchase_return_lines (id,return_id,product_id,quantity,unit_cost,line_total) VALUES (?,?,?,?,?,?)",
          )
          .bind(
            randomUUID(),
            returnId,
            line.product_id,
            qty,
            line.unit_cost,
            total,
          ),
        d
          .prepare(
            "UPDATE products SET stock=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?",
          )
          .bind(balance, line.product_id),
        d
          .prepare(
            "INSERT INTO inventory_movements (id,tenant_id,branch_id,product_id,user_id,movement_type,quantity,balance_after,reason,reference) VALUES (?,?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            randomUUID(),
            T,
            B,
            line.product_id,
            access.user.id,
            "purchase_return",
            -qty,
            balance,
            p.reason || "Devolución al proveedor",
            ref,
          ),
      ];
    if (payable) {
      const next = Math.max(0, payable.balance - total);
      stmts.push(
        d
          .prepare(
            "UPDATE payables SET balance=?,original_amount=MAX(0,original_amount-?),status=? WHERE id=?",
          )
          .bind(next, total, next <= 0 ? "paid" : "partial", payable.id),
      );
    }
    await d.batch(stmts);
    return Response.json({ returned: true, reference: ref, total });
  }
  return Response.json({ error: "Acción inválida" }, { status: 400 });
}
