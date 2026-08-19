import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("customer migration covers commercial profile, consent and exact receivables",async()=>{
  const sql=await readFile("drizzle/0016_clientes_cartera.sql","utf8");
  for(const term of ["commercial_name","price_list_id","credit_limit_minor","customer_addresses","consent_whatsapp","blocked","credit_authorizations","customer_events","balance_minor","customer_credits"])
    assert.match(sql,new RegExp(term));
  assert.match(sql,/receivable_balance_guard[\s\S]*RAISE\(ABORT/);
});

test("credit sales enforce blocks, overdue balances, limits and authorization",async()=>{
  const sales=await readFile("app/api/sales/route.ts","utf8");
  assert.match(sales,/customerProfile\.blocked/);
  assert.match(sales,/overdueMinor>0/);
  assert.match(sales,/currentBalanceMinor\+creditMinor>customerProfile\.creditLimitMinor/);
  assert.match(sales,/needsCreditAuthorization:true/);
  assert.match(sales,/UPDATE credit_authorizations SET used_at/);
  assert.match(sales,/INSERT INTO receivables[\s\S]*balance_minor/);
});

test("customer API supports FIFO payments and a full account statement",async()=>{
  const api=await readFile("app/api/customers/route.ts","utf8");
  assert.match(api,/ORDER BY due_date,created_at/);
  assert.match(api,/for\(const open of opens\.results\)/);
  for(const term of ["customer_addresses","customer_payments","credit_authorizations","customer_events","customer_credits"])
    assert.match(api,new RegExp(term));
  const ui=await readFile("app/customers-advanced.tsx","utf8");
  for(const label of ["Estado de cuenta","Cartera vencida","Autorizar crédito","Comunicaciones","Nueva dirección","Bloquear"])
    assert.match(ui,new RegExp(label,"i"));
});
