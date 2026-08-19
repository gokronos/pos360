import { randomUUID } from "node:crypto";
import { getRuntimeEnv } from "../../../db/runtime-env";
import { requireAccess } from "../../../db/authz";
import { moneyToMajor, parseMoney } from "../../../db/money";
export async function GET(req: Request) {
  const access = await requireAccess(req, "inventory");
  if (access.error) return access.error;
  const d = getRuntimeEnv().DB,
    url = new URL(req.url),
    q = `%${(url.searchParams.get("q") || "").trim()}%`,
    priceListId = url.searchParams.get("priceListId") || "";
  if (priceListId) {
    const list = await d
      .prepare(
        "SELECT id FROM price_lists WHERE id=? AND tenant_id=? AND active=1",
      )
      .bind(priceListId, access.user.tenantId)
      .first();
    if (!list)
      return Response.json(
        { error: "La lista de precios no pertenece a la empresa" },
        { status: 403 },
      );
  }
  const rows = await d
    .prepare(
      "SELECT id,sku,barcode,name,category,COALESCE((SELECT pp.price_minor FROM product_prices pp WHERE pp.product_id=products.id AND pp.price_list_id=? AND pp.variant_id IS NULL AND pp.min_quantity<=1 ORDER BY pp.min_quantity DESC LIMIT 1),price_minor) priceMinor,cost_minor costMinor,COALESCE((SELECT pp.price_minor FROM product_prices pp WHERE pp.product_id=products.id AND pp.price_list_id=? AND pp.variant_id IS NULL AND pp.min_quantity<=1 ORDER BY pp.min_quantity DESC LIMIT 1),price_minor)/100.0 price,cost_minor/100.0 cost,stock,product_type productType,track_inventory trackInventory,version,active,updated_at updatedAt FROM products WHERE tenant_id=? AND (name LIKE ? OR sku LIKE ? OR barcode LIKE ? OR EXISTS(SELECT 1 FROM product_barcodes bc WHERE bc.product_id=products.id AND bc.code LIKE ?)) ORDER BY active DESC,name LIMIT 200",
    )
    .bind(priceListId, priceListId, access.user.tenantId, q, q, q, q)
    .all();
  const lists = await d
    .prepare(
      "SELECT id,name,currency,is_default isDefault FROM price_lists WHERE tenant_id=? AND active=1 ORDER BY is_default DESC,name",
    )
    .bind(access.user.tenantId)
    .all();
  const tiers = priceListId
    ? await d
        .prepare(
          "SELECT product_id productId,variant_id variantId,price_minor priceMinor,min_quantity minQuantity FROM product_prices WHERE tenant_id=? AND price_list_id=? ORDER BY min_quantity",
        )
        .bind(access.user.tenantId, priceListId)
        .all()
    : { results: [] };
  const variants = await d
    .prepare(
      "SELECT v.id,v.product_id productId,v.name,v.sku,v.attributes,v.price_minor priceMinor,v.cost_minor costMinor,v.stock,v.active,(SELECT GROUP_CONCAT(code,',') FROM product_barcodes b WHERE b.variant_id=v.id) barcodeList FROM product_variants v WHERE v.tenant_id=? AND v.active=1 ORDER BY v.name",
    )
    .bind(access.user.tenantId)
    .all();
  return Response.json({
    products: rows.results.map((product) => ({
      ...product,
      priceTiers: tiers.results.filter(
        (tier) => tier.productId === product.id && !tier.variantId,
      ),
      variants: variants.results
        .filter((variant) => variant.productId === product.id)
        .map((variant) => ({
          ...variant,
          price: Number(variant.priceMinor) / 100,
          barcodes: String(variant.barcodeList || "")
            .split(",")
            .filter(Boolean),
          priceTiers: tiers.results.filter(
            (tier) => tier.variantId === variant.id,
          ),
        })),
    })),
    priceLists: lists.results,
  });
}
export async function POST(req: Request) {
  const access = await requireAccess(req, "inventory", "create");
  if (access.error) return access.error;
  const p = (await req.json()) as {
    sku?: string;
    barcode?: string;
    name?: string;
    category?: string;
    price?: number | string;
    cost?: number | string;
    stock?: number;
  };
  if (
    !p.sku?.trim() ||
    !p.name?.trim() ||
    !p.category?.trim() ||
    p.price === undefined ||
    p.cost === undefined
  )
    return Response.json(
      { error: "Complete los campos obligatorios" },
      { status: 400 },
    );
  let priceMinor: number, costMinor: number;
  try {
    priceMinor = parseMoney(p.price);
    costMinor = parseMoney(p.cost);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Valor inválido" },
      { status: 400 },
    );
  }
  if (priceMinor < 0 || costMinor < 0)
    return Response.json({ error: "Precio o costo inválido" }, { status: 400 });
  const d = getRuntimeEnv().DB,
    id = randomUUID(),
    stock = Number(p.stock || 0),
    uid = access.user.id,
    T = access.user.tenantId,
    B = access.user.branchId;
  try {
    await d.batch([
      d
        .prepare(
          "INSERT INTO products (id,tenant_id,sku,barcode,name,category,price,cost,stock,price_minor,cost_minor) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          T,
          p.sku.trim(),
          p.barcode?.trim() || null,
          p.name.trim(),
          p.category.trim(),
          moneyToMajor(priceMinor),
          moneyToMajor(costMinor),
          stock,
          priceMinor,
          costMinor,
        ),
      d
        .prepare(
          "INSERT INTO inventory_movements (id,tenant_id,branch_id,product_id,user_id,movement_type,quantity,balance_after,reason,reference) VALUES (?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          randomUUID(),
          T,
          B,
          id,
          uid,
          "initial",
          stock,
          stock,
          "Inventario inicial",
          p.sku.trim(),
        ),
    ]);
    return Response.json(
      {
        product: {
          id,
          ...p,
          price: moneyToMajor(priceMinor),
          cost: moneyToMajor(costMinor),
          priceMinor,
          costMinor,
          stock,
          active: 1,
          version: 1,
        },
      },
      { status: 201 },
    );
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof Error && e.message.includes("UNIQUE")
            ? "El SKU ya existe"
            : "No fue posible crear el producto",
      },
      { status: 409 },
    );
  }
}
export async function PATCH(req: Request) {
  const access = await requireAccess(req, "inventory", "edit");
  if (access.error) return access.error;
  const p = (await req.json()) as {
    id?: string;
    sku?: string;
    barcode?: string;
    name?: string;
    category?: string;
    price?: number | string;
    cost?: number | string;
    active?: boolean;
    adjustment?: number;
    reason?: string;
    version?: number;
    deviceId?: string;
  };
  if (!p.id)
    return Response.json({ error: "Producto requerido" }, { status: 400 });
  const T = access.user.tenantId,
    B = access.user.branchId,
    d = getRuntimeEnv().DB,
    current = await d
      .prepare("SELECT * FROM products WHERE id=? AND tenant_id=?")
      .bind(p.id, T)
      .first<{ stock: number; version: number }>();
  if (!current)
    return Response.json({ error: "Producto no encontrado" }, { status: 404 });
  if (p.version !== undefined && p.version !== current.version) {
    const conflictId = randomUUID();
    await d
      .prepare(
        "INSERT INTO sync_conflicts (id,tenant_id,entity_type,entity_id,device_id,local_version,server_version,payload,status) VALUES (?,?,?,?,?,?,?,?,?)",
      )
      .bind(
        conflictId,
        T,
        "product",
        p.id,
        p.deviceId || "unknown",
        p.version,
        current.version,
        JSON.stringify(p),
        "pending",
      )
      .run();
    return Response.json(
      {
        error: "El producto cambió en otra sede",
        conflict: true,
        conflictId,
        serverVersion: current.version,
      },
      { status: 409 },
    );
  }
  const adjustment = Number(p.adjustment || 0),
    nextStock = current.stock + adjustment;
  if (nextStock < 0)
    return Response.json(
      { error: "El ajuste dejaría existencias negativas" },
      { status: 400 },
    );
  const sets: string[] = [],
    values: unknown[] = [];
  for (const [key, col] of [
    ["sku", "sku"],
    ["barcode", "barcode"],
    ["name", "name"],
    ["category", "category"],
  ] as const) {
    if (p[key] !== undefined) {
      sets.push(`${col}=?`);
      values.push(p[key]);
    }
  }
  for (const [key, legacy, minorColumn] of [
    ["price", "price", "price_minor"],
    ["cost", "cost", "cost_minor"],
  ] as const) {
    if (p[key] !== undefined) {
      try {
        const minor = parseMoney(p[key]);
        if (minor < 0) throw new Error("El valor no puede ser negativo");
        sets.push(`${legacy}=?`, `${minorColumn}=?`);
        values.push(moneyToMajor(minor), minor);
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "Valor inválido" },
          { status: 400 },
        );
      }
    }
  }
  if (p.active !== undefined) {
    sets.push("active=?");
    values.push(p.active ? 1 : 0);
  }
  if (adjustment) {
    sets.push("stock=?");
    values.push(nextStock);
  }
  sets.push("version=version+1", "updated_at=CURRENT_TIMESTAMP");
  values.push(p.id, T);
  const statements = [
    d
      .prepare(
        `UPDATE products SET ${sets.join(",")} WHERE id=? AND tenant_id=?`,
      )
      .bind(...values),
  ];
  if (adjustment)
    statements.push(
      d
        .prepare(
          "INSERT INTO inventory_movements (id,tenant_id,branch_id,product_id,user_id,movement_type,quantity,balance_after,reason,reference) VALUES (?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          randomUUID(),
          T,
          B,
          p.id,
          access.user.id,
          adjustment > 0 ? "adjustment_in" : "adjustment_out",
          adjustment,
          nextStock,
          p.reason?.trim() || "Ajuste manual",
          `AJ-${Date.now()}`,
        ),
    );
  await d.batch(statements);
  const updated = await d
    .prepare(
      "SELECT id,sku,barcode,name,category,price_minor priceMinor,cost_minor costMinor,price_minor/100.0 price,cost_minor/100.0 cost,stock,version,active,updated_at updatedAt FROM products WHERE id=?",
    )
    .bind(p.id)
    .first();
  return Response.json({ product: updated });
}
