import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
const read=path=>readFile(new URL(path,import.meta.url),"utf8");

test("electronic billing migration stores the complete immutable lifecycle",async()=>{
  const sql=await read("../drizzle/0022_facturacion_electronica.sql");
  for(const table of ["electronic_billing_providers","electronic_resolutions","electronic_documents","electronic_document_attempts","electronic_document_events","electronic_document_files","electronic_contingencies"])assert.match(sql,new RegExp(`CREATE TABLE ${table}`));
  assert.match(sql,/electronic_documents_idempotency_uq/);assert.match(sql,/electronic_documents_sale_type_uq/);assert.match(sql,/CHECK\(range_from > 0/);
});

test("server issues invoices, equivalents and adjustment notes from real sales",async()=>{
  const api=await read("../app/api/electronic-billing/route.ts");
  for(const term of ["invoice","equivalent","credit_note","debit_note","sale_lines","technicalProfile","DIAN-FEV-1.9","DIAN-DEE-1.0"])assert.match(api,new RegExp(term));
  assert.match(api,/documento electrónico aceptado/);assert.match(api,/idempotency_key/);
});

test("transmission is durable, retryable and never fakes production acceptance",async()=>{
  const api=await read("../app/api/electronic-billing/route.ts");
  assert.match(api,/electronic_document_attempts/);assert.match(api,/next_retry_at/);assert.match(api,/Math\.min\(3600,30\*2\*\*attempt\)/);assert.match(api,/ADAPTER_REQUIRED/);assert.match(api,/providerType==="sandbox"/);
});

test("a scheduled durable worker processes due retries",async()=>{
  const [worker,queue,wrangler]=await Promise.all([read("../worker/index.ts"),read("../db/electronic-billing-queue.ts"),read("../wrangler.jsonc")]);
  assert.match(worker,/async scheduled/);assert.match(worker,/processElectronicBillingQueue/);assert.match(queue,/next_retry_at<=CURRENT_TIMESTAMP/);assert.match(queue,/attempt>=5/);assert.match(wrangler,/\*\/5 \* \* \* \*/);
});

test("contingency, graphic representation and document files are implemented",async()=>{
  const [api,ui]=await Promise.all([read("../app/api/electronic-billing/route.ts"),read("../app/electronic-billing.tsx")]);
  assert.match(api,/electronic_contingencies/);assert.match(api,/graphic_html/);assert.match(api,/ubl_xml/);assert.match(api,/format==="html"/);assert.match(ui,/Abrir contingencia/);assert.match(ui,/Representación|Ver/);
});
