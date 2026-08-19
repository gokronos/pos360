import { randomUUID } from "node:crypto";
import { requireAccess } from "../../../db/authz";
import { getRuntimeEnv } from "../../../db/runtime-env";

const countries: Record<string, { currency: string; timezone: string }> = {
  CO: { currency: "COP", timezone: "America/Bogota" },
  MX: { currency: "MXN", timezone: "America/Mexico_City" },
  PE: { currency: "PEN", timezone: "America/Lima" },
  EC: { currency: "USD", timezone: "America/Guayaquil" },
  US: { currency: "USD", timezone: "America/New_York" },
};
const receiptFormats = ["thermal_58", "thermal_80", "letter"];
const currencies = ["COP", "USD", "MXN", "PEN", "EUR"];
const timezones = [
  "America/Bogota",
  "America/Mexico_City",
  "America/Lima",
  "America/Guayaquil",
  "America/New_York",
  "America/Los_Angeles",
];

export async function GET(req: Request) {
  const access = await requireAccess(req, "settings");
  if (access.error) return access.error;
  const d = getRuntimeEnv().DB,
    T = access.user.tenantId;
  const [business, taxes] = await Promise.all([
    d
      .prepare(
        "SELECT t.name,t.country,s.nit,s.sector,s.currency,s.timezone,s.allow_negative_stock allowNegativeStock,s.receipt_format receiptFormat,s.onboarding_completed completed,b.name branchName,w.name warehouseName,r.name registerName FROM tenants t LEFT JOIN business_settings s ON s.tenant_id=t.id LEFT JOIN branches b ON b.id=s.main_branch_id LEFT JOIN warehouses w ON w.id=s.main_warehouse_id LEFT JOIN cash_registers r ON r.id=s.main_register_id WHERE t.id=?",
      )
      .bind(T)
      .first(),
    d
      .prepare(
        "SELECT id,name,rate,included_in_price includedInPrice,active FROM tax_rates WHERE tenant_id=? ORDER BY rate DESC,name",
      )
      .bind(T)
      .all(),
  ]);
  return Response.json({ business, taxes: taxes.results, actor: access.user });
}

