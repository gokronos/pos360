import { getRuntimeEnv } from "../../../db/runtime-env";
import { getAccess } from "../../../db/authz";
const env = {
  get DB() {
    return getRuntimeEnv().DB;
  },
};
export async function GET(req: Request) {
  const d = env.DB,
    user = await getAccess(req);
  if (!user)
    return Response.json({ error: "Usuario sin acceso" }, { status: 403 });
  const data = await d
      .prepare(
        "SELECT id,sku,barcode,name,category,price,cost,stock,version FROM products WHERE tenant_id=? AND active=1 ORDER BY name",
      )
      .bind(user.tenantId)
      .all(),
    stats = await d
      .prepare(
        "SELECT COUNT(*) sales_count, COALESCE(SUM(total),0) sales_total FROM sales WHERE tenant_id=?",
      )
      .bind(user.tenantId)
      .first(),
    branch = await d
      .prepare("SELECT id,name FROM branches WHERE id=? AND tenant_id=?")
      .bind(user.branchId, user.tenantId)
      .first<{ id: string; name: string }>();
  const tenant = await d
    .prepare("SELECT id,name FROM tenants WHERE id=?")
    .bind(user.tenantId)
    .first<{ id: string; name: string }>();
  return Response.json({
    tenant,
    branch,
    user: {
      id: user.id,
      email: user.email,
      name: user.displayName,
      role: user.role,
    },
    modules: user.modules,
    products: data.results,
    stats,
  });
}
