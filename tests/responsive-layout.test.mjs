import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("mobile navigation is accessible and closes after selecting a module", async () => {
  const page = await read("../app/business-app.tsx");
  assert.match(page, /mobileMenuOpen/);
  assert.match(page, /aria-label="Abrir menú principal"/);
  assert.match(page, /aria-label="Cerrar menú principal"/);
  assert.match(page, /mobile-nav-backdrop/);
  assert.match(page, /setMobileMenuOpen\(false\)/);
});

test("the business shell uses the full mobile viewport", async () => {
  const css = await read("../app/globals.css");
  assert.match(css, /\.sidebar nav\{display:flex;flex-direction:column;gap:5px;flex:1;min-height:0;overflow-y:auto/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /\.sidebar\.mobile-open/);
  assert.match(css, /\.sidebar nav\{gap:5px;flex:1;min-height:0;overflow-y:auto/);
  assert.match(css, /\.mobile-nav-close\{display:grid/);
  assert.match(css, /\.workspace,.sidebar\.collapsed~\.workspace\{width:100%;margin-left:0/);
  assert.match(css, /\.table-panel table\{min-width:680px\}/);
  assert.match(css, /\.modal,.compact-modal,.catalog-modal,.thermal-modal\{width:100%/);
});

test("mobile controls meet the touch layout baseline", async () => {
  const css = await read("../app/globals.css");
  assert.match(css, /\.mobile-menu-button\{display:flex;flex:0 0 44px/);
  assert.match(css, /\.modal-actions button\{min-height:44px\}/);
  assert.match(css, /font-size:16px/);
  assert.match(css, /\.pos-layout\{display:flex;flex-direction:column/);
});
