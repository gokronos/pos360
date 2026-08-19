"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { readJson } from "./api-client";

type CatalogData = {
  settings: { sector?: string; currency?: string };
  categories: any[];
  brands: any[];
  units: any[];
  taxes: any[];
  priceLists: any[];
  products: any[];
  variants: any[];
  barcodes: any[];
  presentations: any[];
  prices: any[];
  images: any[];
};
const empty: CatalogData = {
  settings: {},
  categories: [],
  brands: [],
  units: [],
  taxes: [],
  priceLists: [],
  products: [],
  variants: [],
  barcodes: [],
  presentations: [],
  prices: [],
  images: [],
};
const sectorFields: Record<string, [string, string][]> = {
  pharmacy: [
    ["healthRegistration", "Registro sanitario"],
    ["laboratory", "Laboratorio"],
    ["controlled", "Medicamento controlado"],
  ],
  hardware: [
    ["material", "Material"],
    ["gauge", "Calibre o medida"],
    ["manufacturerCode", "Código fabricante"],
  ],
  restaurant: [
    ["preparationTime", "Tiempo de preparación"],
    ["kitchenArea", "Área de cocina"],
    ["allergens", "Alérgenos"],
  ],
  fashion: [
    ["size", "Talla base"],
    ["color", "Color base"],
    ["gender", "Género"],
  ],
  services: [
    ["duration", "Duración"],
    ["deliveryMode", "Modalidad"],
    ["professional", "Profesional"],
  ],
  retail: [
    ["supplierCode", "Código del proveedor"],
    ["shelfLife", "Vida útil"],
  ],
};

