import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const read=path=>readFile(new URL(path,import.meta.url),"utf8");

test("demo identity only exists on local hosts",async()=>{
  const identity=await read("../db/request-identity.ts");
  assert.match(identity,/host==="localhost"/);
  assert.match(identity,/cf-connecting-ip/);
  assert.match(identity,/x-forwarded-host/);
  assert.match(identity,/host\.endsWith\("\.local"\)/);
  assert.match(identity,/if\(!local\)return null/);
});

test("production authorization has no public preview fallback",async()=>{
  const [auth,admin,platform]=await Promise.all([read("../db/authz.ts"),read("../app/api/admin/route.ts"),read("../app/api/platform/route.ts")]);
  assert.doesNotMatch(auth,/\|\| "preview@pos360\.local"/);
  assert.doesNotMatch(admin,/\|\| "preview@pos360\.local"/);
  assert.doesNotMatch(platform,/\|\|"preview@pos360\.local"/);
  assert.match(platform,/Autenticación requerida/);
});

test("desktop and mobile internal operations cannot reopen public header auth",async()=>{
  const [desktop,mobile]=await Promise.all([read("../app/api/desktop-sync/route.ts"),read("../app/api/mobile/route.ts")]);
  assert.match(desktop,/http:\/\/localhost\/api\/sales/);
  assert.match(mobile,/http:\/\/localhost\/api\/purchases/);
});
