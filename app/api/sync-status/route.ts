import { getRuntimeEnv } from "../../../db/runtime-env";
import { requireAccess } from "../../../db/authz";
export async function GET(req: Request) {
  const access = await requireAccess(req, "settings");
  if (access.error) return access.error;
  const T = access.user.tenantId,
    d = getRuntimeEnv().DB,
    [events, conflicts, summary] = await Promise.all([
      d
        .prepare(
          "SELECT event_type eventType,entity_id entityId,node_id deviceId,status,created_at createdAt FROM sync_events WHERE tenant_id=? ORDER BY created_at DESC LIMIT 30",
        )
        .bind(T)
        .all(),
      d
        .prepare(
          "SELECT id,entity_type entityType,entity_id entityId,device_id deviceId,local_version localVersion,server_version serverVersion,status,resolution,created_at createdAt FROM sync_conflicts WHERE tenant_id=? ORDER BY CASE WHEN status='pending' THEN 0 ELSE 1 END,created_at DESC LIMIT 30",
        )
        .bind(T)
        .all(),
      d
        .prepare(
          "SELECT COUNT(*) totalEvents,COUNT(DISTINCT node_id) devices,MAX(created_at) lastSync FROM sync_events WHERE tenant_id=?",
        )
        .bind(T)
        .first(),
    ]);
  return Response.json({
    events: events.results,
    conflicts: conflicts.results,
    summary,
  });
}
export async function PATCH(req: Request) {
  const access = await requireAccess(req, "settings", "edit");
  if (access.error) return access.error;
  const T = access.user.tenantId,
    p = (await req.json()) as {
      id?: string;
      resolution?: "server" | "local";
    };
  if (!p.id || !p.resolution)
    return Response.json(
      { error: "Conflicto y resolución requeridos" },
      { status: 400 },
    );
  const d = getRuntimeEnv().DB,
    c = await d
      .prepare(
        "SELECT * FROM sync_conflicts WHERE id=? AND tenant_id=? AND status='pending'",
      )
      .bind(p.id, T)
      .first<{ entity_type: string; entity_id: string; payload: string }>();
  if (!c)
    return Response.json({ error: "Conflicto no encontrado" }, { status: 404 });
  if (p.resolution === "local" && c.entity_type === "product") {
    const payload = JSON.parse(c.payload) as {
      adjustment?: number;
      reason?: string;
    };
    if (payload.adjustment) {
      const product = await d
        .prepare("SELECT stock FROM products WHERE id=?")
        .bind(c.entity_id)
        .first<{ stock: number }>();
      if (product) {
        const next = Math.max(0, product.stock + Number(payload.adjustment));
        await d
          .prepare(
            "UPDATE products SET stock=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?",
          )
          .bind(next, c.entity_id)
          .run();
      }
    }
  }
  await d
    .prepare(
      "UPDATE sync_conflicts SET status='resolved',resolution=?,resolved_at=CURRENT_TIMESTAMP WHERE id=?",
    )
    .bind(p.resolution, p.id)
    .run();
  return Response.json({ resolved: true });
}
