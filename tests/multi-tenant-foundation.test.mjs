import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("commercial APIs do not contain demo tenant or branch constants", async () => {
  const root = new URL("../app/api/", import.meta.url),
    dirs = await readdir(root, { withFileTypes: true });
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const route = new URL(`${dir.name}/route.ts`, root);
    let source;
    try {
      source = await readFile(route, "utf8");
    } catch {
      continue;
    }
    assert.doesNotMatch(
      source,
      /tenant_demo|branch_centro|warehouse_main|register_2/,
      `${dir.name} debe usar contexto autorizado`,
    );
  }
});
test("all seven operational roles are defined", async () => {
  const source = await readFile(
    new URL("../db/authz.ts", import.meta.url),
    "utf8",
  );
  for (const role of [
    "owner",
    "admin",
    "supervisor",
    "cashier",
    "purchasing",
    "warehouse",
    "auditor",
  ])
    assert.match(source, new RegExp(`\\b${role}\\b`));
});
test("tenant context cookies are HttpOnly and strict", async () => {
  const source = await readFile(
    new URL("../app/api/context/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /HttpOnly; SameSite=Strict/g);
  assert.match(source, /getAccess\(req, body\.tenantId, body\.branchId\)/);
});
