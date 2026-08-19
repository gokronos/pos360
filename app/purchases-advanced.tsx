"use client";
import { useEffect, useState } from "react";
import { readJson } from "./api-client";

const money = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n || 0);
type Order = {
  id: string;
  number: string;
  supplierName: string;
  status: string;
  total: number;
  balance: number;
  dueDate: string;
  receiptCount: number;
};
type Product = { id: string; name: string; cost: number; stock: number };
type Summary = {
  payable: number;
  overdue: number;
  openAccounts: number;
  monthPurchases: number;
};

export default function Purchases({ notify }: { notify: (s: string) => void }) {
  const [orders, setOrders] = useState<Order[]>([]),
    [products, setProducts] = useState<Product[]>([]),
    [summary, setSummary] = useState<Summary>({
      payable: 0,
      overdue: 0,
      openAccounts: 0,
      monthPurchases: 0,
    }),
    [aging, setAging] = useState<
      { supplier: string; balance: number; nextDue: string; overdue: number }[]
    >([]),
    [returns, setReturns] = useState<
      {
        reference: string;
        supplier: string;
        total: number;
        reason: string;
        createdAt: string;
      }[]
    >([]),
    [selected, setSelected] = useState<Order | null>(null),
    [mode, setMode] = useState<"receive" | "return" | null>(null),
    [percent, setPercent] = useState("100"),
    [productId, setProductId] = useState(""),
    [quantity, setQuantity] = useState("1"),
    [reason, setReason] = useState("Producto averiado");
  const load = async () => {
    await fetch("/api/bootstrap");
    const [o, p, r] = await Promise.all([
      fetch("/api/purchases"),
      fetch("/api/products"),
      fetch("/api/purchase-reports"),
    ]);
    const [od, pd, rd] = await Promise.all([o.json(), p.json(), r.json()]);
    setOrders(od.orders || []);
    setProducts(pd.products || []);
    setSummary(rd.summary || {});
    setAging(rd.aging || []);
    setReturns(rd.returns || []);
  };
  useEffect(() => {
    load();
  }, []);
  const act = async () => {
    if (!selected || !mode) return;
    const body =
      mode === "receive"
        ? { action: "receive", orderId: selected.id, percent: Number(percent) }
        : {
            action: "return",
            orderId: selected.id,
            productId,
            quantity: Number(quantity),
            reason,
          };
    const r = await fetch("/api/purchases", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      d = await readJson<any>(r);
    if (!r.ok) return notify(d.error);
    setMode(null);
    notify(
      mode === "receive"
        ? `Recepción ${d.reference} registrada`
        : `Devolución ${d.reference} aplicada`,
    );
    load();
  };
  const status = (o: Order) =>
    o.status === "received"
      ? "Recibida"
      : o.status === "partial"
        ? "Recepción parcial"
        : "Pendiente";
  return (
    <>
      <div className="page-intro">
        <div>
          <h2>Compras y cuentas por pagar</h2>
          <p>
            Recepciones parciales, devoluciones, vencimientos y control
            financiero.
          </p>
        </div>
        <span className="db-badge">● Información actualizada</span>
      </div>
      <div className="summary-strip">
        <K
          label="Compras del mes"
          value={money(summary.monthPurchases)}
          tone="blue"
        />
        <K
          label="Saldo por pagar"
          value={money(summary.payable)}
          tone="purple"
        />
        <K
          label="Cartera vencida"
          value={money(summary.overdue)}
          tone="orange"
        />
        <K
          label="Cuentas abiertas"
          value={String(summary.openAccounts || 0)}
          tone="green"
        />
      </div>
      <div className="purchase-dashboard">
        <article className="panel table-panel">
          <div className="filters">
            <b>Órdenes y recepciones</b>
            <span className="db-badge">Recepción parcial habilitada</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Orden</th>
                <th>Proveedor</th>
                <th>Total</th>
                <th>Saldo</th>
                <th>Vencimiento</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {orders.length ? (
                orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <b>{o.number}</b>
                      <small className="cell-sub">
                        {o.receiptCount || 0} recepción(es)
                      </small>
                    </td>
                    <td>{o.supplierName}</td>
                    <td>{money(o.total)}</td>
                    <td className={o.balance > 0 ? "debt" : ""}>
                      {money(o.balance)}
                    </td>
                    <td>{o.dueDate || "—"}</td>
                    <td>
                      <span
                        className={
                          o.status === "received" ? "status ok" : "status low"
                        }
                      >
                        {status(o)}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        {o.status !== "received" && (
                          <button
                            className="table-action"
                            onClick={() => {
                              setSelected(o);
                              setPercent("50");
                              setMode("receive");
                            }}
                          >
                            Recibir
                          </button>
                        )}
                        {o.receiptCount > 0 && (
                          <button
                            className="table-action danger"
                            onClick={() => {
                              setSelected(o);
                              setMode("return");
                            }}
                          >
                            Devolver
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>Todavía no hay órdenes registradas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </article>
        <aside className="panel">
          <div className="panel-head">
            <div>
              <h3>Vencimientos por proveedor</h3>
              <p>Prioridad de pago</p>
            </div>
          </div>
          {aging.length ? (
            aging.map((a, i) => (
              <div className="supplier-aging" key={i}>
                <div>
                  <b>{a.supplier}</b>
                  <small>Próximo: {a.nextDue}</small>
                </div>
                <strong>{money(a.balance)}</strong>
                {a.overdue > 0 && <span>Vencido {money(a.overdue)}</span>}
              </div>
            ))
          ) : (
            <div className="success-box">No hay cuentas pendientes.</div>
          )}
        </aside>
      </div>
      <article className="panel table-panel returns-panel">
        <div className="filters">
          <b>Últimas devoluciones a proveedores</b>
        </div>
        <table>
          <thead>
            <tr>
              <th>Referencia</th>
              <th>Proveedor</th>
              <th>Motivo</th>
              <th>Fecha</th>
              <th>Valor descontado</th>
            </tr>
          </thead>
          <tbody>
            {returns.length ? (
              returns.map((x) => (
                <tr key={x.reference}>
                  <td>
                    <b>{x.reference}</b>
                  </td>
                  <td>{x.supplier}</td>
                  <td>{x.reason}</td>
                  <td>{new Date(x.createdAt).toLocaleDateString("es-CO")}</td>
                  <td>{money(x.total)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>Sin devoluciones registradas.</td>
              </tr>
            )}
          </tbody>
        </table>
      </article>
      {mode && selected && (
        <div className="modal-backdrop" onMouseDown={() => setMode(null)}>
          <section
            className="modal compact-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <h3>
                  {mode === "receive"
                    ? "Recibir mercancía"
                    : "Devolver al proveedor"}
                </h3>
                <p>
                  {selected.number} · {selected.supplierName}
                </p>
              </div>
              <button onClick={() => setMode(null)}>×</button>
            </div>
            <div className="payment-body">
              {mode === "receive" ? (
                <>
                  <label>
                    Porcentaje de mercancía a recibir
                    <select
                      value={percent}
                      onChange={(e) => setPercent(e.target.value)}
                    >
                      <option value="25">25% de lo pendiente</option>
                      <option value="50">50% de lo pendiente</option>
                      <option value="75">75% de lo pendiente</option>
                      <option value="100">100% de lo pendiente</option>
                    </select>
                  </label>
                  <div className="success-box">
                    Solo la mercancía recibida aumentará el inventario y
                    generará la cuenta por pagar.
                  </div>
                </>
              ) : (
                <>
                  <label>
                    Producto
                    <select
                      value={productId}
                      onChange={(e) => setProductId(e.target.value)}
                    >
                      <option value="">Seleccione</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · Disponible {p.stock}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Cantidad
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </label>
                  <label>
                    Motivo
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                  <div className="success-box">
                    La devolución descontará existencias y reducirá el saldo con
                    el proveedor.
                  </div>
                </>
              )}
            </div>
            <div className="modal-actions">
              <button className="secondary" onClick={() => setMode(null)}>
                Cancelar
              </button>
              <button className="primary" onClick={act}>
                {mode === "receive"
                  ? "Confirmar recepción"
                  : "Registrar devolución"}
              </button>
            </div>
          </section>
        </div>
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
      <div className={`kpi-icon ${tone}`}>$</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>Control de proveedores</small>
      </div>
    </div>
  );
}
