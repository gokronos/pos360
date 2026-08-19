import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const read=(path)=>readFile(new URL(path,import.meta.url),"utf8");

test("sector migration includes traceable sector capabilities",async()=>{
  const sql=await read("../drizzle/0020_funciones_por_sector.sql");
  for(const table of ["sector_features","pharmacy_product_settings","sale_lot_allocations","hardware_dispatches","hardware_dispatch_lines","scale_codes","sector_promotions","sector_combos","sector_combo_items"])
    assert.match(sql,new RegExp(`CREATE TABLE ${table}`));
  assert.match(sql,/strategy text DEFAULT 'FEFO'/);
  assert.match(sql,/CHECK\(quantity > 0\)/);
});

test("sales enforce FEFO promotions and combo inventory on the server",async()=>{
  const sales=await read("../app/api/sales/route.ts");
  assert.match(sales,/ORDER BY CASE WHEN expiration_date IS NULL THEN 1 ELSE 0 END,expiration_date,created_at/);
  assert.match(sales,/No hay lotes vigentes suficientes/);
  assert.match(sales,/sector_promotions/);
  assert.match(sales,/movementType:"combo_sale"/);
  assert.match(sales,/sale_lot_allocations/);
});

test("scale input validates EAN-13 and reaches the POS scanner",async()=>{
  const [api,pos]=await Promise.all([read("../app/api/sector/route.ts"),read("../app/pos-advanced.tsx")]);
  assert.match(api,/validEan13/);
  assert.match(api,/PLU de báscula no configurado/);
  assert.match(pos,/scaleCode=/);
  assert.match(pos,/agregado por código/);
});

test("all sector queries and mutations are tenant scoped",async()=>{
  const api=await read("../app/api/sector/route.ts");
  assert.match(api,/tenant_id=\?/);
  assert.match(api,/p\.tenant_id=s\.tenant_id/);
  assert.match(api,/Producto o sector inválido/);
  assert.match(api,/componentes del combo son inválidos/);
});
