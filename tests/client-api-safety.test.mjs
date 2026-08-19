import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("client components do not parse API responses directly", async () => {
  const app = new URL("../app/", import.meta.url);
  const files = (await readdir(app)).filter((file) => file.endsWith(".tsx"));
  for (const file of files) {
    const source = await readFile(new URL(file, app), "utf8");
    const directParsers = source.match(/await\s+[A-Za-z_$][\w$]*\.json\(\)/g) || [];
    assert.deepEqual(directParsers, [], `${file} debe usar apiJson/readJson`);
  }
});

test("the shared API reader handles empty, invalid and failed responses", async () => {
  const source = await readFile(new URL("../app/api-client.ts", import.meta.url), "utf8");
  assert.match(source, /const text = await response\.text\(\)/);
  assert.match(source, /if \(!response\.ok\)/);
  assert.match(source, /El servidor devolvió una respuesta inválida/);
});