export default function CatalogManager({
  notify,
}: {
  notify: (text: string) => void;
}) {
  const [data, setData] = useState<CatalogData>(empty),
    [section, setSection] = useState("products"),
    [modal, setModal] = useState<string | null>(null),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false),
    [meta, setMeta] = useState<any>({}),
    [form, setForm] = useState<any>({
      productType: "product",
      trackInventory: true,
      price: "0.00",
      cost: "0.00",
      stock: "0",
      barcodes: "",
      variants: "",
      presentations: "",
      images: "",
      specialFields: {},
    });
  const load = async () => {
    const response = await fetch(
        `/api/catalog?q=${encodeURIComponent(search)}`,
      ),
      payload = await readJson<CatalogData & { error?: string }>(response);
    if (!response.ok)
      return notify(payload.error || "No fue posible cargar el catálogo");
    setData(payload);
  };
  useEffect(() => {
    void load();
  }, []);
  const currency = data.settings?.currency || "COP",
    money = (minor: number) =>
      new Intl.NumberFormat("es-CO", { style: "currency", currency }).format(
        (minor || 0) / 100,
      ),
    roots = data.categories.filter((category) => !category.parentId),
    subcategories = data.categories.filter(
      (category) => category.parentId === form.categoryId,
    ),
    fields =
      sectorFields[data.settings?.sector || "retail"] || sectorFields.retail,
    counts = useMemo(
      () => ({
        products: data.products.filter((x) => x.productType === "product")
          .length,
        services: data.products.filter((x) => x.productType === "service")
          .length,
        variants: data.variants.length,
        barcodes: data.barcodes.length,
      }),
      [data],
    );
  const post = async (payload: any) => {
    setBusy(true);
    const response = await fetch("/api/catalog", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
      result = await readJson<any>(response);
    setBusy(false);
    if (!response.ok) {
      notify(result.error);
      return false;
    }
    await load();
    return true;
  };
  const saveMeta = async () => {
    if (await post({ action: modal, ...meta })) {
      notify("Registro del catálogo guardado");
      setModal(null);
      setMeta({});
    }
  };
  const parseVariants = () =>
      String(form.variants || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [name, sku, price, cost, attributes = "", barcodes = ""] = line
            .split("|")
            .map((x) => x.trim());
          return {
            name,
            sku,
            price,
            cost,
            attributes: Object.fromEntries(
              attributes
                .split(",")
                .filter(Boolean)
                .map((pair) => pair.split("=").map((x) => x.trim())),
            ),
            barcodes: barcodes
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
          };
        }),
    parsePresentations = () =>
      String(form.presentations || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [name, unitId, conversionFactor, barcode, salePrice] = line
            .split("|")
            .map((x) => x.trim());
          return {
            name,
            unitId,
            conversionFactor: Number(conversionFactor),
            barcode,
            salePrice,
          };
        });
  const saveProduct = async () => {
    const payload = {
      ...form,
      action: "product",
      stock: Number(form.stock || 0),
      barcodes: String(form.barcodes || "")
        .split(/[\n,]/)
        .map((x) => x.trim())
        .filter(Boolean),
      images: String(form.images || "")
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean),
      variants: parseVariants(),
      presentations: parsePresentations(),
    };
    if (await post(payload)) {
      notify(
        `${form.productType === "service" ? "Servicio" : "Producto"} creado con valores monetarios exactos`,
      );
      setModal(null);
      setForm({
        productType: "product",
        trackInventory: true,
        price: "0.00",
        cost: "0.00",
        stock: "0",
        barcodes: "",
        variants: "",
        presentations: "",
        images: "",
        specialFields: {},
      });
    }
  };
  const toggle = async (product: any) => {
    const response = await fetch("/api/catalog", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: product.id, active: !product.active }),
      }),
      result = await readJson<any>(response);
    if (!response.ok) return notify(result.error);
    notify(product.active ? "Registro desactivado" : "Registro activado");
    load();
  };
  const openMeta = (type: string) => {
    setMeta(
      type === "priceList"
        ? { currency, isDefault: data.priceLists.length === 0 }
        : {},
    );
    setModal(type);
  };
  return (
    <>
      <div className="catalog-head">
        <div>
          <h2>Catálogo profesional</h2>
          <p>
            Productos, servicios, variantes, precios y clasificación comercial.
          </p>
        </div>
        <div>
          <button className="secondary" onClick={() => openMeta("category")}>
            + Categoría
          </button>
          <button className="primary" onClick={() => setModal("product")}>
            + Producto o servicio
          </button>
        </div>
      </div>
      <div className="catalog-kpis">
        <K label="Productos" value={counts.products} />
        <K label="Servicios" value={counts.services} />
        <K label="Variantes" value={counts.variants} />
        <K label="Códigos" value={counts.barcodes} />
      </div>
      <div className="admin-tabs catalog-tabs">
        {[
          ["products", "Productos"],
          ["categories", "Categorías"],
          ["brands", "Marcas"],
          ["units", "Unidades"],
          ["taxes", "Impuestos"],
          ["prices", "Listas de precios"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={section === id ? "active" : ""}
            onClick={() => setSection(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {section === "products" && (
        <article className="panel table-panel">
          <div className="filters">
            <div className="table-search">
              ⌕
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load()}
                placeholder="Nombre, SKU o código de barras"
              />
            </div>
            <button onClick={load}>Buscar</button>
            <span className="db-badge">● Dinero exacto</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Artículo</th>
                <th>Tipo</th>
                <th>Clasificación</th>
                <th>Códigos / variantes</th>
                <th>Costo</th>
                <th>Precio</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="catalog-product">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt="" />
                      ) : (
                        <span>{p.productType === "service" ? "S" : "P"}</span>
                      )}
                      <div>
                        <b>{p.name}</b>
                        <small>
                          {p.sku} · {p.unitSymbol || "sin unidad"}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="status ok">
                      {p.productType === "service" ? "Servicio" : "Producto"}
                    </span>
                  </td>
                  <td>
                    {p.categoryName || "Sin categoría"}
                    <small className="cell-sub">
                      {p.subcategoryName || p.brandName || "Sin subcategoría"}
                    </small>
                  </td>
                  <td>
                    {p.barcodeCount} códigos · {p.variantCount} variantes
                  </td>
                  <td>{money(p.costMinor)}</td>
                  <td>
                    <b>{money(p.priceMinor)}</b>
                  </td>
                  <td>{p.active ? "Activo" : "Inactivo"}</td>
                  <td>
                    <button className="table-action" onClick={() => toggle(p)}>
                      {p.active ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      )}
      {section === "categories" && (
        <MetaTable
          title="Categorías y subcategorías"
          button="+ Nueva categoría"
          onAdd={() => openMeta("category")}
          headers={["Nombre", "Nivel", "Productos"]}
          rows={data.categories.map((x) => [
            x.name,
            x.parentName
              ? `Subcategoría de ${x.parentName}`
              : "Categoría principal",
            x.productCount,
          ])}
        />
      )}
      {section === "brands" && (
        <MetaTable
          title="Marcas"
          button="+ Nueva marca"
          onAdd={() => openMeta("brand")}
          headers={["Marca", "Descripción", "Productos"]}
          rows={data.brands.map((x) => [
            x.name,
            x.description || "—",
            x.productCount,
          ])}
        />
      )}
      {section === "units" && (
        <MetaTable
          title="Unidades de medida"
          button="+ Nueva unidad"
          onAdd={() => openMeta("unit")}
          headers={["Unidad", "Símbolo", "Decimales"]}
          rows={data.units.map((x) => [x.name, x.symbol, x.precision])}
        />
      )}
      {section === "taxes" && (
        <MetaTable
          title="Impuestos del catálogo"
          button="+ Nuevo impuesto"
          onAdd={() => openMeta("tax")}
          headers={["Impuesto", "Tarifa", "Aplicación"]}
          rows={data.taxes.map((x) => [
            x.name,
            `${x.rate}%`,
            x.includedInPrice ? "Incluido en precio" : "Adicional",
          ])}
        />
      )}
      {section === "prices" && (
        <>
          <MetaTable
            title="Listas de precios"
            button="+ Nueva lista"
            onAdd={() => openMeta("priceList")}
            headers={["Lista", "Moneda", "Tipo"]}
            rows={data.priceLists.map((x) => [
              x.name,
              x.currency,
              x.isDefault ? "Predeterminada" : "Alterna",
            ])}
          />
          <article className="panel price-assign">
            <h3>Asignar precio especial</h3>
            <div className="setup-grid">
              <label>
                Lista
                <select
                  value={meta.priceListId || ""}
                  onChange={(e) =>
                    setMeta({ ...meta, priceListId: e.target.value })
                  }
                >
                  <option value="">Seleccione</option>
                  {data.priceLists.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Producto
                <select
                  value={meta.productId || ""}
                  onChange={(e) =>
                    setMeta({ ...meta, productId: e.target.value })
                  }
                >
                  <option value="">Seleccione</option>
                  {data.products.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </label>
              <Field
                label="Precio exacto"
                value={meta.price || ""}
                onChange={(v) => setMeta({ ...meta, price: v })}
              />
              <Field
                label="Cantidad mínima"
                value={meta.minQuantity || "1"}
                onChange={(v) => setMeta({ ...meta, minQuantity: v })}
              />
            </div>
            <button
              className="primary"
              onClick={() => post({ action: "price", ...meta })}
            >
              Guardar precio
            </button>
          </article>
        </>
      )}
      {modal && (
        <div className="modal-backdrop">
          <section
            className={`modal ${modal === "product" ? "catalog-modal" : "compact-modal"}`}
          >
            <header className="modal-head">
              <div>
                <h3>
                  {modal === "product"
                    ? "Nuevo producto o servicio"
                    : `Nuevo registro: ${modal}`}
                </h3>
                <p>La información quedará separada para esta empresa.</p>
              </div>
              <button onClick={() => setModal(null)}>×</button>
            </header>
            {modal === "product" ? (
              <div className="catalog-form">
                <div className="setup-grid">
                  <label>
                    Tipo
                    <select
                      value={form.productType}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          productType: e.target.value,
                          trackInventory: e.target.value === "product",
                        })
                      }
                    >
                      <option value="product">Producto</option>
                      <option value="service">Servicio</option>
                    </select>
                  </label>
                  <Field
                    label="SKU"
                    value={form.sku || ""}
                    onChange={(v) => setForm({ ...form, sku: v })}
                  />
                  <Field
                    label="Nombre"
                    value={form.name || ""}
                    onChange={(v) => setForm({ ...form, name: v })}
                  />
                  <label>
                    Categoría
                    <select
                      value={form.categoryId || ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          categoryId: e.target.value,
                          subcategoryId: "",
                        })
                      }
                    >
                      <option value="">Sin categoría</option>
                      {roots.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Subcategoría
                    <select
                      value={form.subcategoryId || ""}
                      onChange={(e) =>
                        setForm({ ...form, subcategoryId: e.target.value })
                      }
                    >
                      <option value="">Sin subcategoría</option>
                      {subcategories.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Marca
                    <select
                      value={form.brandId || ""}
                      onChange={(e) =>
                        setForm({ ...form, brandId: e.target.value })
                      }
                    >
                      <option value="">Sin marca</option>
                      {data.brands.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Unidad base
                    <select
                      value={form.unitId || ""}
                      onChange={(e) =>
                        setForm({ ...form, unitId: e.target.value })
                      }
                    >
                      <option value="">Seleccione</option>
                      {data.units.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name} ({x.symbol})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Impuesto
                    <select
                      value={form.taxId || ""}
                      onChange={(e) =>
                        setForm({ ...form, taxId: e.target.value })
                      }
                    >
                      <option value="">Sin impuesto</option>
                      {data.taxes.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name} {x.rate}%
                        </option>
                      ))}
                    </select>
                  </label>
                  <Field
                    label="Precio de venta"
                    value={form.price}
                    onChange={(v) => setForm({ ...form, price: v })}
                  />
                  <Field
                    label="Costo"
                    value={form.cost}
                    onChange={(v) => setForm({ ...form, cost: v })}
                  />
                  {form.productType === "product" && (
                    <Field
                      label="Existencia inicial"
                      value={form.stock}
                      onChange={(v) => setForm({ ...form, stock: v })}
                    />
                  )}
                </div>
                <label className="setup-toggle">
                  <input
                    type="checkbox"
                    checked={form.trackInventory}
                    disabled={form.productType === "service"}
                    onChange={(e) =>
                      setForm({ ...form, trackInventory: e.target.checked })
                    }
                  />
                  <i />
                  <div>
                    <b>Controlar inventario</b>
                    <small>Descuenta existencias en cada venta.</small>
                  </div>
                </label>
                <div className="catalog-block">
                  <h4>Códigos de barras</h4>
                  <textarea
                    value={form.barcodes}
                    onChange={(e) =>
                      setForm({ ...form, barcodes: e.target.value })
                    }
                    placeholder="Uno por línea o separados por coma"
                  />
                </div>
                <div className="catalog-block">
                  <h4>Variantes</h4>
                  <small>
                    Una por línea: Nombre | SKU | Precio | Costo |
                    color=Azul,talla=M | código1,código2
                  </small>
                  <textarea
                    value={form.variants}
                    onChange={(e) =>
                      setForm({ ...form, variants: e.target.value })
                    }
                  />
                </div>
                <div className="catalog-block">
                  <h4>Presentaciones y conversiones</h4>
                  <small>Nombre | ID unidad | Factor | Código | Precio</small>
                  <textarea
                    value={form.presentations}
                    onChange={(e) =>
                      setForm({ ...form, presentations: e.target.value })
                    }
                    placeholder={data.units
                      .map((x) => `${x.name}: ${x.id}`)
                      .join(" · ")}
                  />
                </div>
                <div className="catalog-block">
                  <h4>Imágenes</h4>
                  <textarea
                    value={form.images}
                    onChange={(e) =>
                      setForm({ ...form, images: e.target.value })
                    }
                    placeholder="Una URL https por línea"
                  />
                </div>
                <div className="catalog-block">
                  <h4>
                    Campos para sector {data.settings?.sector || "retail"}
                  </h4>
                  <div className="setup-grid">
                    {fields.map(([key, label]) => (
                      <Field
                        key={key}
                        label={label}
                        value={form.specialFields?.[key] || ""}
                        onChange={(v) =>
                          setForm({
                            ...form,
                            specialFields: { ...form.specialFields, [key]: v },
                          })
                        }
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="form-grid one">
                <Field
                  label="Nombre"
                  value={meta.name || ""}
                  onChange={(v) => setMeta({ ...meta, name: v })}
                />
                {modal === "category" && (
                  <label>
                    Categoría superior
                    <select
                      value={meta.parentId || ""}
                      onChange={(e) =>
                        setMeta({ ...meta, parentId: e.target.value })
                      }
                    >
                      <option value="">Categoría principal</option>
                      {roots.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {modal === "brand" && (
                  <Field
                    label="Descripción"
                    value={meta.description || ""}
                    onChange={(v) => setMeta({ ...meta, description: v })}
                  />
                )}
                {modal === "unit" && (
                  <>
                    <Field
                      label="Símbolo"
                      value={meta.symbol || ""}
                      onChange={(v) => setMeta({ ...meta, symbol: v })}
                    />
                    <Field
                      label="Decimales permitidos"
                      value={meta.precision || "0"}
                      onChange={(v) => setMeta({ ...meta, precision: v })}
                    />
                  </>
                )}
                {modal === "priceList" && (
                  <>
                    <Field
                      label="Moneda"
                      value={meta.currency || currency}
                      onChange={(v) =>
                        setMeta({ ...meta, currency: v.toUpperCase() })
                      }
                    />
                    <label className="check-line">
                      <input
                        type="checkbox"
                        checked={Boolean(meta.isDefault)}
                        onChange={(e) =>
                          setMeta({ ...meta, isDefault: e.target.checked })
                        }
                      />{" "}
                      Lista predeterminada
                    </label>
                  </>
                )}
              </div>
            )}
            {modal === "tax" && (
              <>
                <Field
                  label="Tarifa (%)"
                  value={meta.rate || "0"}
                  onChange={(v) => setMeta({ ...meta, rate: v })}
                />
                <label className="check-line">
                  <input
                    type="checkbox"
                    checked={meta.includedInPrice !== false}
                    onChange={(e) =>
                      setMeta({ ...meta, includedInPrice: e.target.checked })
                    }
                  />
                  Incluido en el precio
                </label>
              </>
            )}
            <footer className="modal-actions">
              <button className="secondary" onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={modal === "product" ? saveProduct : saveMeta}
              >
                {busy ? "Guardando…" : "Guardar"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}

function K({ label, value }: { label: string; value: number }) {
  return (
    <article>
      <span>{label}</span>
      <b>{value}</b>
    </article>
  );
}
function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
function MetaTable({
  title,
  button,
  onAdd,
  headers,
  rows,
}: {
  title: string;
  button: string;
  onAdd: () => void;
  headers: string[];
  rows: any[][];
}) {
  return (
    <article className="panel table-panel">
      <div className="filters">
        <b>{title}</b>
        <button className="primary compact" onClick={onAdd}>
          {button}
        </button>
      </div>
      <table>
        <thead>
          <tr>
            {headers.map((x) => (
              <th key={x}>{x}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, i) => (
                <td key={i}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}
