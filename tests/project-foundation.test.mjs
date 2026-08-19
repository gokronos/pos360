import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("bootstrap only reads application state", async () => {
  const source = await readFile(
    new URL("../app/api/bootstrap/route.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /CREATE TABLE/i);
  assert.doesNotMatch(source, /INSERT OR IGNORE/i);
});

test("local database setup includes every ordered migration and demo seed", async () => {
  const files = (await readdir(new URL("../drizzle/", import.meta.url)))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  assert.equal(files.length, 12);
  assert.match(files[0], /^0000_/);
  assert.match(files.at(-1), /^0011_/);
  const script = await readFile(
    new URL("../scripts/db-local.sh", import.meta.url),
    "utf8",
  );
  assert.match(script, /drizzle\/\*\.sql/);
  assert.match(script, /db\/demo-data\.sql/);
});

test("hosting and Wrangler use the DB binding", async () => {
  const hosting = JSON.parse(
    await readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  );
  const wrangler = await readFile(
    new URL("../wrangler.jsonc", import.meta.url),
    "utf8",
  );
  assert.equal(hosting.d1, "DB");
  assert.match(wrangler, /"binding": "DB"/);
});
