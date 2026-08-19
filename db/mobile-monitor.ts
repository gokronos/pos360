type LowStock = {tenantId:string;branchId:string;productId:string;name:string;quantity:number;minimumStock:number};
type ExpiringLot = {tenantId:string;branchId:string;id:string;lotNumber:string;expirationDate:string;name:string};

export async function refreshMobileAlerts(db:D1Database){
  const lowStock=await db.prepare("SELECT i.tenant_id tenantId,w.branch_id branchId,i.product_id productId,p.name,i.quantity,i.minimum_stock minimumStock FROM inventory_balances i JOIN warehouses w ON w.id=i.warehouse_id JOIN products p ON p.id=i.product_id WHERE i.minimum_stock>0 AND i.quantity<=i.minimum_stock").all<LowStock>();
  const statements:D1PreparedStatement[]=[];
  for(const item of lowStock.results){
    statements.push(db.prepare("INSERT INTO mobile_alerts(id,tenant_id,branch_id,alert_type,severity,title,message,entity_type,entity_id) SELECT ?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM mobile_alerts WHERE tenant_id=? AND branch_id=? AND alert_type='low_stock' AND entity_id=? AND status='open')").bind(crypto.randomUUID(),item.tenantId,item.branchId,"low_stock",item.quantity<=0?"critical":"warning",item.quantity<=0?"Producto agotado":"Stock bajo",`${item.name}: ${item.quantity} disponibles; mínimo ${item.minimumStock}`,"product",item.productId,item.tenantId,item.branchId,item.productId));
  }
  const expiring=await db.prepare("SELECT l.tenant_id tenantId,w.branch_id branchId,l.id,l.lot_number lotNumber,l.expiration_date expirationDate,p.name FROM product_lots l JOIN warehouses w ON w.id=l.warehouse_id JOIN products p ON p.id=l.product_id WHERE l.quantity>0 AND l.expiration_date IS NOT NULL AND l.expiration_date<=date('now','+30 days')").all<ExpiringLot>();
  const today=new Date().toISOString().slice(0,10);
  for(const lot of expiring.results){
    statements.push(db.prepare("INSERT INTO mobile_alerts(id,tenant_id,branch_id,alert_type,severity,title,message,entity_type,entity_id) SELECT ?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM mobile_alerts WHERE tenant_id=? AND branch_id=? AND alert_type='lot_expiry' AND entity_id=? AND status='open')").bind(crypto.randomUUID(),lot.tenantId,lot.branchId,"lot_expiry",lot.expirationDate<today?"critical":"warning","Lote próximo a vencer",`${lot.name} · lote ${lot.lotNumber} · ${lot.expirationDate}`,"product_lot",lot.id,lot.tenantId,lot.branchId,lot.id));
  }
  if(statements.length)await db.batch(statements);
  return {lowStock:lowStock.results.length,expiring:expiring.results.length};
}
