import { randomUUID } from "node:crypto";
import { getRuntimeEnv } from "./runtime-env";

export type InventoryMovement = {
  tenantId: string;
  branchId: string;
  warehouseId: string;
  productId: string;
  variantId?: string | null;
  userId: string;
  movementType: string;
  quantity: number;
  reason: string;
  reference?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  unitCostMinor?: number;
  allowNegative?: boolean;
};

export async function resolveWarehouse(tenantId: string, branchId: string) {
  const d = getRuntimeEnv().DB;
  const row = await d.prepare("SELECT w.id,w.branch_id branchId FROM warehouses w LEFT JOIN business_settings s ON s.main_warehouse_id=w.id AND s.tenant_id=w.tenant_id WHERE w.tenant_id=? AND w.active=1 AND (w.branch_id=? OR s.main_warehouse_id=w.id) ORDER BY CASE WHEN s.main_warehouse_id=w.id THEN 0 ELSE 1 END,w.created_at LIMIT 1").bind(tenantId, branchId).first<{ id: string; branchId: string }>();
  if (!row) throw new Error("La sede no tiene una bodega activa");
  return row;
}

export async function inventoryMovement(input: InventoryMovement) {
  const d = getRuntimeEnv().DB;
  if (!Number.isFinite(input.quantity) || input.quantity === 0)
    throw new Error("La cantidad del movimiento debe ser diferente de cero");
  if (!input.reason.trim()) throw new Error("El motivo del movimiento es obligatorio");
  const variant = input.variantId || "";
  const current = await d.prepare("SELECT id,quantity,average_cost_minor averageCostMinor,minimum_stock minimumStock FROM inventory_balances WHERE tenant_id=? AND warehouse_id=? AND product_id=? AND IFNULL(variant_id,'')=?").bind(input.tenantId,input.warehouseId,input.productId,variant).first<{id:string;quantity:number;averageCostMinor:number;minimumStock:number}>();
  const previous = Number(current?.quantity || 0);
  const after = previous + input.quantity;
  if (after < 0 && !input.allowNegative) throw new Error("Existencia insuficiente en la bodega");
  let average = Number(current?.averageCostMinor || 0);
  const unitCost = Math.max(0, Math.round(input.unitCostMinor ?? average));
  if (input.quantity > 0 && unitCost > 0 && after > 0) {
    const valuedPrevious = Math.max(0, previous) * average;
    average = Math.round((valuedPrevious + input.quantity * unitCost) / (Math.max(0, previous) + input.quantity));
  }
  const balanceId = current?.id || randomUUID();
  const statements = [
    d.prepare("INSERT INTO inventory_balances (id,tenant_id,warehouse_id,product_id,variant_id,quantity,average_cost_minor) VALUES (?,?,?,?,?,?,?) ON CONFLICT DO UPDATE SET quantity=excluded.quantity,average_cost_minor=excluded.average_cost_minor,updated_at=CURRENT_TIMESTAMP").bind(balanceId,input.tenantId,input.warehouseId,input.productId,input.variantId || null,after,average),
    d.prepare("INSERT INTO inventory_ledger (id,tenant_id,branch_id,warehouse_id,product_id,variant_id,user_id,movement_type,quantity,previous_balance,balance_after,unit_cost_minor,average_cost_minor,reason,reference,source_type,source_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(randomUUID(),input.tenantId,input.branchId,input.warehouseId,input.productId,input.variantId || null,input.userId,input.movementType,input.quantity,previous,after,unitCost,average,input.reason.trim(),input.reference || null,input.sourceType || null,input.sourceId || null),
  ];
  return { statements, previous, after, averageCostMinor: average };
}

export async function negativeStockAllowed(tenantId: string) {
  const row = await getRuntimeEnv().DB.prepare("SELECT allow_negative_stock allowed FROM business_settings WHERE tenant_id=?").bind(tenantId).first<{allowed:number}>();
  return Boolean(row?.allowed);
}
