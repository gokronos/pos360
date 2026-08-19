import { requireAccess } from "../../../db/authz";
import { getRuntimeEnv } from "../../../db/runtime-env";
export async function GET(req:Request){
  const access=await requireAccess(req,"inventory");if(access.error)return access.error;
  const url=new URL(req.url),warehouse=url.searchParams.get("warehouseId"),product=url.searchParams.get("productId"),where=["l.tenant_id=?"],args:unknown[]=[access.user.tenantId];
  if(warehouse){where.push("l.warehouse_id=?");args.push(warehouse)}if(product){where.push("l.product_id=?");args.push(product)}
  const rows=await getRuntimeEnv().DB.prepare(`SELECT l.id,l.movement_type movementType,l.quantity,l.previous_balance previousBalance,l.balance_after balanceAfter,l.unit_cost_minor unitCostMinor,l.average_cost_minor averageCostMinor,l.reason,l.reference,l.source_type sourceType,l.created_at createdAt,p.name productName,w.name warehouseName,u.display_name userName FROM inventory_ledger l JOIN products p ON p.id=l.product_id JOIN warehouses w ON w.id=l.warehouse_id JOIN app_users u ON u.id=l.user_id WHERE ${where.join(" AND ")} ORDER BY l.created_at DESC,l.rowid DESC LIMIT 500`).bind(...args).all();return Response.json({movements:rows.results});
}
