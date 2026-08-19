import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { glob } from "node:fs/promises";

test("inventory uses one balance table and an immutable ledger",async()=>{
  const migration=await readFile("drizzle/0014_inventario_kardex.sql","utf8");
  assert.match(migration,/CREATE TABLE `inventory_balances`/);
  for(const field of ["previous_balance","balance_after","user_id","reason","created_at"])
    assert.match(migration,new RegExp(field));
  assert.match(migration,/inventory_ledger_no_update[\s\S]*RAISE\(ABORT/);
  assert.match(migration,/inventory_ledger_no_delete[\s\S]*RAISE\(ABORT/);
  assert.match(migration,/average_cost_minor/);
  assert.match(migration,/minimum_stock/);
});

test("commercial APIs cannot bypass warehouse balances and kardex",async()=>{
  let source="";
  for await(const file of glob("app/api/**/route.ts"))source+=await readFile(file,"utf8");
  assert.doesNotMatch(source,/UPDATE (?:products|product_variants) SET stock/i);
  assert.doesNotMatch(source,/INSERT INTO warehouse_stock|UPDATE warehouse_stock/i);
  for(const route of ["sales","purchases","pos-advanced","products","catalog","inventory-advanced","sync-status"]){
    const text=await readFile(`app/api/${route}/route.ts`,"utf8");
    assert.match(text,/inventoryMovement/,`${route} debe usar el servicio central`);
  }
});

test("every inventory movement requires traceability fields",async()=>{
  const service=await readFile("db/inventory.ts","utf8");
  for(const field of ["user_id","created_at","reason","previous_balance","balance_after","warehouse_id"])
    assert.match(service,new RegExp(field));
  assert.match(service,/motivo del movimiento es obligatorio/i);
  assert.match(service,/Existencia insuficiente en la bodega/);
});
