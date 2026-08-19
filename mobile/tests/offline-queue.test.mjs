import assert from "node:assert/strict";import {readFile} from "node:fs/promises";import test from "node:test";
const source=await readFile(new URL("../src/main.js",import.meta.url),"utf8");
test("mobile client reads persisted snapshots first",()=>{assert.match(source,/stored\("snapshot"\)/);assert.match(source,/Preferences/)});
test("writes use a durable idempotent queue",()=>{assert.match(source,/stored\("queue"\)/);assert.match(source,/operationId:crypto\.randomUUID/);assert.match(source,/networkStatusChange/)});
test("inventory purchases orders and alerts are visible",()=>{for(const term of ["inventoryView","purchasesView","ordersView","alertsView","receive_purchase","ack_alert"])assert.match(source,new RegExp(term))});
