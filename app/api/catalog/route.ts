import { randomUUID } from "node:crypto";
import { requireAccess } from "../../../db/authz";
import { getRuntimeEnv } from "../../../db/runtime-env";
import { moneyToMajor, parseMoney } from "../../../db/money";
import {checkSubscriptionLimit} from "../../../db/subscription";
import { inventoryMovement, resolveWarehouse } from "../../../db/inventory";

type VariantInput = {
  name?: string;
  sku?: string;
  attributes?: Record<string, string>;
  price?: string | number;
  cost?: string | number;
  stock?: number;
  barcodes?: string[];
};
type PresentationInput = {
  name?: string;
  unitId?: string;
  conversionFactor?: number;
  barcode?: string;
  salePrice?: string | number;
};

const db = () => getRuntimeEnv().DB;
const clean = (value: unknown) => String(value ?? "").trim();
const validImage = (value: string) => /^https?:\/\//i.test(value);

async function belongs(tenantId: string, table: string, id?: string | null) {
  if (!id) return true;
  return Boolean(
    await db()
      .prepare(`SELECT id FROM ${table} WHERE id=? AND tenant_id=?`)
      .bind(id, tenantId)
      .first(),
  );
}

export async function GET(req: Request) {
  const access = await requireAccess(req, "inventory");
  if (access.error) return access.error;
  const d = db(),
    T = access.user.tenantId,
    url = new URL(req.url),
    q = `%${clean(url.searchParams.get("q"))}%`;
  const [
    settings,
    categories,
    brands,
    units,
    taxes,
    lists,
    products,
    variants,
    barcodes,
    presentations,
    prices,
    images,
  ] = await Promise.all([
    d
      .prepare(
        "SELECT sector,currency FROM business_settings WHERE tenant_id=?",
      )
      .bind(T)
      .first(),
    d
      .prepare(
        "SELECT c.id,c.parent_id parentId,c.name,c.description,c.active,p.name parentName,(SELECT COUNT(*) FROM products x WHERE x.tenant_id=c.tenant_id AND (x.category_id=c.id OR x.subcategory_id=c.id)) productCount FROM catalog_categories c LEFT JOIN catalog_categories p ON p.id=c.parent_id WHERE c.tenant_id=? ORDER BY COALESCE(p.name,c.name),c.parent_id,c.name",
      )
      .bind(T)
      .all(),
    d
      .prepare(
        "SELECT b.id,b.name,b.description,b.active,(SELECT COUNT(*) FROM products p WHERE p.tenant_id=b.tenant_id AND p.brand_id=b.id) productCount FROM brands b WHERE b.tenant_id=? ORDER BY b.name",
      )
      .bind(T)
      .all(),
    d
      .prepare(
        "SELECT id,name,symbol,precision,active FROM measurement_units WHERE tenant_id=? ORDER BY name",
      )
      .bind(T)
      .all(),
    d
      .prepare(
        "SELECT id,name,rate,included_in_price includedInPrice,active FROM tax_rates WHERE tenant_id=? ORDER BY name",
      )
      .bind(T)
      .all(),
    d
      .prepare(
        "SELECT id,name,currency,is_default isDefault,active FROM price_lists WHERE tenant_id=? ORDER BY is_default DESC,name",
      )
      .bind(T)
      .all(),
    d
      .prepare(
        "SELECT p.id,p.sku,p.name,p.product_type productType,p.category,p.category_id categoryId,p.subcategory_id subcategoryId,p.brand_id brandId,p.unit_id unitId,p.tax_id taxId,p.track_inventory trackInventory,p.special_fields specialFields,p.price_minor priceMinor,p.cost_minor costMinor,p.stock,p.active,p.version,c.name categoryName,s.name subcategoryName,b.name brandName,u.symbol unitSymbol,t.name taxName,t.rate taxRate,(SELECT url FROM catalog_images i WHERE i.product_id=p.id ORDER BY sort_order LIMIT 1) imageUrl,(SELECT COUNT(*) FROM product_variants v WHERE v.product_id=p.id AND v.active=1) variantCount,(SELECT COUNT(*) FROM product_barcodes bc WHERE bc.product_id=p.id) barcodeCount FROM products p LEFT JOIN catalog_categories c ON c.id=p.category_id LEFT JOIN catalog_categories s ON s.id=p.subcategory_id LEFT JOIN brands b ON b.id=p.brand_id LEFT JOIN measurement_units u ON u.id=p.unit_id LEFT JOIN tax_rates t ON t.id=p.tax_id WHERE p.tenant_id=? AND (p.name LIKE ? OR p.sku LIKE ? OR EXISTS(SELECT 1 FROM product_barcodes bc WHERE bc.product_id=p.id AND bc.code LIKE ?)) ORDER BY p.active DESC,p.name LIMIT 300",
      )
      .bind(T, q, q, q)
      .all(),
    d
      .prepare(
        "SELECT id,product_id productId,name,sku,attributes,price_minor priceMinor,cost_minor costMinor,stock,active FROM product_variants WHERE tenant_id=? ORDER BY name",
      )
      .bind(T)
      .all(),
    d
      .prepare(
        "SELECT id,product_id productId,variant_id variantId,code,kind,is_primary isPrimary FROM product_barcodes WHERE tenant_id=? ORDER BY is_primary DESC,code",
      )
      .bind(T)
      .all(),
    d
      .prepare(
        "SELECT x.id,x.product_id productId,x.name,x.unit,x.unit_id unitId,x.conversion_factor conversionFactor,x.barcode,x.sale_price_minor salePriceMinor,x.active FROM product_presentations x JOIN products p ON p.id=x.product_id WHERE p.tenant_id=? ORDER BY x.name",
      )
      .bind(T)
      .all(),
    d
      .prepare(
        "SELECT id,price_list_id priceListId,product_id productId,variant_id variantId,price_minor priceMinor,min_quantity minQuantity FROM product_prices WHERE tenant_id=? ORDER BY min_quantity",
      )
      .bind(T)
      .all(),
    d
      .prepare(
        "SELECT id,product_id productId,variant_id variantId,url,alt_text altText,sort_order sortOrder FROM catalog_images WHERE tenant_id=? ORDER BY sort_order",
      )
      .bind(T)
      .all(),
  ]);
  const normalizeMoney = <T extends Record<string, unknown>>(row: T) => ({
    ...row,
    ...(typeof row.priceMinor === "number"
      ? { price: moneyToMajor(row.priceMinor) }
      : {}),
    ...(typeof row.costMinor === "number"
      ? { cost: moneyToMajor(row.costMinor) }
      : {}),
    ...(typeof row.salePriceMinor === "number"
      ? { salePrice: moneyToMajor(row.salePriceMinor) }
      : {}),
  });
  return Response.json({
    settings,
    categories: categories.results,
    brands: brands.results,
    units: units.results,
    taxes: taxes.results,
    priceLists: lists.results,
    products: products.results.map(normalizeMoney),
    variants: variants.results.map(normalizeMoney),
    barcodes: barcodes.results,
    presentations: presentations.results.map(normalizeMoney),
    prices: prices.results.map(normalizeMoney),
    images: images.results,
  });
}

