import { getRuntimeEnv } from "../../../db/runtime-env";
import { requireAccess } from "../../../db/authz";
export async function GET(req: Request) {
  const access = await requireAccess(req, "reports");
  if (access.error) return access.error;
  const T = access.user.tenantId;
  const d = getRuntimeEnv().DB;
  const summary = await d
    .prepare(
      "SELECT COALESCE(SUM(balance_minor),0)/100.0 payable,COALESCE(SUM(CASE WHEN balance_minor>0 AND due_date<date('now') THEN balance_minor ELSE 0 END),0)/100.0 overdue,COUNT(CASE WHEN balance_minor>0 THEN 1 END) openAccounts,COALESCE(SUM(CASE WHEN created_at>=date('now','start of month') THEN original_amount_minor ELSE 0 END),0)/100.0 monthPurchases FROM payables WHERE tenant_id=?",
    )
    .bind(T)
    .first();
  const aging = await d
    .prepare(
      "SELECT s.name supplier,SUM(p.balance_minor)/100.0 balance,MIN(p.due_date) nextDue,SUM(CASE WHEN p.due_date<date('now') THEN p.balance_minor ELSE 0 END)/100.0 overdue FROM payables p JOIN suppliers s ON s.id=p.supplier_id WHERE p.tenant_id=? AND p.balance_minor>0 GROUP BY s.id,s.name ORDER BY overdue DESC,balance DESC",
    )
    .bind(T)
    .all();
  const returns = await d
    .prepare(
      "SELECT r.reference,r.total_minor/100.0 total,r.reason,r.created_at createdAt,s.name supplier FROM purchase_returns r JOIN suppliers s ON s.id=r.supplier_id WHERE r.tenant_id=? ORDER BY r.created_at DESC LIMIT 20",
    )
    .bind(T)
    .all();
  const credits=await d.prepare("SELECT c.id,s.name supplier,c.amount_minor/100.0 amount,c.balance_minor/100.0 balance,c.reason,c.created_at createdAt FROM supplier_credits c JOIN suppliers s ON s.id=c.supplier_id WHERE c.tenant_id=? AND c.balance_minor>0 ORDER BY c.created_at DESC").bind(T).all();
  return Response.json({
    summary,
    aging: aging.results,
    returns: returns.results,
    credits: credits.results,
  });
}
