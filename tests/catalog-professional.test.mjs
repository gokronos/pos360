import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("catalog migration includes every professional structure", async () => {
  const source = await readFile(
    new URL("../drizzle/0012_catalogo_profesional.sql", import.meta.url),
    "utf8",
  );
  for (const table of [
    "catalog_categories",
    "brands",
    "measurement_units",
    "product_barcodes",
    "product_variants",
    "price_lists",
    "product_prices",
    "catalog_images",
  ])
    assert.match(source, new RegExp(`CREATE TABLE \`${table}\``));
  for (const column of ["price_minor", "cost_minor", "total_minor"])
    assert.match(source, new RegExp(`\`${column}\` integer`));
});

test("money parser accepts at most two decimals and returns minor units", async () => {
  const source = await readFile(
    new URL("../db/money.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /\.padEnd\(2, "0"\)/);
  assert.match(source, /Number\.isSafeInteger/);
  assert.match(source, /multiplyMoney/);
  assert.doesNotMatch(source, /parseFloat/);
});

test("sales use exact catalog values and skip inventory for services", async () => {
  const source = await readFile(
    new URL("../app/api/sales/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /price_minor.*priceMinor/);
  assert.match(source, /multiplyMoney/);
  assert.match(source, /amount_minor/);
  assert.match(source, /filter\(\(l\) => l\.trackInventory\)/);
});

test("catalog UI covers classifications, variants, images and sector fields", async () => {
  const source = await readFile(
    new URL("../app/catalog-manager.tsx", import.meta.url),
    "utf8",
  );
  for (const term of [
    "Subcategoría",
    "Marcas",
    "Unidades",
    "Impuestos",
    "Listas de precios",
    "Variantes",
    "Imágenes",
    "specialFields",
  ])
    assert.match(source, new RegExp(term));
});
