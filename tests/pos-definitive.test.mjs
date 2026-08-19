import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("POS migration persists favorites, authorizations and duplicate barriers",async()=>{
  const sql=await readFile("drizzle/0018_pos_definitivo.sql","utf8");
  for(const term of ["product_favorites_user_product_uq","pos_discount_authorizations","sale_discounts_authorization_once_uq","sale_payment_method_once_uq","sale_inventory_source_uq"])
    assert.match(sql,new RegExp(term));
});

test("sale confirmation is idempotent and aggregates repeated payment methods",async()=>{
  const sales=await readFile("app/api/sales/route.ts","utf8");
  assert.match(sales,/WHERE tenant_id=\? AND local_id=\?/);
  assert.match(sales,/duplicate:true/);
  assert.match(sales,/rawPayments\.reduce/);
  assert.match(sales,/try\{await d\.batch\(stmts\)\}catch/);
  assert.match(sales,/discountAuthorizationCode/);
  assert.match(sales,/pos_discount_authorizations SET used_at/);
});

test("definitive POS exposes scanner, keyboard, favorites, weights, documents and reprint",async()=>{
  const ui=await readFile("app/pos-advanced.tsx","utf8");
  for(const term of ["F2","F4","F8","barcode","Favoritos","0.001","Consumidor final","Pago combinado","Apartado","Pedido","Cotización","Devoluciones","Reimprimir","operationIdRef","busyRef"])
    assert.match(ui,new RegExp(term,"i"));
  const api=await readFile("app/api/pos-advanced/route.ts","utf8");
  for(const term of ["favorite","authorizeDiscount","document_type","recovered","sale_return","reprint:true"])
    assert.match(api,new RegExp(term,"i"));
});
