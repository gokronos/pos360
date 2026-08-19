"use client";
import { useEffect, useState } from "react";
import { readJson } from "./api-client";
const money = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n || 0);
type W = {
  id: string;
  name: string;
  code: string;
  branchName: string;
  units: number;
  value: number;
};
type S = {
  warehouseId: string;
  warehouseName: string;
  productId: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  cost: number;
  price: number;
};
export default function Inventory({
  notify,
}: {
  notify: (s: string) => void;
  [key: string]: unknown;
}) {
  const [tab, setTab] = useState("stock"),
    [data, setData] = useState<any>({
      warehouses: [],
      stocks: [],
      transfers: [],
      counts: [],
      lots: [],
      serials: [],
      presentations: [],
    }),
    [products, setProducts] = useState<any[]>([]),
    [modal, setModal] = useState<string | null>(null),
    [form, setForm] = useState<any>({
      quantity: "1",
      countedQuantity: "0",
      warrantyMonths: "12",
      conversionFactor: "1",
      unit: "unidad",
    });
  const load = async () => {
    await fetch("/api/bootstrap");
    const [a, p] = await Promise.all([
        fetch("/api/inventory-advanced"),
        fetch("/api/products"),
      ]),
      ad = await readJson<any>(a),
      pd = await readJson<any>(p);
    setData(ad);
    setProducts(pd.products || []);
  };
  useEffect(() => {
    load();
  }, []);
  const save = async (action: string) => {
    const r = await fetch("/api/inventory-advanced", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...form }),
      }),
      d = await readJson<any>(r);
    if (!r.ok) return notify(d.error);
    setModal(null);
    notify(
      action === "transfer"
        ? `Traslado ${d.number} enviado`
        : action === "count"
          ? `Conteo aplicado. Diferencia ${d.difference}`
          : "Registro guardado correctamente",
    );
    load();
  };
  const receive = async (id: string) => {
    const r = await fetch("/api/inventory-advanced", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "receive", transferId: id }),
      }),
      d = await readJson<any>(r);
    if (!r.ok) return notify(d.error);
    notify("Mercancía recibida en la bodega destino");
    load();
  };
  const warehouses = data.warehouses as W[],
    stocks = data.stocks as S[],
    expiring = (data.lots || []).filter(
      (x: any) => x.daysToExpire !== null && x.daysToExpire <= 90,
    ),
    value = warehouses.reduce((s, x) => s + Number(x.value), 0);
  const open = (type: string) => {
    setForm({
      quantity: "1",
      countedQuantity: "0",
      warrantyMonths: "12",
      conversionFactor: "1",
      unit: "unidad",
      fromWarehouseId: warehouses[0]?.id,
      toWarehouseId: warehouses[1]?.id || "",
      warehouseId: warehouses[0]?.id,
      productId: products[0]?.id,
    });
    setModal(type);
  };
  return (
    <>
      <div className="page-intro">
        <div>
          <h2>Inventario avanzado</h2>
          <p>Bodegas, traslados, conteos, lotes, series y presentaciones.</p>
        </div>
        <div>
          <button className="secondary" onClick={() => open("warehouse")}>
            + Bodega
          </button>
          <button className="primary" onClick={() => open("transfer")}>
            + Traslado
          </button>
        </div>
      </div>
      <div className="summary-strip">
        <K
          label="Bodegas activas"
          value={String(warehouses.length)}
          tone="blue"
        />
        <K label="Inventario valorizado" value={money(value)} tone="green" />
        <K
          label="En tránsito"
          value={String(
            (data.transfers || []).filter((x: any) => x.status === "sent")
              .length,
          )}
          tone="orange"
        />
        <K
          label="Lotes por vencer"
          value={String(expiring.length)}
          tone="purple"
        />
      </div>
      <div className="admin-tabs inventory-tabs">
        {[
          ["stock", "Existencias"],
          ["transfers", "Traslados"],
          ["counts", "Conteos"],
          ["lots", "Lotes y vencimientos"],
          ["serials", "Series y garantías"],
          ["presentations", "Presentaciones"],
        ].map((x) => (
          <button
            key={x[0]}
            className={tab === x[0] ? "active" : ""}
            onClick={() => setTab(x[0])}
          >
            {x[1]}
          </button>
        ))}
      </div>
      {tab === "stock" && (
        <>
          <div className="warehouse-grid">
            {warehouses.map((w) => (
              <article className="panel warehouse-card" key={w.id}>
                <span>▦</span>
                <div>
                  <b>{w.name}</b>
                  <small>
                    {w.branchName} · {w.code}
                  </small>
                </div>
                <strong>{w.units} und.</strong>
                <small>{money(w.value)}</small>
              </article>
            ))}
          </div>
          <article className="panel table-panel">
            <div className="filters">
              <b>Existencias por bodega</b>
              <span className="db-badge">● Control independiente</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>SKU</th>
                  <th>Bodega</th>
                  <th>Categoría</th>
                  <th>Existencia</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map((s) => (
                  <tr key={`${s.warehouseId}-${s.productId}`}>
                    <td>
                      <b>{s.name}</b>
                    </td>
                    <td>{s.sku}</td>
                    <td>{s.warehouseName}</td>
                    <td>{s.category}</td>
                    <td>
                      <b>{s.quantity}</b>
                    </td>
                    <td>{money(s.quantity * s.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        </>
      )}
      {tab === "transfers" && (
        <article className="panel table-panel">
          <div className="filters">
            <b>Traslados entre bodegas</b>
            <button
              className="primary compact"
              onClick={() => open("transfer")}
            >
              + Nuevo
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Número</th>
                <th>Origen</th>
                <th>Destino</th>
                <th>Unidades</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {(data.transfers || []).map((t: any) => (
                <tr key={t.id}>
                  <td>
                    <b>{t.number}</b>
                  </td>
                  <td>{t.fromName}</td>
                  <td>{t.toName}</td>
                  <td>{t.units}</td>
                  <td>{new Date(t.createdAt).toLocaleDateString("es-CO")}</td>
                  <td>
                    <span
                      className={
                        t.status === "received" ? "status ok" : "status low"
                      }
                    >
                      {t.status === "received" ? "Recibido" : "En tránsito"}
                    </span>
                  </td>
                  <td>
                    {t.status === "sent" && (
                      <button
                        className="table-action"
                        onClick={() => receive(t.id)}
                      >
                        Recibir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      )}
      {tab === "counts" && (
        <article className="panel table-panel">
          <div className="filters">
            <b>Conteos físicos</b>
            <button className="primary compact" onClick={() => open("count")}>
              + Nuevo conteo
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Número</th>
                <th>Bodega</th>
                <th>Fecha</th>
                <th>Diferencia absoluta</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {(data.counts || []).map((c: any) => (
                <tr key={c.id}>
                  <td>
                    <b>{c.number}</b>
                  </td>
                  <td>{c.warehouseName}</td>
                  <td>{new Date(c.createdAt).toLocaleDateString("es-CO")}</td>
                  <td className={c.difference ? "debt" : ""}>{c.difference}</td>
                  <td>
                    <span className="status ok">Completado</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      )}
      {tab === "lots" && (
        <article className="panel table-panel">
          <div className="filters">
            <b>Lotes y vencimientos · Droguerías</b>
            <button className="primary compact" onClick={() => open("lot")}>
              + Registrar lote
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Lote</th>
                <th>Bodega</th>
                <th>Laboratorio</th>
                <th>Vencimiento</th>
                <th>Cantidad</th>
                <th>Alerta</th>
              </tr>
            </thead>
            <tbody>
              {(data.lots || []).map((l: any) => (
                <tr key={l.id}>
                  <td>
                    <b>{l.productName}</b>
                  </td>
                  <td>{l.lotNumber}</td>
                  <td>{l.warehouseName}</td>
                  <td>{l.laboratory || "—"}</td>
                  <td>{l.expirationDate || "—"}</td>
                  <td>{l.quantity}</td>
                  <td>
                    <span
                      className={
                        l.daysToExpire <= 90 ? "status low" : "status ok"
                      }
                    >
                      {l.daysToExpire < 0
                        ? "Vencido"
                        : l.daysToExpire <= 90
                          ? `${l.daysToExpire} días`
                          : "Vigente"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      )}
      {tab === "serials" && (
        <article className="panel table-panel">
          <div className="filters">
            <b>Series y garantías · Ferreterías</b>
            <button className="primary compact" onClick={() => open("serial")}>
              + Registrar serie
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Número de serie</th>
                <th>Bodega</th>
                <th>Garantía</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {(data.serials || []).map((s: any) => (
                <tr key={s.id}>
                  <td>
                    <b>{s.productName}</b>
                  </td>
                  <td>{s.serialNumber}</td>
                  <td>{s.warehouseName}</td>
                  <td>{s.warrantyMonths} meses</td>
                  <td>
                    <span className="status ok">{s.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      )}
      {tab === "presentations" && (
        <article className="panel table-panel">
          <div className="filters">
            <b>Unidades y presentaciones</b>
            <button
              className="primary compact"
              onClick={() => open("presentation")}
            >
              + Presentación
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Presentación</th>
                <th>Unidad</th>
                <th>Conversión</th>
                <th>Código</th>
                <th>Precio</th>
              </tr>
            </thead>
            <tbody>
              {(data.presentations || []).map((p: any) => (
                <tr key={p.id}>
                  <td>
                    <b>{p.productName}</b>
                  </td>
                  <td>{p.name}</td>
                  <td>{p.unit}</td>
                  <td>× {p.conversionFactor}</td>
                  <td>{p.barcode || "—"}</td>
                  <td>{money(p.salePrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      )}
      {modal && (
        <Modal
          type={modal}
          form={form}
          setForm={setForm}
          warehouses={warehouses}
          products={products}
          close={() => setModal(null)}
          save={save}
        />
      )}
    </>
  );
}
function K({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="kpi">
      <div className={`kpi-icon ${tone}`}>▦</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>Actualizado en tiempo real</small>
      </div>
    </div>
  );
}
function Modal({
  type,
  form,
  setForm,
  warehouses,
  products,
  close,
  save,
}: any) {
  const label =
    type === "warehouse"
      ? "Nueva bodega"
      : type === "transfer"
        ? "Trasladar mercancía"
        : type === "count"
          ? "Conteo físico"
          : type === "lot"
            ? "Registrar lote"
            : type === "serial"
              ? "Registrar serie y garantía"
              : "Nueva presentación";
  const selW = (key: string) => (
      <select
        value={form[key] || ""}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      >
        <option value="">Seleccione</option>
        {warehouses.map((w: any) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
    ),
    selP = (
      <select
        value={form.productId || ""}
        onChange={(e) => setForm({ ...form, productId: e.target.value })}
      >
        <option value="">Seleccione</option>
        {products.map((p: any) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    );
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <section
        className="modal compact-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h3>{label}</h3>
            <p>Inventario avanzado POS360</p>
          </div>
          <button onClick={close}>×</button>
        </div>
        <div className="payment-body">
          {type === "warehouse" ? (
            <>
              <label>
                Nombre
                <input
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label>
                Código
                <input
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </label>
            </>
          ) : type === "transfer" ? (
            <>
              <label>Bodega origen{selW("fromWarehouseId")}</label>
              <label>Bodega destino{selW("toWarehouseId")}</label>
              <label>Producto{selP}</label>
              <label>
                Cantidad
                <input
                  type="number"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm({ ...form, quantity: e.target.value })
                  }
                />
              </label>
            </>
          ) : type === "count" ? (
            <>
              <label>Bodega{selW("warehouseId")}</label>
              <label>Producto{selP}</label>
              <label>
                Cantidad física
                <input
                  type="number"
                  value={form.countedQuantity}
                  onChange={(e) =>
                    setForm({ ...form, countedQuantity: e.target.value })
                  }
                />
              </label>
            </>
          ) : type === "lot" ? (
            <>
              <label>Bodega{selW("warehouseId")}</label>
              <label>Producto{selP}</label>
              <label>
                Número de lote
                <input
                  onChange={(e) =>
                    setForm({ ...form, lotNumber: e.target.value })
                  }
                />
              </label>
              <label>
                Vencimiento
                <input
                  type="date"
                  onChange={(e) =>
                    setForm({ ...form, expirationDate: e.target.value })
                  }
                />
              </label>
              <label>
                Laboratorio
                <input
                  onChange={(e) =>
                    setForm({ ...form, laboratory: e.target.value })
                  }
                />
              </label>
              <label>
                Registro sanitario
                <input
                  onChange={(e) =>
                    setForm({ ...form, healthRegistration: e.target.value })
                  }
                />
              </label>
              <label>
                Cantidad
                <input
                  type="number"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm({ ...form, quantity: e.target.value })
                  }
                />
              </label>
            </>
          ) : type === "serial" ? (
            <>
              <label>Bodega{selW("warehouseId")}</label>
              <label>Producto{selP}</label>
              <label>
                Número de serie
                <input
                  onChange={(e) =>
                    setForm({ ...form, serialNumber: e.target.value })
                  }
                />
              </label>
              <label>
                Garantía en meses
                <input
                  type="number"
                  value={form.warrantyMonths}
                  onChange={(e) =>
                    setForm({ ...form, warrantyMonths: e.target.value })
                  }
                />
              </label>
            </>
          ) : (
            <>
              <label>Producto{selP}</label>
              <label>
                Nombre de presentación
                <input
                  placeholder="Caja x 12"
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label>
                Unidad
                <select
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                >
                  <option>unidad</option>
                  <option>caja</option>
                  <option>paquete</option>
                  <option>kilogramo</option>
                  <option>litro</option>
                  <option>metro</option>
                </select>
              </label>
              <label>
                Factor de conversión
                <input
                  type="number"
                  value={form.conversionFactor}
                  onChange={(e) =>
                    setForm({ ...form, conversionFactor: e.target.value })
                  }
                />
              </label>
              <label>
                Código de barras
                <input
                  onChange={(e) =>
                    setForm({ ...form, barcode: e.target.value })
                  }
                />
              </label>
              <label>
                Precio de venta
                <input
                  type="number"
                  onChange={(e) =>
                    setForm({ ...form, salePrice: e.target.value })
                  }
                />
              </label>
            </>
          )}
        </div>
        <div className="modal-actions">
          <button className="secondary" onClick={close}>
            Cancelar
          </button>
          <button className="primary" onClick={() => save(type)}>
            Guardar
          </button>
        </div>
      </section>
    </div>
  );
}
