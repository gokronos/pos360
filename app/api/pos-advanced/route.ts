import { randomUUID } from "node:crypto";
import { getRuntimeEnv } from "../../../db/runtime-env";
import { requireAccess } from "../../../db/authz";
import { inventoryMovement, resolveWarehouse } from "../../../db/inventory";
export async function GET(req: Request) {
  const access = await requireAccess(req, "pos");
  if (access.error) return access.error;
  const T = access.user.tenantId;
  const d = getRuntimeEnv().DB,
    [drafts, sales] = await Promise.all([
      d
        .prepare(
          "SELECT d.id,d.number,d.document_type documentType,d.status,d.subtotal,d.discount,d.total,d.payload,d.notes,d.created_at createdAt,COALESCE(c.name,'Consumidor final') customerName FROM pos_drafts d LEFT JOIN customers c ON c.id=d.customer_id WHERE d.tenant_id=? AND d.status='open' ORDER BY d.created_at DESC",
        )
        .bind(T)
        .all(),
      d
        .prepare(
          "SELECT s.id,s.local_id localId,s.total,s.status,s.created_at createdAt,COALESCE(c.name,'Consumidor final') customerName FROM sales s LEFT JOIN customers c ON c.id=s.customer_id WHERE s.tenant_id=? ORDER BY s.created_at DESC LIMIT 20",
        )
        .bind(T)
        .all(),
    ]);
  return Response.json({ drafts: drafts.results, sales: sales.results });
}
export async function POST(req: Request) {
  const access = await requireAccess(req, "pos", "create");
  if (access.error) return access.error;
  const T = access.user.tenantId,
    B = access.user.branchId;
  const p = (await req.json()) as {
    action?: "draft" | "return" | "void";
    documentType?: string;
    customerId?: string;
    items?: {
      productId: string;
      quantity: number;
      name?: string;
      price?: number;
    }[];
    discount?: number;
    notes?: string;
    saleId?: string;
    reason?: string;
  };
  const d = getRuntimeEnv().DB,
    user = access.user.id;
  if (p.action === "draft") {
    if (!p.items?.length)
      return Response.json({ error: "Agregue productos" }, { status: 400 });
    const id = randomUUID(),
      type = p.documentType || "suspended",
      prefix = type === "quote" ? "COT" : type === "layaway" ? "APT" : "SUS",
      number = `${prefix}-${Date.now().toString().slice(-7)}`,
      subtotal = p.items.reduce(
        (s, x) => s + Number(x.price || 0) * x.quantity,
        0,
      ),
      discount = Number(p.discount || 0),
      total = subtotal - discount,
      expires =
        type === "quote"
          ? new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10)
          : null;
    await d
      .prepare(
        "INSERT INTO pos_drafts (id,tenant_id,branch_id,user_id,customer_id,number,document_type,status,subtotal,discount,total,payload,notes,expires_at) VALUES (?,?,?,?,?,?,?,'open',?,?,?,?,?,?)",
      )
      .bind(
        id,
        T,
        B,
        user,
        p.customerId || null,
        number,
        type,
        subtotal,
        discount,
        total,
        JSON.stringify(p.items),
        p.notes || null,
        expires,
      )
      .run();
    return Response.json(
      { draft: { id, number, type, total } },
      { status: 201 },
    );
  }
  if (!p.saleId)
    return Response.json({ error: "Venta requerida" }, { status: 400 });
  const sale = await d
    .prepare("SELECT id,status,total,warehouse_id warehouseId FROM sales WHERE id=? AND tenant_id=?")
    .bind(p.saleId, T)
    .first<{ id: string; status: string; total: number; warehouseId:string|null }>();
  if (!sale)
    return Response.json({ error: "Venta no encontrada" }, { status: 404 });
  if (sale.status !== "completed")
    return Response.json(
      { error: "La venta ya fue anulada o devuelta" },
      { status: 409 },
    );
  const lines = await d
    .prepare(
      "SELECT l.id,l.product_id productId,l.variant_id variantId,l.quantity,l.unit_price unitPrice,l.line_total lineTotal,p.track_inventory trackInventory FROM sale_lines l JOIN products p ON p.id=l.product_id WHERE l.sale_id=?",
    )
    .bind(sale.id)
    .all<{
      id: string;
      productId: string;
      variantId: string | null;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      trackInventory: number;
    }>();
  const warehouseId=sale.warehouseId||(await resolveWarehouse(T,B)).id,
    status = p.action === "void" ? "voided" : "returned",
    returnId = randomUUID(),
    number = `${p.action === "void" ? "ANU" : "DEV"}-${Date.now().toString().slice(-7)}`,
    stmts = [
      d.prepare("UPDATE sales SET status=? WHERE id=?").bind(status, sale.id),
      d
        .prepare(
          "INSERT INTO sale_returns (id,tenant_id,sale_id,user_id,number,total,reason,status) VALUES (?,?,?,?,?,?,?,'completed')",
        )
        .bind(
          returnId,
          T,
          sale.id,
          user,
          number,
          sale.total,
          p.reason || "Devolución total",
        ),
    ];
  for (const l of lines.results || []) {
    stmts.push(
      d
        .prepare(
          "INSERT INTO sale_return_lines (id,return_id,sale_line_id,product_id,quantity,unit_price,line_total) VALUES (?,?,?,?,?,?,?)",
        )
        .bind(
          randomUUID(),
          returnId,
          l.id,
          l.productId,
          l.quantity,
          l.unitPrice,
          l.lineTotal,
        ),
    );
    if (l.trackInventory) {
      const movement=await inventoryMovement({tenantId:T,branchId:B,warehouseId,productId:l.productId,variantId:l.variantId,userId:user,movementType:p.action==="void"?"sale_void":"sale_return",quantity:l.quantity,reason:p.reason||"Reversión de venta",reference:number,sourceType:"sale_return",sourceId:returnId});stmts.push(...movement.statements);
    }
  }
  await d.batch(stmts);
  return Response.json({ number, status, total: sale.total });
}
export async function PATCH(req: Request) {
  const access = await requireAccess(req, "pos", "edit");
  if (access.error) return access.error;
  const T = access.user.tenantId;
  const p = (await req.json()) as { id?: string };
  if (!p.id)
    return Response.json({ error: "Documento requerido" }, { status: 400 });
  const d = getRuntimeEnv().DB,
    draft = await d
      .prepare(
        "SELECT * FROM pos_drafts WHERE id=? AND tenant_id=? AND status='open'",
      )
      .bind(p.id, T)
      .first<{
        id: string;
        payload: string;
        customer_id: string;
        discount: number;
        document_type: string;
      }>();
  if (!draft)
    return Response.json({ error: "Documento no disponible" }, { status: 404 });
  await d
    .prepare(
      "UPDATE pos_drafts SET status='recovered',updated_at=CURRENT_TIMESTAMP WHERE id=?",
    )
    .bind(p.id)
    .run();
  return Response.json({
    items: JSON.parse(draft.payload),
    customerId: draft.customer_id,
    discount: draft.discount,
    documentType: draft.document_type,
  });
}
