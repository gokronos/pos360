import { getRuntimeEnv } from "../../../db/runtime-env";
import { requireAccess } from "../../../db/authz";
export async function GET(req: Request) {
  const access = await requireAccess(req, "inventory");
  if (access.error) return access.error;
  const url = new URL(req.url),
    productId = url.searchParams.get("productId"),
    d = getRuntimeEnv().DB;
  const base =
      "SELECT m.id,m.movement_type movementType,m.quantity,m.balance_after balanceAfter,m.reason,m.reference,m.created_at createdAt,p.name productName,u.display_name userName FROM inventory_movements m JOIN products p ON p.id=m.product_id JOIN app_users u ON u.id=m.user_id WHERE m.tenant_id=?",
    result = productId
      ? await d
          .prepare(
            base + " AND m.product_id=? ORDER BY m.created_at DESC LIMIT 100",
          )
          .bind(access.user.tenantId, productId)
          .all()
      : await d
          .prepare(base + " ORDER BY m.created_at DESC LIMIT 100")
          .bind(access.user.tenantId)
          .all();
  return Response.json({ movements: result.results });
}
