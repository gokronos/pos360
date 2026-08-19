import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
const read=path=>readFile(new URL(path,import.meta.url),"utf8");

test("platform owner data is separated from business roles",async()=>{
  const [migration,auth]=await Promise.all([read("../drizzle/0021_panel_propietario_pos360.sql"),read("../db/authz.ts")]);
  assert.match(migration,/CREATE TABLE platform_admins/);
  assert.match(auth,/platform_admins WHERE email=\?/);
  const ownerModules=auth.slice(auth.indexOf("owner: ["),auth.indexOf("admin: ["));
  assert.doesNotMatch(ownerModules,/"saas"/);
  assert.match(auth,/t\.status!='suspended'/);
});

test("platform has a standalone route outside the business shell",async()=>{
  const page=await read("../app/platform/page.tsx");
  assert.match(page,/platform-shell/);assert.match(page,/PlatformOwner/);assert.doesNotMatch(page,/useAccess/);
});

test("platform schema covers commercial and exceptional-access lifecycle",async()=>{
  const sql=await read("../drizzle/0021_panel_propietario_pos360.sql");
  for(const table of ["saas_plans","tenant_subscriptions","platform_support_tickets","platform_access_grants","platform_audit_logs"])assert.match(sql,new RegExp(`CREATE TABLE ${table}`));
  assert.match(sql,/trial_ends_at/);assert.match(sql,/limit_overrides/);assert.match(sql,/expires_at text NOT NULL/);
});

test("platform API provides monitoring and audits every privileged mutation",async()=>{
  const api=await read("../app/api/platform/route.ts");
  for(const term of ["desktop_sync_operations","syncConflicts","support_ticket","exceptional_access","suspend","reactivate","platform_audit_logs"])assert.match(api,new RegExp(term));
  assert.match(api,/mínimo 12 caracteres/);assert.match(api,/Math\.min\(120/);
});

test("subscription limits are enforced by operational creation APIs",async()=>{
  const [limits,admin,organization,catalog]=await Promise.all([read("../db/subscription.ts"),read("../app/api/admin/route.ts"),read("../app/api/organization/route.ts"),read("../app/api/catalog/route.ts")]);
  for(const kind of ["branches","users","terminals","products"])assert.match(limits,new RegExp(`${kind}:`));
  assert.match(admin,/checkSubscriptionLimit\(p\.tenantId,"branches"\)/);assert.match(admin,/checkSubscriptionLimit\(p\.tenantId,"users"\)/);assert.match(organization,/checkSubscriptionLimit\(T,"terminals"\)/);assert.match(catalog,/checkSubscriptionLimit\(T,"products"\)/);
});
