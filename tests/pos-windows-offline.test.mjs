import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Windows POS is isolated as an Electron and SQLite module",async()=>{
  const pkg=JSON.parse(await readFile("desktop/package.json","utf8")),db=await readFile("desktop/src/database.mjs","utf8");
  assert.equal(pkg.main,"src/main.mjs");assert.ok(pkg.devDependencies.electron);assert.ok(pkg.dependencies["electron-updater"]);
  for(const term of ["DatabaseSync","journal_mode=WAL","synchronous=FULL","BEGIN IMMEDIATE","local_sales","outbox","conflicts","print_jobs","integrity_check"])
    assert.match(db,new RegExp(term));
});

test("terminal identity and synchronization are authenticated and idempotent",async()=>{
  const migration=await readFile("drizzle/0019_pos_windows_offline.sql","utf8"),api=await readFile("app/api/desktop-sync/route.ts","utf8"),organization=await readFile("app/api/organization/route.ts","utf8");
  for(const term of ["desktop_terminal_credentials_token_uq","desktop_sync_operations_terminal_operation_uq","desktop_sync_operations_status_idx"])
    assert.match(migration,new RegExp(term));
  assert.match(organization,/crypto\.subtle\.digest\("SHA-256"/);assert.match(organization,/terminal_user_access/);
  assert.match(api,/authorization/);assert.match(api,/previous/);assert.match(api,/duplicate:true/);assert.match(api,/POST as createSale/);assert.match(api,/sync_conflicts/);
});

test("thermal peripherals and signed update configuration are present",async()=>{
  const db=await readFile("desktop/src/database.mjs","utf8"),main=await readFile("desktop/src/main.mjs","utf8"),pkg=JSON.parse(await readFile("desktop/package.json","utf8"));
  assert.match(db,/\$\{esc\}p\\x00/);assert.match(db,/\\x1dV\\x00/);assert.match(main,/autoUpdater\.checkForUpdates/);assert.match(main,/autoUpdater\.quitAndInstall/);
  assert.equal(pkg.build.win.verifyUpdateCodeSignature,true);assert.equal(pkg.build.win.signtoolOptions.publisherName,"POS360");
});
