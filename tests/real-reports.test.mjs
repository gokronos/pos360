import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("reports derive all operational areas from real tables",async()=>{
  const api=await readFile("app/api/reports/route.ts","utf8");
  for(const table of ["sales","inventory_ledger","sale_payments","inventory_balances","purchase_receipts","cash_sessions","cash_movements","receivables","sale_returns","audit_logs"])
    assert.match(api,new RegExp(table));
  for(const metric of ["averageTicket","profit","valuation","outOfStock","portfolio","returns","audit"])
    assert.match(api,new RegExp(metric));
});

test("report filters are tenant, branch, warehouse, user and role protected",async()=>{
  const api=await readFile("app/api/reports/route.ts","utf8");
  assert.match(api,/dashboard\?"dashboard":"reports"/);
  assert.match(api,/T=access\.user\.tenantId,B=access\.user\.branchId/);
  assert.match(api,/La bodega no pertenece a la empresa y sede activas/);
  assert.match(api,/El usuario no pertenece a la empresa o sede activa/);
  assert.match(api,/role==="purchasing"/);
  assert.match(api,/canAudit=!dashboard&&\["owner","admin","auditor"\]/);
});

test("dashboard and reports render live filters and every required section",async()=>{
  const ui=await readFile("app/reports-real.tsx","utf8");
  assert.match(ui,/fetch\(`\/api\/reports\?\$\{q\}`\)/);
  for(const label of ["Ventas de hoy","Utilidad","Ticket promedio","Medios de pago","Inventario valorizado","Productos agotados","Compras recibidas","Movimientos de caja","Cartera","Devoluciones","Auditoría","Bodega","Usuario"])
    assert.match(ui,new RegExp(label,"i"));
  const page=await readFile("app/business-app.tsx","utf8");
  assert.match(page,/DashboardReal/);
  assert.match(page,/ReportsReal/);
});
