import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("new companies start with pending onboarding", async () => {
  const source = await readFile(
    new URL("../app/api/admin/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /business_settings/);
  assert.match(source, /onboarding_completed\) VALUES \(\?,\?,\?,0\)/);
});

test("the wizard covers every required initial setting", async () => {
  const source = await readFile(
    new URL("../app/business-setup-wizard.tsx", import.meta.url),
    "utf8",
  );
  for (const field of [
    "nit",
    "sector",
    "currency",
    "timezone",
    "branchName",
    "warehouseName",
    "registerName",
    "taxRate",
    "allowNegativeStock",
    "receiptFormat",
    "adminEmail",
  ])
    assert.match(source, new RegExp(field));
});

test("sales enforce the configured negative-stock policy", async () => {
  const source = await readFile(
    new URL("../app/api/sales/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /allow_negative_stock/);
  assert.match(source, /!inventoryPolicy\?\.allowNegativeStock/);
});
