import { getRuntimeEnv } from "./runtime-env";

export const roles = [
  "owner",
  "admin",
  "supervisor",
  "cashier",
  "purchasing",
  "warehouse",
  "auditor",
] as const;
export type AppRole = (typeof roles)[number];
export type PermissionAction = "view" | "create" | "edit" | "delete";
export const roleModules: Record<AppRole, string[]> = {
  owner: [
    "dashboard",
    "pos",
    "inventory",
    "purchases",
    "customers",
    "reports",
    "settings",
    "saas",
    "users",
  ],
  admin: [
    "dashboard",
    "pos",
    "inventory",
    "purchases",
    "customers",
    "reports",
    "settings",
    "users",
  ],
  supervisor: [
    "dashboard",
    "pos",
    "inventory",
    "purchases",
    "customers",
    "reports",
  ],
  cashier: ["dashboard", "pos", "customers"],
  purchasing: ["dashboard", "inventory", "purchases", "reports"],
  warehouse: ["dashboard", "inventory", "purchases"],
  auditor: ["dashboard", "purchases", "customers", "reports"],
};
export type AccessUser = {
  id: string;
  email: string;
  displayName: string;
  role: AppRole;
  active: number;
  tenantId: string;
  branchId: string;
  modules: string[];
};
const emailOf = (req: Request) =>
  req.headers.get("oai-authenticated-user-email") || "preview@pos360.local";
const cookiesOf = (req: Request) =>
  Object.fromEntries(
    (req.headers.get("cookie") || "")
      .split(";")
      .map((part) => part.trim().split(/=(.*)/s).slice(0, 2))
      .filter(([key]) => key),
  );

export async function getAccess(
  req: Request,
  explicitTenant?: string,
  explicitBranch?: string,
) {
  const d = getRuntimeEnv().DB,
    cookies = cookiesOf(req),
    email = emailOf(req);
  const wantedTenant =
    explicitTenant ||
    req.headers.get("x-pos360-tenant-id") ||
    cookies.pos360_tenant ||
    null;
  const user = await d
    .prepare(
      `SELECT id,email,display_name displayName,role,active,tenant_id tenantId FROM app_users WHERE email=? AND active=1 AND (? IS NULL OR tenant_id=?) ORDER BY created_at LIMIT 1`,
    )
    .bind(email, wantedTenant, wantedTenant)
    .first<Omit<AccessUser, "branchId" | "modules">>();
  if (!user || !roles.includes(user.role)) return null;
  const wantedBranch =
    explicitBranch ||
    req.headers.get("x-pos360-branch-id") ||
    cookies.pos360_branch ||
    null;
  const branch = await d
    .prepare(
      `SELECT b.id FROM branches b WHERE b.tenant_id=? AND (? IS NULL OR b.id=?) AND (NOT EXISTS(SELECT 1 FROM user_branch_access x WHERE x.user_id=?) OR EXISTS(SELECT 1 FROM user_branch_access x WHERE x.user_id=? AND x.branch_id=b.id)) ORDER BY b.created_at LIMIT 1`,
    )
    .bind(user.tenantId, wantedBranch, wantedBranch, user.id, user.id)
    .first<{ id: string }>();
  if (!branch) return null;
  return { ...user, branchId: branch.id, modules: roleModules[user.role] };
}

export async function requireAccess(
  req: Request,
  moduleName: string,
  action: PermissionAction = "view",
) {
  const user = await getAccess(req);
  if (!user)
    return {
      error: Response.json(
        { error: "Usuario sin acceso a la empresa o sede solicitada" },
        { status: 403 },
      ),
    };
  if (!user.modules.includes(moduleName))
    return {
      error: Response.json(
        { error: `Su rol no tiene permiso para ${moduleName}` },
        { status: 403 },
      ),
    };
  const permission = await getRuntimeEnv()
    .DB.prepare(
      "SELECT can_view canView,can_create canCreate,can_edit canEdit,can_delete canDelete FROM role_permissions WHERE tenant_id=? AND role=? AND module=?",
    )
    .bind(user.tenantId, user.role, moduleName)
    .first<Record<string, number>>();
  const column = {
    view: "canView",
    create: "canCreate",
    edit: "canEdit",
    delete: "canDelete",
  }[action];
  if (permission && !permission[column])
    return {
      error: Response.json(
        { error: `No tiene permiso para ${action} en ${moduleName}` },
        { status: 403 },
      ),
    };
  return { user };
}
