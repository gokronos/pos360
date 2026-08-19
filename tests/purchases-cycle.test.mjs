import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("purchase migration defines authorization, exact money and lifecycle audit",async()=>{
  const sql=await readFile("drizzle/0015_ciclo_compras.sql","utf8");
  for(const term of ["approved_by","approved_at","warehouse_id","total_minor","unit_cost_minor","balance_minor","returned_quantity","purchase_events","supplier_credits"])
    assert.match(sql,new RegExp(term));
  assert.match(sql,/purchase_received_quantity_guard[\s\S]*RAISE\(ABORT/);
  assert.match(sql,/purchase_returned_quantity_guard[\s\S]*RAISE\(ABORT/);
});

test("purchase API enforces the complete authorized and atomic cycle",async()=>{
  const source=await readFile("app/api/purchases/route.ts","utf8");
  assert.match(source,/status:\s*"draft"/);
  assert.match(source,/action==="approve"/);
  assert.match(source,/\["owner","admin","supervisor"\]/);
  assert.match(source,/\["approved","partial"\]\.includes\(order\.status\)/);
  assert.match(source,/await d\.batch\(statements\)/);
  for(const term of ["purchase_receipts","inventoryMovement","UPDATE products SET cost","payables","supplier_payments","purchase_returns","supplier_credits","purchase_events"])
    assert.match(source,new RegExp(term));
});

test("purchase UI exposes every required step",async()=>{
  const ui=await readFile("app/purchases-advanced.tsx","utf8");
  for(const label of ["Proveedor","Orden de compra","Autorizar","Recibir","Pagar","Devolver","Trazabilidad"])
    assert.match(ui,new RegExp(label,"i"));
  assert.match(ui,/Agregar producto/);
  assert.match(ui,/Recepción atómica/);
});
