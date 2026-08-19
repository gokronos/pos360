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
    .prepare("SELECT id,name,country FROM tenants WHERE id=?")
    .bind(user.tenantId)
    .first<{ id: string; name: string; country: string }>();
  const configuration = await d
    .prepare(
      "SELECT nit,sector,currency,timezone,allow_negative_stock allowNegativeStock,receipt_format receiptFormat,onboarding_completed completed FROM business_settings WHERE tenant_id=?",
    )
    .bind(user.tenantId)
    .first();
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
    configuration: configuration || {
      completed: 0,
      currency: "COP",
      timezone: "America/Bogota",
      receiptFormat: "thermal_80",
      allowNegativeStock: 0,
    },
    products: data.results,
    stats,
  });
}