export async function POST(req: Request) {
  const access = await requireAccess(req, "inventory", "create");
  if (access.error) return access.error;
  const p = (await req.json()) as Record<string, unknown>,
    action = clean(p.action),
    d = db(),
    T = access.user.tenantId;
  try {
    if (action === "category") {
      const name = clean(p.name),
        parentId = clean(p.parentId) || null;
      if (!name)
        return Response.json({ error: "Nombre requerido" }, { status: 400 });
      if (!(await belongs(T, "catalog_categories", parentId)))
        return Response.json(
          { error: "La categoría superior no pertenece a la empresa" },
          { status: 403 },
        );
      const id = randomUUID();
      await d
        .prepare(
          "INSERT INTO catalog_categories (id,tenant_id,parent_id,name,description) VALUES (?,?,?,?,?)",
        )
        .bind(id, T, parentId, name, clean(p.description) || null)
        .run();
      return Response.json({ id }, { status: 201 });
    }
    if (action === "brand") {
      const name = clean(p.name);
      if (!name)
        return Response.json({ error: "Nombre requerido" }, { status: 400 });
      const id = randomUUID();
      await d
        .prepare(
          "INSERT INTO brands (id,tenant_id,name,description) VALUES (?,?,?,?)",
        )
        .bind(id, T, name, clean(p.description) || null)
        .run();
      return Response.json({ id }, { status: 201 });
    }
    if (action === "unit") {
      const name = clean(p.name),
        symbol = clean(p.symbol),
        precision = Number(p.precision || 0);
      if (
        !name ||
        !symbol ||
        !Number.isInteger(precision) ||
        precision < 0 ||
        precision > 6
      )
        return Response.json(
          { error: "Unidad, símbolo o precisión inválidos" },
          { status: 400 },
        );
      const id = randomUUID();
      await d
        .prepare(
          "INSERT INTO measurement_units (id,tenant_id,name,symbol,precision) VALUES (?,?,?,?,?)",
        )
        .bind(id, T, name, symbol, precision)
        .run();
      return Response.json({ id }, { status: 201 });
    }
    if (action === "tax") {
      const name = clean(p.name),
        rate = Number(p.rate);
      if (!name || !Number.isFinite(rate) || rate < 0 || rate > 100)
        return Response.json(
          { error: "Nombre o tarifa de impuesto inválidos" },
          { status: 400 },
        );
      const id = randomUUID();
      await d
        .prepare(
          "INSERT INTO tax_rates (id,tenant_id,name,rate,included_in_price,active) VALUES (?,?,?,?,?,1)",
        )
        .bind(id, T, name, rate, Number(p.includedInPrice !== false))
        .run();
      return Response.json({ id }, { status: 201 });
    }
    if (action === "priceList") {
      const name = clean(p.name),
        currency = clean(p.currency);
      if (!name || !/^[A-Z]{3}$/.test(currency))
        return Response.json(
          { error: "Nombre y moneda válidos son requeridos" },
          { status: 400 },
        );
      const id = randomUUID(),
        isDefault = Boolean(p.isDefault);
      const statements = [];
      if (isDefault)
        statements.push(
          d
            .prepare("UPDATE price_lists SET is_default=0 WHERE tenant_id=?")
            .bind(T),
        );
      statements.push(
        d
          .prepare(
            "INSERT INTO price_lists (id,tenant_id,name,currency,is_default) VALUES (?,?,?,?,?)",
          )
          .bind(id, T, name, currency, Number(isDefault)),
      );
      await d.batch(statements);
      return Response.json({ id }, { status: 201 });
    }
    if (action === "price") {
      const priceListId = clean(p.priceListId),
        productId = clean(p.productId),
        variantId = clean(p.variantId) || null,
        minQuantity = Number(p.minQuantity || 1),
        priceMinor = parseMoney(p.price);
      const refs = await Promise.all([
        belongs(T, "price_lists", priceListId),
        belongs(T, "products", productId),
        belongs(T, "product_variants", variantId),
      ]);
      if (
        !priceListId ||
        !productId ||
        refs.some((ok) => !ok) ||
        priceMinor < 0 ||
        !Number.isFinite(minQuantity) ||
        minQuantity <= 0
      )
        return Response.json(
          { error: "Lista, producto, precio o cantidad inválidos" },
          { status: refs.some((ok) => !ok) ? 403 : 400 },
        );
      await d.batch([
        d
          .prepare(
            "DELETE FROM product_prices WHERE tenant_id=? AND price_list_id=? AND product_id=? AND COALESCE(variant_id,'')=COALESCE(?,'') AND min_quantity=?",
          )
          .bind(T, priceListId, productId, variantId, minQuantity),
        d
          .prepare(
            "INSERT INTO product_prices (id,tenant_id,price_list_id,product_id,variant_id,price_minor,min_quantity) VALUES (?,?,?,?,?,?,?)",
          )
          .bind(
            randomUUID(),
            T,
            priceListId,
            productId,
            variantId,
            priceMinor,
            minQuantity,
          ),
      ]);
      return Response.json({ priceMinor }, { status: 201 });
    }
    if (action !== "product")
      return Response.json({ error: "Acción inválida" }, { status: 400 });

    const sku = clean(p.sku),
      name = clean(p.name),
      type = clean(p.productType) || "product",
      categoryId = clean(p.categoryId) || null,
      subcategoryId = clean(p.subcategoryId) || null,
      brandId = clean(p.brandId) || null,
      unitId = clean(p.unitId) || null,
      taxId = clean(p.taxId) || null;
    if (!sku || !name || !["product", "service"].includes(type))
      return Response.json(
        { error: "SKU, nombre y tipo son requeridos" },
        { status: 400 },
      );
    const priceMinor = parseMoney(p.price),
      costMinor = parseMoney(p.cost),
      stock = Number(p.stock || 0);
    if (priceMinor < 0 || costMinor < 0 || !Number.isFinite(stock))
      return Response.json(
        { error: "Precio, costo o existencia inválidos" },
        { status: 400 },
      );
    const refs = await Promise.all([
      belongs(T, "catalog_categories", categoryId),
      belongs(T, "catalog_categories", subcategoryId),
      belongs(T, "brands", brandId),
      belongs(T, "measurement_units", unitId),
      belongs(T, "tax_rates", taxId),
    ]);
    if (refs.some((ok) => !ok))
      return Response.json(
        { error: "Una referencia no pertenece a la empresa activa" },
        { status: 403 },
      );
    if (subcategoryId) {
      const child = await d
        .prepare(
          "SELECT id FROM catalog_categories WHERE id=? AND tenant_id=? AND parent_id=?",
        )
        .bind(subcategoryId, T, categoryId)
        .first();
      if (!child)
        return Response.json(
          { error: "La subcategoría no pertenece a la categoría elegida" },
          { status: 400 },
        );
    }
    const barcodes = Array.from(
        new Set(((p.barcodes as string[]) || []).map(clean).filter(Boolean)),
      ),
      variants = ((p.variants as VariantInput[]) || []).filter(
        (x) => clean(x.name) || clean(x.sku),
      ),
      presentations = ((p.presentations as PresentationInput[]) || []).filter(
        (x) => clean(x.name),
      ),
      images = Array.from(
        new Set(((p.images as string[]) || []).map(clean).filter(Boolean)),
      );
    if (images.some((url) => !validImage(url)))
      return Response.json(
        { error: "Las imágenes deben usar una URL http o https" },
        { status: 400 },
      );
    const limit=await checkSubscriptionLimit(T,"products");if(!limit.allowed)return Response.json({error:limit.error},{status:409});
    const id = randomUUID(),
      primaryBarcode = barcodes[0] || null,
      category = categoryId
        ? await d
            .prepare("SELECT name FROM catalog_categories WHERE id=?")
            .bind(categoryId)
            .first<{ name: string }>()
        : null,
      trackInventory = type === "product" && p.trackInventory !== false,
      specialFields = JSON.stringify(
        p.specialFields && typeof p.specialFields === "object"
          ? p.specialFields
          : {},
      ),
      statements = [
        d
          .prepare(
            "INSERT INTO products (id,tenant_id,sku,barcode,name,category,price,cost,stock,product_type,category_id,subcategory_id,brand_id,unit_id,tax_id,track_inventory,special_fields,price_minor,cost_minor) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            id,
            T,
            sku,
            primaryBarcode,
            name,
            category?.name || "Sin categoría",
            moneyToMajor(priceMinor),
            moneyToMajor(costMinor),
            0,
            type,
            categoryId,
            subcategoryId,
            brandId,
            unitId,
            taxId,
            Number(trackInventory),
            specialFields,
            priceMinor,
            costMinor,
          ),
      ], initialEntries:{variantId:string|null;quantity:number;costMinor:number}[]=[];
    if(trackInventory&&stock)initialEntries.push({variantId:null,quantity:stock,costMinor});
    barcodes.forEach((code, index) =>
      statements.push(
        d
          .prepare(
            "INSERT INTO product_barcodes (id,tenant_id,product_id,code,kind,is_primary) VALUES (?,?,?,?,?,?)",
          )
          .bind(randomUUID(), T, id, code, "EAN", Number(index === 0)),
      ),
    );
    for (const input of variants) {
      const variantId = randomUUID(),
        variantPrice = parseMoney(input.price ?? p.price),
        variantCost = parseMoney(input.cost ?? p.cost);
      if (
        !clean(input.name) ||
        !clean(input.sku) ||
        variantPrice < 0 ||
        variantCost < 0
      )
        return Response.json(
          { error: "Complete correctamente cada variante" },
          { status: 400 },
        );
      statements.push(
        d
          .prepare(
            "INSERT INTO product_variants (id,tenant_id,product_id,name,sku,attributes,price_minor,cost_minor,stock) VALUES (?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            variantId,
            T,
            id,
            clean(input.name),
            clean(input.sku),
            JSON.stringify(input.attributes || {}),
            variantPrice,
            variantCost,
            0,
          ),
      );
      if(trackInventory&&Number(input.stock||0))initialEntries.push({variantId,quantity:Number(input.stock),costMinor:variantCost});
      for (const code of Array.from(
        new Set((input.barcodes || []).map(clean).filter(Boolean)),
      ))
        statements.push(
          d
            .prepare(
              "INSERT INTO product_barcodes (id,tenant_id,product_id,variant_id,code,kind,is_primary) VALUES (?,?,?,?,?,'EAN',0)",
            )
            .bind(randomUUID(), T, id, variantId, code),
        );
    }
    for (const input of presentations) {
      if (!(await belongs(T, "measurement_units", input.unitId)))
        return Response.json(
          { error: "Unidad de presentación ajena a la empresa" },
          { status: 403 },
        );
      const presentationPrice = parseMoney(input.salePrice ?? p.price);
      statements.push(
        d
          .prepare(
            "INSERT INTO product_presentations (id,tenant_id,product_id,name,unit,unit_id,conversion_factor,barcode,sale_price,sale_price_minor) VALUES (?,?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            randomUUID(),
            T,
            id,
            clean(input.name),
            clean(input.unitId) || "unidad",
            input.unitId || null,
            Number(input.conversionFactor || 1),
            clean(input.barcode) || null,
            moneyToMajor(presentationPrice),
            presentationPrice,
          ),
      );
    }
    images.forEach((url, index) =>
      statements.push(
        d
          .prepare(
            "INSERT INTO catalog_images (id,tenant_id,product_id,url,alt_text,sort_order) VALUES (?,?,?,?,?,?)",
          )
          .bind(randomUUID(), T, id, url, name, index),
      ),
    );
    const defaultList = await d
      .prepare(
        "SELECT id FROM price_lists WHERE tenant_id=? AND is_default=1 AND active=1 LIMIT 1",
      )
      .bind(T)
      .first<{ id: string }>();
    if (defaultList)
      statements.push(
        d
          .prepare(
            "INSERT INTO product_prices (id,tenant_id,price_list_id,product_id,price_minor,min_quantity) VALUES (?,?,?,?,?,1)",
          )
          .bind(randomUUID(), T, defaultList.id, id, priceMinor),
      );
    const warehouse=initialEntries.length?await resolveWarehouse(T,access.user.branchId):null;
    for(const entry of initialEntries){const movement=await inventoryMovement({tenantId:T,branchId:access.user.branchId,warehouseId:warehouse!.id,productId:id,variantId:entry.variantId,userId:access.user.id,movementType:"initial",quantity:entry.quantity,reason:"Inventario inicial",reference:sku,sourceType:"product",sourceId:id,unitCostMinor:entry.costMinor});statements.push(...movement.statements)}
    statements.push(
      d
        .prepare(
          "INSERT INTO audit_logs (id,tenant_id,user_id,action,entity_type,entity_id,details) VALUES (?,?,?,?,?,?,?)",
        )
        .bind(
          randomUUID(),
          T,
          access.user.id,
          "create",
          type,
          id,
          `${name} creado en catálogo`,
        ),
    );
    await d.batch(statements);
    return Response.json({ id, priceMinor, costMinor }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No fue posible guardar el catálogo";
    return Response.json(
      {
        error: message.includes("UNIQUE")
          ? "El nombre, SKU o código ya existe"
          : message,
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
      active?: boolean;
      price?: string | number;
      cost?: string | number;
    },
    T = access.user.tenantId;
  if (!p.id)
    return Response.json({ error: "Producto requerido" }, { status: 400 });
  const current = await db()
    .prepare("SELECT id FROM products WHERE id=? AND tenant_id=?")
    .bind(p.id, T)
    .first();
  if (!current)
    return Response.json({ error: "Producto no encontrado" }, { status: 404 });
  const sets: string[] = [],
    values: unknown[] = [];
  if (p.active !== undefined) {
    sets.push("active=?");
    values.push(Number(p.active));
  }
  if (p.price !== undefined) {
    const minor = parseMoney(p.price);
    if (minor < 0)
      return Response.json({ error: "Precio inválido" }, { status: 400 });
    sets.push("price_minor=?", "price=?");
    values.push(minor, moneyToMajor(minor));
  }
  if (p.cost !== undefined) {
    const minor = parseMoney(p.cost);
    if (minor < 0)
      return Response.json({ error: "Costo inválido" }, { status: 400 });
    sets.push("cost_minor=?", "cost=?");
    values.push(minor, moneyToMajor(minor));
  }
  if (!sets.length)
    return Response.json({ error: "No hay cambios" }, { status: 400 });
  values.push(p.id, T);
  await db()
    .prepare(
      `UPDATE products SET ${sets.join(",")},version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?`,
    )
    .bind(...values)
    .run();
  return Response.json({ updated: true });
}
