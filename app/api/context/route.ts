import { getAccess } from "../../../db/authz";
import { getRuntimeEnv } from "../../../db/runtime-env";
import { randomUUID } from "node:crypto";

export async function POST(req: Request) {
  const body = (await req.json()) as { tenantId?: string; branchId?: string };
  if (!body.tenantId || !body.branchId)
    return Response.json(
      { error: "Empresa y sede requeridas" },
      { status: 400 },
    );
  const access = await getAccess(req, body.tenantId, body.branchId);
  if (!access)
    return Response.json(
      { error: "No tiene acceso a la empresa o sede seleccionada" },
      { status: 403 },
    );
  await getRuntimeEnv()
    .DB.prepare(
      "INSERT INTO audit_logs (id,tenant_id,user_id,action,entity_type,entity_id,details) VALUES (?,?,?,?,?,?,?)",
    )
    .bind(
      randomUUID(),
      access.tenantId,
      access.id,
      "select_context",
      "branch",
      access.branchId,
      "Empresa y sede activas seleccionadas",
    )
    .run();
  const headers = new Headers({ "content-type": "application/json" });
  headers.append(
    "set-cookie",
    `pos360_tenant=${encodeURIComponent(access.tenantId)}; Path=/; HttpOnly; SameSite=Strict`,
  );
  headers.append(
    "set-cookie",
    `pos360_branch=${encodeURIComponent(access.branchId)}; Path=/; HttpOnly; SameSite=Strict`,
  );
  return new Response(
    JSON.stringify({ tenantId: access.tenantId, branchId: access.branchId }),
    { headers },
  );
}
