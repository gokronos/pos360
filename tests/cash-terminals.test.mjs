import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("cash migration enforces authorized terminals and one active session",async()=>{
  const sql=await readFile("drizzle/0017_caja_terminales.sql","utf8");
  for(const term of ["terminal_user_access","cash_counts","cash_events","cash_open_user_uq","cash_open_terminal_uq","cash_open_register_uq","difference_minor","approval_status"])
    assert.match(sql,new RegExp(term));
  assert.match(sql,/cash_movement_type_guard[\s\S]*RAISE\(ABORT/);
});

test("cash API implements opening, movements, count, close and independent approval",async()=>{
  const api=await readFile("app/api/cash/route.ts","utf8");
  for(const action of ['p.action==="open"','p.action==="movement"','p.action==="count"','p.action==="close"','p.action==="approve"'])
    assert.match(api,new RegExp(action.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.match(api,/terminal_user_access[\s\S]*a\.active=1/);
  assert.match(api,/session\.userId===user[\s\S]*no puede aprobar su propia diferencia/);
  assert.match(api,/difference!==0[\s\S]*pending_approval/);
  assert.match(api,/parseMoney/);
});

test("sales retain full cash trace and only cash payments affect the drawer",async()=>{
  const sales=await readFile("app/api/sales/route.ts","utf8");
  assert.match(sales,/JOIN terminal_user_access/);
  assert.match(sales,/terminal_id,register_id,cash_session_id/);
  assert.match(sales,/p\.method==="cash"/);
  assert.match(sales,/"sale_cash"/);
  assert.doesNotMatch(sales,/"sale_(credit|other)"/);
});

test("POS exposes terminal selection, movements, count and supervisor approval",async()=>{
  const ui=await readFile("app/pos-advanced.tsx","utf8");
  for(const label of ["Terminal autorizada","Movimiento de caja","Movimientos permitidos","Arqueo y cierre","Aprobar diferencias","Pendiente de aprobación"])
    assert.match(ui,new RegExp(label,"i"));
});
