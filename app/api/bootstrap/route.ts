import { getRuntimeEnv } from "../../../db/runtime-env";
import { roleModules } from "../../../db/authz";
const env = {
  get DB() {
    return getRuntimeEnv().DB;
  },
};
const TENANT = "tenant_demo",
  BRANCH = "branch_centro";
export async function GET(req: Request) {
  const d = env.DB,
    email =
      req.headers.get("oai-authenticated-user-email") || "preview@pos360.local";
  const user = await d
    .prepare(
      "SELECT id,email,display_name displayName,role,active FROM app_users WHERE tenant_id=? AND email=?",
    )
    .bind(TENANT, email)
    .first<{
      id: string;
      email: string;
      displayName: string;
      role: string;
      active: number;
    }>();
  if (!user || !user.active)
    return Response.json({ error: "Usuario sin acceso" }, { status: 403 });
  const data = await d
      .prepare(
        "SELECT id,sku,barcode,name,category,price,cost,stock,version FROM products WHERE tenant_id=? AND active=1 ORDER BY name",
      )
      .bind(TENANT)
      .all(),
    stats = await d
      .prepare(
        "SELECT COUNT(*) sales_count, COALESCE(SUM(total),0) sales_total FROM sales WHERE tenant_id=?",
      )
      .bind(TENANT)
      .first(),
    branch = await d
      .prepare(
        "SELECT b.id,b.name FROM branches b LEFT JOIN user_branch_access uba ON uba.branch_id=b.id AND uba.user_id=? WHERE b.tenant_id=? ORDER BY CASE WHEN uba.user_id IS NULL THEN 1 ELSE 0 END,b.created_at LIMIT 1",
      )
      .bind(user.id, TENANT)
      .first<{ id: string; name: string }>();
  return Response.json({
    tenant: { id: TENANT, name: "Minimercado La Esquina" },
    branch: branch || { id: BRANCH, name: "Sede Centro" },
    user: {
      id: user.id,
      email: user.email,
      name: user.displayName,
      role: user.role,
    },
    modules: roleModules[user.role] || [],
    products: data.results,
    stats,
  });
}