export async function POST(req: Request) {
  const access = await requireAccess(req, "settings", "edit");
  if (access.error) return access.error;
  if (!["owner", "admin"].includes(access.user.role))
    return Response.json(
      {
        error:
          "Solo un propietario o administrador puede completar la configuración",
      },
      { status: 403 },
    );
  const body = (await req.json()) as {
      name?: string;
      nit?: string;
      sector?: string;
      country?: string;
      currency?: string;
      timezone?: string;
      branchName?: string;
      warehouseName?: string;
      registerName?: string;
      taxName?: string;
      taxRate?: number;
      taxIncluded?: boolean;
      allowNegativeStock?: boolean;
      receiptFormat?: string;
      adminName?: string;
      adminEmail?: string;
    },
    required = [
      body.name,
      body.nit,
      body.sector,
      body.country,
      body.currency,
      body.timezone,
      body.branchName,
      body.warehouseName,
      body.registerName,
      body.taxName,
      body.adminName,
      body.adminEmail,
    ];
  if (required.some((value) => !String(value || "").trim()))
    return Response.json(
      { error: "Complete todos los campos obligatorios del asistente" },
      { status: 400 },
    );
  if (!countries[body.country!] || !currencies.includes(body.currency || ""))
    return Response.json({ error: "País o moneda inválidos" }, { status: 400 });
  if (!timezones.includes(body.timezone || ""))
    return Response.json({ error: "Zona horaria inválida" }, { status: 400 });
  if (!receiptFormats.includes(body.receiptFormat || ""))
    return Response.json(
      { error: "Formato de recibo inválido" },
      { status: 400 },
    );
  const taxRate = Number(body.taxRate);
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100)
    return Response.json(
      { error: "La tarifa del impuesto debe estar entre 0 y 100" },
      { status: 400 },
    );

  const d = getRuntimeEnv().DB,
    T = access.user.tenantId,
    branch = await d
      .prepare("SELECT id FROM branches WHERE id=? AND tenant_id=?")
      .bind(access.user.branchId, T)
      .first<{ id: string }>();
  if (!branch)
    return Response.json(
      { error: "La sede principal no está disponible" },
      { status: 409 },
    );
  const existing = await d
    .prepare(
      "SELECT id,main_warehouse_id warehouseId,main_register_id registerId FROM business_settings WHERE tenant_id=?",
    )
    .bind(T)
    .first<{
      id: string;
      warehouseId: string | null;
      registerId: string | null;
    }>();
  const warehouseId = existing?.warehouseId || randomUUID(),
    registerId = existing?.registerId || randomUUID(),
    terminalId = `terminal_${registerId}`,
    normalizedEmail = body.adminEmail!.trim().toLowerCase(),
    admin = await d
      .prepare("SELECT id FROM app_users WHERE tenant_id=? AND email=?")
      .bind(T, normalizedEmail)
      .first<{ id: string }>(),
    adminId = admin?.id || randomUUID();

  const stmts = [
    d
      .prepare("UPDATE tenants SET name=?,country=? WHERE id=?")
      .bind(body.name!.trim(), body.country, T),
    d
      .prepare("UPDATE branches SET name=? WHERE id=? AND tenant_id=?")
      .bind(body.branchName!.trim(), branch.id, T),
    existing?.warehouseId
      ? d
          .prepare(
            "UPDATE warehouses SET name=?,active=1 WHERE id=? AND tenant_id=?",
          )
          .bind(body.warehouseName!.trim(), warehouseId, T)
      : d
          .prepare(
            "INSERT INTO warehouses (id,tenant_id,branch_id,name,code,active) VALUES (?,?,?,?,?,1)",
          )
          .bind(
            warehouseId,
            T,
            branch.id,
            body.warehouseName!.trim(),
            "PRINCIPAL",
          ),
    existing?.registerId
      ? d
          .prepare(
            "UPDATE cash_registers SET name=?,active=1 WHERE id=? AND tenant_id=?",
          )
          .bind(body.registerName!.trim(), registerId, T)
      : d
          .prepare(
            "INSERT INTO cash_registers (id,tenant_id,branch_id,name,active) VALUES (?,?,?,?,1)",
          )
          .bind(registerId, T, branch.id, body.registerName!.trim()),
    d.prepare("DELETE FROM tax_rates WHERE tenant_id=?").bind(T),
    d
      .prepare(
        "INSERT INTO tax_rates (id,tenant_id,name,rate,included_in_price,active) VALUES (?,?,?,?,?,1)",
      )
      .bind(
        randomUUID(),
        T,
        body.taxName!.trim(),
        taxRate,
        Number(body.taxIncluded !== false),
      ),
    d
      .prepare(
        "INSERT OR IGNORE INTO measurement_units (id,tenant_id,name,symbol,precision) VALUES (?,?,?,'und',0)",
      )
      .bind(randomUUID(), T, "Unidad"),
    d
      .prepare(
        "INSERT OR IGNORE INTO price_lists (id,tenant_id,name,currency,is_default) VALUES (?,?,?, ?,1)",
      )
      .bind(randomUUID(), T, "Precio general", body.currency),
  ];
  if (admin)
    stmts.push(
      d
        .prepare(
          "UPDATE app_users SET display_name=?,role=CASE WHEN role='owner' THEN role ELSE 'admin' END,active=1 WHERE id=? AND tenant_id=?",
        )
        .bind(body.adminName!.trim(), adminId, T),
    );
  else {
    stmts.push(
      d
        .prepare(
          "INSERT INTO app_users (id,tenant_id,email,display_name,role,active) VALUES (?,?,?,?, 'admin',1)",
        )
        .bind(adminId, T, normalizedEmail, body.adminName!.trim()),
      d
        .prepare(
          "INSERT INTO user_branch_access (id,tenant_id,user_id,branch_id) VALUES (?,?,?,?)",
        )
        .bind(randomUUID(), T, adminId, branch.id),
    );
  }
  stmts.push(
    d
      .prepare(
        "INSERT OR IGNORE INTO user_branch_access (id,tenant_id,user_id,branch_id) VALUES (?,?,?,?)",
      )
      .bind(randomUUID(), T, adminId, branch.id),
    d
      .prepare(
        "INSERT OR IGNORE INTO terminals (id,tenant_id,branch_id,register_id,name,code,status) VALUES (?,?,?,?,?,?,'active')",
      )
      .bind(
        terminalId,
        T,
        branch.id,
        registerId,
        `Terminal ${body.registerName!.trim()}`,
        `TERM-${registerId.slice(0, 12)}`,
      ),
    d
      .prepare(
        "INSERT OR IGNORE INTO terminal_user_access (id,tenant_id,terminal_id,user_id,active,granted_by) VALUES (?,?,?,?,1,?)",
      )
      .bind(randomUUID(), T, terminalId, adminId, access.user.id),
    d
      .prepare(
        "INSERT INTO business_settings (id,tenant_id,nit,sector,currency,timezone,allow_negative_stock,receipt_format,main_branch_id,main_warehouse_id,main_register_id,onboarding_completed,completed_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(tenant_id) DO UPDATE SET nit=excluded.nit,sector=excluded.sector,currency=excluded.currency,timezone=excluded.timezone,allow_negative_stock=excluded.allow_negative_stock,receipt_format=excluded.receipt_format,main_branch_id=excluded.main_branch_id,main_warehouse_id=excluded.main_warehouse_id,main_register_id=excluded.main_register_id,onboarding_completed=1,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP",
      )
      .bind(
        existing?.id || randomUUID(),
        T,
        body.nit!.trim(),
        body.sector,
        body.currency,
        body.timezone,
        Number(Boolean(body.allowNegativeStock)),
        body.receiptFormat,
        branch.id,
        warehouseId,
        registerId,
      ),
    d
      .prepare(
        "INSERT INTO audit_logs (id,tenant_id,user_id,action,entity_type,entity_id,details) VALUES (?,?,?,?,?,?,?)",
      )
      .bind(
        randomUUID(),
        T,
        access.user.id,
        "complete",
        "business_onboarding",
        T,
        "Configuración inicial completada",
      ),
  );
  try {
    await d.batch(stmts);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No fue posible guardar la configuración",
      },
      { status: 409 },
    );
  }
  return Response.json({
    completed: true,
    branchId: branch.id,
    warehouseId,
    registerId,
    adminId,
  });
}
