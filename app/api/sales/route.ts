import { randomUUID } from "node:crypto";
import { getRuntimeEnv } from "../../../db/runtime-env";
import { requireAccess } from "../../../db/authz";
import { moneyToMajor, multiplyMoney, parseMoney } from "../../../db/money";
import { inventoryMovement, resolveWarehouse } from "../../../db/inventory";
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
    items?: { productId: string; variantId?: string; quantity: number }[];
    payments?: { method: string; amount: number }[];
    discountPercent?: number;
    discountReason?: string;
    discountAuthorizationCode?: string;
    priceListId?: string;
  };
  if (!body.localId || !body.items?.length)
    return Response.json({ error: "Venta incompleta" }, { status: 400 });
  const d = getRuntimeEnv().DB,
    user = access.user.id,
    warehouse = await resolveWarehouse(T, B),
    customerProfile = body.customerId ? await d.prepare("SELECT price_list_id priceListId,credit_limit_minor creditLimitMinor,credit_days creditDays,blocked,block_reason blockReason,active,COALESCE((SELECT SUM(balance_minor) FROM receivables r WHERE r.customer_id=customers.id),0) currentBalanceMinor,COALESCE((SELECT SUM(CASE WHEN balance_minor>0 AND due_date<date('now') THEN balance_minor ELSE 0 END) FROM receivables r WHERE r.customer_id=customers.id),0) overdueMinor FROM customers WHERE id=? AND tenant_id=?").bind(body.customerId,T).first<{priceListId:string|null;creditLimitMinor:number;creditDays:number;blocked:number;blockReason:string|null;active:number;currentBalanceMinor:number;overdueMinor:number}>() : null,
    selectedPriceListId = body.priceListId || customerProfile?.priceListId || "",
    inventoryPolicy = await d
      .prepare(
        "SELECT allow_negative_stock allowNegativeStock FROM business_settings WHERE tenant_id=?",
      )
      .bind(T)
      .first<{ allowNegativeStock: number }>(),
    session = await d
      .prepare(
        "SELECT s.id,s.terminal_id terminalId,s.register_id registerId FROM cash_sessions s JOIN terminals t ON t.id=s.terminal_id AND t.status='active' JOIN terminal_user_access a ON a.terminal_id=t.id AND a.user_id=s.user_id AND a.active=1 WHERE s.tenant_id=? AND s.branch_id=? AND s.user_id=? AND s.status='open' ORDER BY s.opened_at DESC LIMIT 1",
      )
      .bind(T, B, user)
      .first<{ id: string;terminalId:string;registerId:string }>();
  if (selectedPriceListId) {
    const list = await d
      .prepare(
        "SELECT id FROM price_lists WHERE id=? AND tenant_id=? AND active=1",
      )
      .bind(selectedPriceListId, T)
      .first();
    if (!list)
      return Response.json(
        { error: "Lista de precios no autorizada" },
        { status: 403 },
      );
  }
  if (!session)
    return Response.json(
      { error: "Seleccione una terminal autorizada y abra la caja antes de vender", needsCashOpen: true },
      { status: 409 },
    );
  const existing = await d
    .prepare("SELECT id,total FROM sales WHERE tenant_id=? AND local_id=?")
    .bind(T, body.localId)
    .first();
  if (existing) return Response.json({ sale: { ...existing, number:`V-${String(existing.id).slice(0,8).toUpperCase()}` }, duplicate: true });
  let subtotalMinor = 0;
  const lines: {
    id: string;
    productId: string;
    quantity: number;
    priceMinor: number;
    lineTotalMinor: number;
    balance: number;
    trackInventory: number;
    variantId: string | null;
  }[] = [];
  for (const item of body.items) {
    const p = await (
      item.variantId
        ? d
            .prepare(
              "SELECT p.id,COALESCE((SELECT pp.price_minor FROM product_prices pp WHERE pp.product_id=p.id AND pp.variant_id=v.id AND pp.price_list_id=? AND pp.min_quantity<=? ORDER BY pp.min_quantity DESC LIMIT 1),v.price_minor) priceMinor,COALESCE((SELECT quantity FROM inventory_balances b WHERE b.warehouse_id=? AND b.product_id=p.id AND b.variant_id=v.id),0) stock,p.track_inventory trackInventory,v.id variantId FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id=? AND p.id=? AND v.tenant_id=? AND p.tenant_id=? AND v.active=1 AND p.active=1",
            )
            .bind(
              selectedPriceListId,
              item.quantity,
              warehouse.id,
              item.variantId,
              item.productId,
              T,
              T,
            )
        : d
            .prepare(
              "SELECT id,COALESCE((SELECT pp.price_minor FROM product_prices pp WHERE pp.product_id=products.id AND pp.price_list_id=? AND pp.variant_id IS NULL AND pp.min_quantity<=? ORDER BY pp.min_quantity DESC LIMIT 1),price_minor) priceMinor,COALESCE((SELECT quantity FROM inventory_balances b WHERE b.warehouse_id=? AND b.product_id=products.id AND b.variant_id IS NULL),0) stock,track_inventory trackInventory,NULL variantId FROM products WHERE id=? AND tenant_id=? AND active=1",
            )
            .bind(selectedPriceListId, item.quantity, warehouse.id, item.productId, T)
    ).first<{
      id: string;
      priceMinor: number;
      stock: number;
      trackInventory: number;
      variantId: string | null;
    }>();
    if (!p || item.quantity <= 0)
      return Response.json(
        { error: "Producto o cantidad inválida" },
        { status: 400 },
      );
    if (
      p.trackInventory &&
      !inventoryPolicy?.allowNegativeStock &&
      p.stock < item.quantity
    )
      return Response.json({ error: "Stock insuficiente" }, { status: 409 });
    const lineTotalMinor = multiplyMoney(p.priceMinor, item.quantity);
    subtotalMinor += lineTotalMinor;
    lines.push({
      id: randomUUID(),
      productId: p.id,
      quantity: item.quantity,
      priceMinor: p.priceMinor,
      lineTotalMinor,
      balance: p.trackInventory ? p.stock - item.quantity : p.stock,
      trackInventory: p.trackInventory,
      variantId: p.variantId,
    });
  }
  const discountPercent = Math.min(
    100,
    Math.max(0, Number(body.discountPercent || 0)),
  );
  let discountAuthorizationId:string|null=null,discountAuthorizedBy:string|null=["owner","admin"].includes(access.user.role)?user:null;
  if (discountPercent > 10 && !["owner", "admin"].includes(access.user.role)) {
    const authorization=body.discountAuthorizationCode?await d.prepare("SELECT id,authorized_by authorizedBy FROM pos_discount_authorizations WHERE tenant_id=? AND code=? AND used_at IS NULL AND expires_at>datetime('now') AND max_percent>=?").bind(T,body.discountAuthorizationCode.trim().toUpperCase(),discountPercent).first<{id:string;authorizedBy:string}>():null;
    if(!authorization)return Response.json({error:"Los descuentos superiores al 10% requieren un código administrativo vigente",needsAuthorization:true},{status:403});
    discountAuthorizationId=authorization.id;discountAuthorizedBy=authorization.authorizedBy;
  }
  const discountMinor = Math.round((subtotalMinor * discountPercent) / 100),
    totalMinor = subtotalMinor - discountMinor;
  let payments: { method: string; amount: number; amountMinor: number }[];
  try {
    const rawPayments = body.payments?.length
      ? body.payments.map((payment) => {
          const amountMinor = parseMoney(payment.amount);
          return {
            method: payment.method,
            amount: moneyToMajor(amountMinor),
            amountMinor,
          };
        })
      : [
          {
            method: body.method || "cash",
            amount: moneyToMajor(totalMinor),
            amountMinor: totalMinor,
          },
        ];
    payments=Object.values(rawPayments.reduce<Record<string,{method:string;amount:number;amountMinor:number}>>((acc,payment)=>{const current=acc[payment.method];acc[payment.method]={method:payment.method,amount:moneyToMajor((current?.amountMinor||0)+payment.amountMinor),amountMinor:(current?.amountMinor||0)+payment.amountMinor};return acc},{}));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Pago inválido" },
      { status: 400 },
    );
  }
  const paidMinor = payments.reduce(
    (sum, payment) => sum + payment.amountMinor,
    0,
  );
  if (paidMinor !== totalMinor)
    return Response.json(
      { error: "La suma de los pagos debe coincidir con el total" },
      { status: 400 },
    );
  if (payments.some((p) => p.method === "credit") && !body.customerId)
    return Response.json(
      { error: "Seleccione cliente para el pago a crédito" },
      { status: 400 },
    );
  let creditAuthorizationId:string|null=null;
  if (body.customerId && payments.some((p) => p.method === "credit")) {
    const creditMinor = payments
        .filter((p) => p.method === "credit")
        .reduce((s, p) => s + p.amountMinor, 0);
    if(!customerProfile?.active)return Response.json({error:"El cliente no está activo"},{status:409});
    const requiresAuthorization=Boolean(customerProfile.blocked||customerProfile.overdueMinor>0||customerProfile.currentBalanceMinor+creditMinor>customerProfile.creditLimitMinor);
    if(requiresAuthorization){const authorization=await d.prepare("SELECT id FROM credit_authorizations WHERE tenant_id=? AND customer_id=? AND used_at IS NULL AND expires_at>datetime('now') AND amount_minor>=? ORDER BY created_at LIMIT 1").bind(T,body.customerId,creditMinor).first<{id:string}>();if(!authorization)return Response.json({error:customerProfile.blocked?`Cliente bloqueado: ${customerProfile.blockReason||"requiere autorización"}`:customerProfile.overdueMinor>0?"El cliente tiene cartera vencida y requiere autorización":"El crédito supera el cupo y requiere autorización",needsCreditAuthorization:true},{status:403});creditAuthorizationId=authorization.id}
  }
  const saleId = randomUUID(), inventoryStatements=[];
  for(const line of lines.filter((l) => l.trackInventory)){
    const movement=await inventoryMovement({tenantId:T,branchId:B,warehouseId:warehouse.id,productId:line.productId,variantId:line.variantId,userId:user,movementType:"sale",quantity:-line.quantity,reason:"Venta POS",reference:saleId,sourceType:"sale",sourceId:saleId,allowNegative:Boolean(inventoryPolicy?.allowNegativeStock)});
    inventoryStatements.push(...movement.statements);
  }
  const stmts = [
      d
        .prepare(
          "INSERT INTO sales (id,tenant_id,branch_id,warehouse_id,terminal_id,register_id,cash_session_id,user_id,customer_id,local_id,total,subtotal_minor,discount_minor,total_minor) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          saleId,
          T,
          B,
          warehouse.id,
          session.terminalId,
          session.registerId,
          session.id,
          user,
          body.customerId || null,
          body.localId,
          moneyToMajor(totalMinor),
          subtotalMinor,
          discountMinor,
          totalMinor,
        ),
      ...lines.map((l) =>
        d
          .prepare(
            "INSERT INTO sale_lines (id,sale_id,product_id,variant_id,quantity,unit_price,line_total,unit_price_minor,line_total_minor) VALUES (?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            l.id,
            saleId,
            l.productId,
            l.variantId,
            l.quantity,
            moneyToMajor(l.priceMinor),
            moneyToMajor(l.lineTotalMinor),
            l.priceMinor,
            l.lineTotalMinor,
          ),
      ),
      ...payments.map((p) =>
        d
          .prepare(
            "INSERT INTO sale_payments (id,sale_id,method,amount,reference,amount_minor) VALUES (?,?,?,?,?,?)",
          )
          .bind(
            randomUUID(),
            saleId,
            p.method,
            p.amount,
            p.method === "cash" ? null : `PAY-${Date.now()}`,
            p.amountMinor,
          ),
      ),
      ...inventoryStatements,
      ...(creditAuthorizationId?[d.prepare("UPDATE credit_authorizations SET used_at=CURRENT_TIMESTAMP,sale_id=? WHERE id=? AND used_at IS NULL").bind(saleId,creditAuthorizationId)]:[]),
      ...(discountAuthorizationId?[d.prepare("UPDATE pos_discount_authorizations SET used_at=CURRENT_TIMESTAMP,used_by=?,sale_id=? WHERE id=? AND used_at IS NULL").bind(user,saleId,discountAuthorizationId)]:[]),
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
          JSON.stringify({ localId: body.localId, totalMinor, payments }),
          "applied",
        ),
    ];
  if (discountMinor > 0)
    stmts.push(
      d
        .prepare(
          "INSERT INTO sale_discounts (id,tenant_id,sale_id,user_id,authorized_by,discount_type,value,amount,reason,authorization_id) VALUES (?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          randomUUID(),
          T,
          saleId,
          user,
          discountAuthorizedBy,
          "percent",
          discountPercent,
          moneyToMajor(discountMinor),
          body.discountReason || "Descuento comercial",
          discountAuthorizationId,
        ),
    );
  const cashMinor=payments.filter(p=>p.method==="cash").reduce((sum,p)=>sum+p.amountMinor,0);
  if(cashMinor)stmts.push(d.prepare("INSERT INTO cash_movements (id,tenant_id,session_id,user_id,movement_type,amount,amount_minor,affects_cash,reason,reference) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(randomUUID(),T,session.id,user,"sale_cash",moneyToMajor(cashMinor),cashMinor,1,"Venta en efectivo",saleId));
  const creditMinor=payments.filter(p=>p.method==="credit").reduce((sum,p)=>sum+p.amountMinor,0);
  if(creditMinor&&body.customerId){const due=new Date(Date.now()+Math.max(0,customerProfile?.creditDays||0)*86400000).toISOString().slice(0,10);stmts.push(d.prepare("INSERT INTO receivables (id,tenant_id,branch_id,customer_id,sale_id,original_amount,balance,original_amount_minor,balance_minor,due_date,status) VALUES (?,?,?,?,?,?,?,?,?,?,'pending')").bind(randomUUID(),T,B,body.customerId,saleId,moneyToMajor(creditMinor),moneyToMajor(creditMinor),creditMinor,creditMinor,due),d.prepare("INSERT INTO customer_events (id,tenant_id,customer_id,user_id,action,amount_minor,reason,reference) VALUES (?,?,?,?,?,?,?,?)").bind(randomUUID(),T,body.customerId,user,"credit_sale",creditMinor,"Venta a crédito",saleId))}
  try{await d.batch(stmts)}catch(error){const duplicate=await d.prepare("SELECT id,total FROM sales WHERE tenant_id=? AND local_id=?").bind(T,body.localId).first<{id:string;total:number}>();if(duplicate)return Response.json({sale:{...duplicate,number:`V-${duplicate.id.slice(0,8).toUpperCase()}`},duplicate:true});throw error}
  return Response.json(
    {
      sale: {
        id: saleId,
        number: `V-${saleId.slice(0, 8).toUpperCase()}`,
        subtotal: moneyToMajor(subtotalMinor),
        discount: moneyToMajor(discountMinor),
        total: moneyToMajor(totalMinor),
        payments,
        status: "completed",
        syncStatus: "synced",
        change: (()=>{const cashDue=payments.filter(p=>p.method==="cash").reduce((s,p)=>s+p.amount,0);return cashDue?Math.max(0,Number(body.received||cashDue)-cashDue):0})(),
      },
    },
    { status: 201 },
  );
}
