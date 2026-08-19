"use client";
import { useEffect, useMemo, useState } from "react";
import Purchases from "./purchases-advanced";
import Customers from "./customers-advanced";
import Settings from "./admin-settings";
import SyncStatus, {
  offlinePost,
  offlinePatch,
  getDeviceId,
} from "./offline-sync";
import { useAccess } from "./access-control";
import POS from "./pos-advanced";
import Inventory from "./inventory-advanced";
import { readJson } from "./api-client";
import BusinessSetupWizard from "./business-setup-wizard";
import ReportsReal, { DashboardReal } from "./reports-real";
import SectorTools from "./sector-tools";
import PlatformOwner from "./platform-owner";
import ElectronicBilling from "./electronic-billing";
type View =
  | "dashboard"
  | "pos"
  | "inventario"
  | "compras"
  | "clientes"
  | "reportes"
  | "sector"
  | "facturacion"
  | "configuracion"
  | "saas";
const nav: { id: View; label: string; icon: string }[] = [
  { id: "dashboard", label: "Inicio", icon: "⌂" },
  { id: "pos", label: "Punto de venta", icon: "▣" },
  { id: "inventario", label: "Inventario", icon: "▦" },
  { id: "compras", label: "Compras", icon: "↓" },
  { id: "clientes", label: "Clientes", icon: "◎" },
  { id: "reportes", label: "Reportes", icon: "↗" },
  { id: "sector", label: "Mi sector", icon: "✦" },
  { id: "facturacion", label: "Facturación electrónica", icon: "▤" },
  { id: "configuracion", label: "Configuración", icon: "⚙" },
  { id: "saas", label: "Panel POS360", icon: "◇" },
];
const moduleFor: Record<View, string> = {
  dashboard: "dashboard",
  pos: "pos",
  inventario: "inventory",
  compras: "purchases",
  clientes: "customers",
  reportes: "reports",
  sector: "dashboard",
  facturacion: "settings",
  configuracion: "settings",
  saas: "saas",
};
const products = [
  {
    id: 1,
    name: "Arroz Diana premium 1 kg",
    code: "7702129011002",
    category: "Granos",
    price: 5200,
    stock: 38,
    color: "#fff4dc",
    emoji: "A",
  },
  {
    id: 2,
    name: "Leche entera 1 litro",
    code: "7702004003405",
    category: "Lácteos",
    price: 3900,
    stock: 24,
    color: "#e8f4ff",
    emoji: "L",
  },
  {
    id: 3,
    name: "Aceite vegetal 900 ml",
    code: "7702057001113",
    category: "Despensa",
    price: 11200,
    stock: 12,
    color: "#fff3ca",
    emoji: "O",
  },
  {
    id: 4,
    name: "Café molido 500 g",
    code: "7702011000206",
    category: "Bebidas",
    price: 18500,
    stock: 17,
    color: "#f1e6dd",
    emoji: "C",
  },
  {
    id: 5,
    name: "Acetaminofén 500 mg",
    code: "7709991002203",
    category: "Droguería",
    price: 850,
    stock: 106,
    color: "#e8f8ef",
    emoji: "+",
  },
  {
    id: 6,
    name: "Tornillo drywall 1 pulg.",
    code: "FER-00125",
    category: "Ferretería",
    price: 180,
    stock: 840,
    color: "#edf0f2",
    emoji: "T",
  },
];
const money = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);
export default function Home() {
  const { session, can, loading } = useAccess();
  const [view, setView] = useState<View>("dashboard"),
    [collapsed, setCollapsed] = useState(false),
    [cart, setCart] = useState<{ id: number; qty: number }[]>([
      { id: 2, qty: 2 },
      { id: 4, qty: 1 },
    ]),
    [search, setSearch] = useState(""),
    [toast, setToast] = useState("");
  const notify = (t: string) => {
      setToast(t);
      window.setTimeout(() => setToast(""), 2200);
    },
    add = (id: number) =>
      setCart((c) =>
        c.some((x) => x.id === id)
          ? c.map((x) => (x.id === id ? { ...x, qty: x.qty + 1 } : x))
          : [...c, { id, qty: 1 }],
      ),
    total = useMemo(
      () =>
        cart.reduce(
          (s, x) =>
            s + (products.find((p) => p.id === x.id)?.price || 0) * x.qty,
          0,
        ),
      [cart],
    ),
    title = nav.find((n) => n.id === view)?.label;
  if (loading)
    return <main className="setup-loading">Preparando su empresa…</main>;
  if (session && !session.configuration.completed)
    return <BusinessSetupWizard session={session} />;
  return (
    <main className="app-shell">
      <aside className={collapsed ? "sidebar collapsed" : "sidebar"}>
        <div className="brand">
          <div className="brand-mark">P</div>
          <div className="brand-copy">
            <strong>POS360</strong>
            <span>Gestión comercial</span>
          </div>
        </div>
        <button className="collapse" onClick={() => setCollapsed(!collapsed)}>
          ‹
        </button>
        <nav>
          {nav
            .filter((x) => can(moduleFor[x.id]))
            .map((x) => (
              <button
                key={x.id}
                className={view === x.id ? "nav-item active" : "nav-item"}
                onClick={() => setView(x.id)}
              >
                <span className="nav-icon">{x.icon}</span>
                <span>{x.label}</span>
              </button>
            ))}
        </nav>
        <SyncStatus />
        <div className="user-card">
          <div className="avatar">
            {session?.user.name?.slice(0, 2).toUpperCase() || "AM"}
          </div>
          <div>
            <b>{session?.user.name || "Cargando..."}</b>
            <small>{session?.user.role || "Usuario"}</small>
          </div>
          <button>⋮</button>
        </div>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div>
            <small>
              {`${session?.tenant.name || "POS360"} · ${session?.branch.name || "Sede"}`}
            </small>
            <h1>{title}</h1>
          </div>
          <div className="top-actions">
            <button className="icon-btn">?</button>
            <button className="icon-btn notification">
              ♢<i>3</i>
            </button>
            {can("pos") && (
              <button
                className="primary compact"
                onClick={() => setView("pos")}
              >
                + Nueva venta
              </button>
            )}
          </div>
        </header>
        <div className="content">
          {view === "dashboard" && <DashboardReal go={(target) => setView(target)} />}{" "}
          {view === "pos" && can("pos") && (
            <POS
              cart={cart}
              setCart={setCart}
              add={add}
              total={total}
              search={search}
              setSearch={setSearch}
              notify={notify}
            />
          )}{" "}
          {view === "inventario" && can("inventory") && (
            <Inventory notify={notify} />
          )}{" "}
          {view === "compras" && can("purchases") && (
            <Purchases notify={notify} />
          )}{" "}
          {view === "clientes" && can("customers") && (
            <Customers notify={notify} />
          )}{" "}
          {view === "reportes" && can("reports") && <ReportsReal />}{" "}
          {view === "sector" && can("dashboard") && <SectorTools notify={notify} />}{" "}
          {view === "facturacion" && can("settings") && <ElectronicBilling notify={notify} />}{" "}
          {view === "configuracion" && can("settings") && (
            <Settings notify={notify} />
          )}{" "}
          {view === "saas" && can("saas") && <SaaS />}
        </div>
      </section>
      {toast && <div className="toast">✓ {toast}</div>}
    </main>
  );
}
function DashboardLegacy({ go }: { go: (v: View) => void }) {
  return (
    <>
      <div className="welcome">
        <div>
          <span className="eyebrow">Martes, 18 de agosto</span>
          <h2>Buenos días, Andrés</h2>
          <p>
            Su negocio está operando con normalidad. Hay 4 alertas que requieren
            atención.
          </p>
        </div>
        <button className="secondary" onClick={() => go("reportes")}>
          Ver reporte del día
        </button>
      </div>
      <div className="kpi-grid">
        <KPI
          label="Ventas de hoy"
          value="$ 4.286.500"
          change="+12,4% frente a ayer"
          tone="green"
          icon="$"
        />
        <KPI
          label="Transacciones"
          value="148"
          change="Ticket promedio $28.963"
          tone="blue"
          icon="#"
        />
        <KPI
          label="Utilidad estimada"
          value="$ 1.142.800"
          change="Margen 26,6%"
          tone="purple"
          icon="↗"
        />
        <KPI
          label="Caja actual"
          value="$ 1.864.200"
          change="Abierta hace 6 h 24 min"
          tone="orange"
          icon="▣"
        />
      </div>
      <div className="dashboard-grid">
        <article className="panel sales-panel">
          <div className="panel-head">
            <div>
              <h3>Ventas de la semana</h3>
              <p>Comparativo diario</p>
            </div>
            <select>
              <option>Últimos 7 días</option>
            </select>
          </div>
          <div className="chart">
            <div className="y-labels">
              <span>6M</span>
              <span>4M</span>
              <span>2M</span>
              <span>0</span>
            </div>
            <div className="bars">
              {[42, 58, 46, 72, 83, 95, 68].map((h, i) => (
                <div className="bar-col" key={i}>
                  <div className="bar" style={{ height: `${h}%` }}>
                    <span>{i === 5 ? "$5,8M" : ""}</span>
                  </div>
                  <small>
                    {["Mié", "Jue", "Vie", "Sáb", "Dom", "Lun", "Hoy"][i]}
                  </small>
                </div>
              ))}
            </div>
          </div>
        </article>
        <article className="panel alerts">
          <div className="panel-head">
            <div>
              <h3>Alertas importantes</h3>
              <p>Acciones pendientes</p>
            </div>
            <button>Ver todas</button>
          </div>
          <Alert
            tone="red"
            icon="!"
            title="8 productos agotados"
            text="Requieren reposición inmediata"
          />
          <Alert
            tone="orange"
            icon="◷"
            title="12 lotes próximos a vencer"
            text="Dentro de los próximos 30 días"
          />
          <Alert
            tone="blue"
            icon="↓"
            title="3 compras por recibir"
            text="Órdenes aprobadas y en tránsito"
          />
          <Alert
            tone="purple"
            icon="$"
            title="$845.000 en cartera vencida"
            text="6 clientes con pagos pendientes"
          />
        </article>
      </div>
      <div className="dashboard-grid lower">
        <article className="panel">
          <div className="panel-head">
            <div>
              <h3>Productos más vendidos</h3>
              <p>Por ingresos de hoy</p>
            </div>
            <button onClick={() => go("inventario")}>Ver inventario</button>
          </div>
          {products.slice(0, 4).map((p, i) => (
            <div className="product-row" key={p.id}>
              <span className="rank">{i + 1}</span>
              <div className="product-badge" style={{ background: p.color }}>
                {p.emoji}
              </div>
              <div>
                <b>{p.name}</b>
                <small>{[36, 31, 24, 19][i]} unidades</small>
              </div>
              <strong>{money(p.price * [36, 31, 24, 19][i])}</strong>
            </div>
          ))}
        </article>
        <article className="panel">
          <div className="panel-head">
            <div>
              <h3>Actividad reciente</h3>
              <p>Últimos movimientos</p>
            </div>
          </div>
          {[
            ["Venta #V-8451", "María P. · Caja 2", "$ 48.500", "Hace 3 min"],
            [
              "Recepción OC-0182",
              "Ferremax SAS",
              "32 productos",
              "Hace 18 min",
            ],
            [
              "Abono de cliente",
              "Constructora Norte",
              "$ 350.000",
              "Hace 42 min",
            ],
            [
              "Cierre de caja",
              "Juan C. · Caja 1",
              "Sin diferencia",
              "Hace 1 h",
            ],
          ].map((r, i) => (
            <div className="activity" key={i}>
              <div className="activity-icon">{["$", "↓", "◎", "✓"][i]}</div>
              <div>
                <b>{r[0]}</b>
                <small>{r[1]}</small>
              </div>
              <div>
                <strong>{r[2]}</strong>
                <small>{r[3]}</small>
              </div>
            </div>
          ))}
        </article>
      </div>
    </>
  );
}
function POSLegacy({
  notify,
}: {
  cart: { id: number; qty: number }[];
  setCart: React.Dispatch<React.SetStateAction<{ id: number; qty: number }[]>>;
  add: (id: number) => void;
  total: number;
  search: string;
  setSearch: (s: string) => void;
  notify: (s: string) => void;
}) {
  type P = {
    id: string;
    sku: string;
    barcode: string | null;
    name: string;
    category: string;
    price: number;
    stock: number;
    active: number;
  };
  const [items, setItems] = useState<P[]>([]),
    [basket, setBasket] = useState<{ id: string; qty: number }[]>([]),
    [query, setQuery] = useState(""),
    [cash, setCash] = useState<{
      id: string;
      openingAmount: number;
      registerName: string;
    } | null>(null),
    [modal, setModal] = useState<"cash" | "payment" | "receipt" | null>(null),
    [base, setBase] = useState("100000"),
    [method, setMethod] = useState("cash"),
    [received, setReceived] = useState(""),
    [processing, setProcessing] = useState(false),
    [receipt, setReceipt] = useState<{
      number: string;
      total: number;
      change: number;
      method: string;
    } | null>(null),
    [customers, setCustomers] = useState<
      { id: string; name: string; creditLimit: number; balance: number }[]
    >([]),
    [customerId, setCustomerId] = useState("");
  const load = async () => {
    await fetch("/api/bootstrap");
    const [p, c, cu] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/cash"),
        fetch("/api/customers"),
      ]),
      pd = await readJson<any>(p),
      cd = await readJson<any>(c),
      cud = await readJson<any>(cu);
    setItems((pd.products || []).filter((x: P) => x.active));
    setCash(cd.session || null);
    setCustomers(cud.customers || []);
    if (!cd.session) setModal("cash");
  };
  useEffect(() => {
    load();
  }, []);
  const filtered = items.filter(
      (p) =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.sku.toLowerCase().includes(query.toLowerCase()) ||
        (p.barcode || "").includes(query),
    ),
    addReal = (id: string) =>
      setBasket((c) =>
        c.some((x) => x.id === id)
          ? c.map((x) =>
              x.id === id
                ? {
                    ...x,
                    qty: Math.min(
                      x.qty + 1,
                      items.find((p) => p.id === id)?.stock || x.qty,
                    ),
                  }
                : x,
            )
          : [...c, { id, qty: 1 }],
      ),
    change = (id: string, d: number) =>
      setBasket((c) =>
        c.map((x) =>
          x.id === id
            ? {
                ...x,
                qty: Math.max(
                  1,
                  Math.min(
                    x.qty + d,
                    items.find((p) => p.id === id)?.stock || x.qty,
                  ),
                ),
              }
            : x,
        ),
      ),
    sum = basket.reduce(
      (s, x) => s + (items.find((p) => p.id === x.id)?.price || 0) * x.qty,
      0,
    );
  const openCash = async () => {
    const r = await fetch("/api/cash", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "open", amount: Number(base) }),
      }),
      d = await readJson<any>(r);
    if (!r.ok) return notify(d.error || "No fue posible abrir la caja");
    setCash(d.session);
    setModal(null);
    notify("Caja abierta correctamente");
  };
  const checkout = async () => {
    setProcessing(true);
    const localId = `web-${crypto.randomUUID()}`,
      payload = {
        localId,
        method,
        customerId: customerId || undefined,
        received: Number(received || sum),
        total: sum,
        items: basket.map((x) => ({ productId: x.id, quantity: x.qty })),
      },
      r = await offlinePost("/api/sales", payload),
      d = await readJson<any>(r);
    setProcessing(false);
    if (!r.ok) {
      if (d.needsCashOpen) setModal("cash");
      return notify(d.error || "No fue posible registrar la venta");
    }
    setReceipt(d.sale);
    setBasket([]);
    setModal("receipt");
    if (!d.queued) load();
    else notify("Venta guardada sin conexión. Se sincronizará automáticamente");
  };
  return (
    <>
      <div className="cash-bar">
        <div>
          <span className={cash ? "online-dot" : "cash-dot"} />
          <b>{cash ? `${cash.registerName} abierta` : "Caja cerrada"}</b>
          <small>
            {cash
              ? `Base ${money(cash.openingAmount)}`
              : "Abra la caja para comenzar"}
          </small>
        </div>
        <button onClick={() => setModal("cash")}>
          {cash ? "Ver caja" : "Abrir caja"}
        </button>
      </div>
      <div className="pos-layout">
        <section className="catalog">
          <div className="pos-search">
            <span>⌕</span>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Escanee un código o busque un producto..."
            />
            <kbd>F2</kbd>
          </div>
          <div className="chips">
            <button className="selected">Todos</button>
            {["Despensa", "Droguería", "Ferretería"].map((x) => (
              <button key={x}>{x}</button>
            ))}
          </div>
          <div className="product-grid">
            {filtered.map((p) => (
              <button
                className="product-card"
                disabled={p.stock <= 0}
                key={p.id}
                onClick={() => addReal(p.id)}
              >
                <div className="product-art">
                  {p.name.slice(0, 1)}
                  <span>{p.stock} disp.</span>
                </div>
                <div>
                  <small>{p.category}</small>
                  <b>{p.name}</b>
                  <strong>{money(p.price)}</strong>
                </div>
              </button>
            ))}
          </div>
        </section>
        <aside className="cart">
          <div className="cart-head">
            <div>
              <h3>Venta actual</h3>
              <small>Datos reales · {cash?.registerName || "Sin caja"}</small>
            </div>
            <button onClick={() => setBasket([])}>Limpiar</button>
          </div>
          <button className="customer">
            <span className="mini-avatar">+</span>
            <div>
              <b>Agregar cliente</b>
              <small>Consumidor final</small>
            </div>
            <span>›</span>
          </button>
          <div className="cart-lines">
            {!basket.length ? (
              <div className="empty">
                <span>▣</span>
                <b>La venta está vacía</b>
                <small>Agregue productos desde el catálogo</small>
              </div>
            ) : (
              basket.map((x) => {
                const p = items.find((y) => y.id === x.id)!;
                return (
                  <div className="cart-line" key={x.id}>
                    <div className="product-badge">{p.name.slice(0, 1)}</div>
                    <div className="line-info">
                      <b>{p.name}</b>
                      <small>{money(p.price)} c/u</small>
                      <div className="qty">
                        <button onClick={() => change(p.id, -1)}>−</button>
                        <span>{x.qty}</span>
                        <button onClick={() => change(p.id, 1)}>+</button>
                      </div>
                    </div>
                    <strong>{money(p.price * x.qty)}</strong>
                  </div>
                );
              })
            )}
          </div>
          <div className="cart-summary">
            <div>
              <span>Subtotal</span>
              <b>{money(sum)}</b>
            </div>
            <div>
              <span>Impuestos incluidos</span>
              <b>{money(Math.round(sum * 0.095))}</b>
            </div>
            <div className="total">
              <span>Total</span>
              <b>{money(sum)}</b>
            </div>
            <button
              className="pay"
              disabled={!basket.length || !cash}
              onClick={() => {
                setReceived(String(sum));
                setModal("payment");
              }}
            >
              <span>Cobrar</span>
              <b>{money(sum)}</b>
              <kbd>F9</kbd>
            </button>
            <div className="pos-shortcuts">
              <span>F4 Suspender</span>
              <span>F6 Descuento</span>
              <span>F8 Cliente</span>
            </div>
          </div>
        </aside>
      </div>
      {modal && (
        <div className="modal-backdrop">
          <section className="modal compact-modal">
            <div className="modal-head">
              <div>
                <h3>
                  {modal === "cash"
                    ? cash
                      ? "Caja abierta"
                      : "Abrir caja"
                    : modal === "payment"
                      ? "Registrar pago"
                      : "Venta completada"}
                </h3>
                <p>
                  {modal === "receipt"
                    ? receipt?.number
                    : "Caja 2 · Sede Centro"}
                </p>
              </div>
              {cash && modal !== "receipt" && (
                <button onClick={() => setModal(null)}>×</button>
              )}
            </div>
            {modal === "cash" ? (
              <div className="payment-body">
                {cash ? (
                  <>
                    <div className="receipt-total">
                      <span>Base inicial</span>
                      <b>{money(cash.openingAmount)}</b>
                    </div>
                    <div className="success-box">
                      ✓ Caja disponible para registrar ventas
                    </div>
                  </>
                ) : (
                  <label>
                    Base inicial de efectivo
                    <input
                      autoFocus
                      type="number"
                      value={base}
                      onChange={(e) => setBase(e.target.value)}
                    />
                  </label>
                )}
              </div>
            ) : modal === "payment" ? (
              <div className="payment-body">
                <div className="receipt-total">
                  <span>Total a pagar</span>
                  <b>{money(sum)}</b>
                </div>
                <div className="payment-methods">
                  {[
                    ["cash", "Efectivo"],
                    ["card", "Tarjeta"],
                    ["transfer", "Transferencia"],
                    ["credit", "Crédito"],
                  ].map((x) => (
                    <button
                      className={method === x[0] ? "selected" : ""}
                      key={x[0]}
                      onClick={() => setMethod(x[0])}
                    >
                      {x[1]}
                    </button>
                  ))}
                </div>
                {method === "credit" && (
                  <label>
                    Cliente
                    <select
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                    >
                      <option value="">Seleccione un cliente</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} · Disponible{" "}
                          {money(Math.max(0, c.creditLimit - c.balance))}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {method === "cash" && (
                  <label>
                    Efectivo recibido
                    <input
                      type="number"
                      value={received}
                      onChange={(e) => setReceived(e.target.value)}
                    />
                    <small>
                      Cambio: {money(Math.max(0, Number(received || 0) - sum))}
                    </small>
                  </label>
                )}
              </div>
            ) : (
              <div className="payment-body receipt-view">
                <div className="receipt-check">✓</div>
                <h3>Pago aprobado</h3>
                <div className="receipt-total">
                  <span>Total</span>
                  <b>{money(receipt?.total || 0)}</b>
                </div>
                <div className="receipt-total">
                  <span>Medio</span>
                  <b>{receipt?.method}</b>
                </div>
                <div className="receipt-total">
                  <span>Cambio</span>
                  <b>{money(receipt?.change || 0)}</b>
                </div>
                <small>Venta sincronizada con inventario y caja</small>
              </div>
            )}
            <div className="modal-actions">
              {modal === "cash" && !cash && (
                <button className="primary" onClick={openCash}>
                  Abrir caja
                </button>
              )}
              {modal === "cash" && cash && (
                <button className="primary" onClick={() => setModal(null)}>
                  Continuar vendiendo
                </button>
              )}
              {modal === "payment" && (
                <>
                  <button className="secondary" onClick={() => setModal(null)}>
                    Cancelar
                  </button>
                  <button
                    className="primary"
                    disabled={
                      processing ||
                      (method === "cash" && Number(received) < sum) ||
                      (method === "credit" && !customerId)
                    }
                    onClick={checkout}
                  >
                    {processing ? "Registrando..." : "Confirmar pago"}
                  </button>
                </>
              )}
              {modal === "receipt" && (
                <button className="primary" onClick={() => setModal(null)}>
                  Nueva venta
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
function InventoryLegacy({ notify }: { notify: (s: string) => void }) {
  type P = {
    id: string;
    sku: string;
    barcode: string | null;
    name: string;
    category: string;
    price: number;
    cost: number;
    stock: number;
    version: number;
    active: number;
  };
  const [term, setTerm] = useState(""),
    [items, setItems] = useState<P[]>([]),
    [loading, setLoading] = useState(true),
    [modal, setModal] = useState<"new" | "adjust" | null>(null),
    [selected, setSelected] = useState<P | null>(null),
    [form, setForm] = useState({
      sku: "",
      barcode: "",
      name: "",
      category: "",
      price: "",
      cost: "",
      stock: "",
    }),
    [adjust, setAdjust] = useState({ quantity: "", reason: "Conteo físico" });
  const load = async (q = "") => {
    setLoading(true);
    try {
      await fetch("/api/bootstrap");
      const r = await fetch(`/api/products?q=${encodeURIComponent(q)}`),
        d = await readJson<any>(r);
      setItems(d.products || []);
    } catch {
      notify("No fue posible cargar el inventario");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    const t = setTimeout(() => load(term), 300);
    return () => clearTimeout(t);
  }, [term]);
  const save = async () => {
    const payload = {
        ...form,
        price: Number(form.price),
        cost: Number(form.cost),
        stock: Number(form.stock),
      },
      r = await offlinePost("/api/products", payload),
      d = await readJson<any>(r);
    if (!r.ok) return notify(d.error || "Revise los datos");
    setModal(null);
    setForm({
      sku: "",
      barcode: "",
      name: "",
      category: "",
      price: "",
      cost: "",
      stock: "",
    });
    notify(
      d.queued
        ? "Producto guardado sin conexión"
        : "Producto creado y guardado",
    );
    if (!d.queued) load(term);
  };
  const apply = async () => {
    if (!selected) return;
    const r = await offlinePatch("/api/products", {
        id: selected.id,
        adjustment: Number(adjust.quantity),
        reason: adjust.reason,
        version: selected.version,
        deviceId: getDeviceId(),
      }),
      d = await readJson<any>(r);
    if (!r.ok) return notify(d.error || "No fue posible ajustar");
    setModal(null);
    notify(
      d.queued
        ? "Ajuste guardado para sincronizar"
        : "Existencias actualizadas con trazabilidad",
    );
    if (!d.queued) load(term);
  };
  const active = items.filter((x) => x.active).length,
    value = items.reduce((s, x) => s + x.stock * x.cost, 0),
    low = items.filter((x) => x.active && x.stock < 15).length;
  return (
    <>
      <div className="page-intro">
        <div>
          <h2>Inventario general</h2>
          <p>Datos persistentes · Sede Centro</p>
        </div>
        <div>
          <button
            className="secondary"
            onClick={() => notify("Exportación preparada")}
          >
            Exportar
          </button>
          <button className="primary" onClick={() => setModal("new")}>
            + Nuevo producto
          </button>
        </div>
      </div>
      <div className="summary-strip">
        <KPI
          label="Productos activos"
          value={String(active)}
          change={`${items.length} registros totales`}
          tone="blue"
          icon="▦"
        />
        <KPI
          label="Valor del inventario"
          value={money(value)}
          change="Según costo registrado"
          tone="green"
          icon="$"
        />
        <KPI
          label="Stock bajo"
          value={String(low)}
          change="Menos de 15 unidades"
          tone="orange"
          icon="!"
        />
        <KPI
          label="Sincronización"
          value="Activa"
          change="Base central conectada"
          tone="green"
          icon="↻"
        />
      </div>
      <article className="panel table-panel">
        <div className="filters">
          <div className="table-search">
            ⌕
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Buscar producto, código o referencia..."
            />
          </div>
          <span className="db-badge">● Datos guardados</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>SKU / código</th>
              <th>Categoría</th>
              <th>Existencias</th>
              <th>Costo</th>
              <th>Precio</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8}>Cargando inventario...</td>
              </tr>
            ) : (
              items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="table-product">
                      <span className="product-badge">
                        {p.name.slice(0, 1)}
                      </span>
                      <b>{p.name}</b>
                    </div>
                  </td>
                  <td>
                    {p.sku}
                    <small className="cell-sub">
                      {p.barcode || "Sin código"}
                    </small>
                  </td>
                  <td>{p.category}</td>
                  <td>
                    <b>{p.stock}</b> und.
                  </td>
                  <td>{money(p.cost)}</td>
                  <td>
                    <b>{money(p.price)}</b>
                  </td>
                  <td>
                    <span
                      className={
                        !p.active
                          ? "status inactive"
                          : p.stock < 15
                            ? "status low"
                            : "status ok"
                      }
                    >
                      {!p.active
                        ? "Inactivo"
                        : p.stock < 15
                          ? "Stock bajo"
                          : "Disponible"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="table-action"
                      onClick={() => {
                        setSelected(p);
                        setAdjust({ quantity: "", reason: "Conteo físico" });
                        setModal("adjust");
                      }}
                    >
                      Ajustar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </article>
      {modal && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <section className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3>
                  {modal === "new" ? "Nuevo producto" : "Ajustar existencias"}
                </h3>
                <p>
                  {modal === "new"
                    ? "El registro quedará disponible para ventas e inventario."
                    : selected?.name}
                </p>
              </div>
              <button onClick={() => setModal(null)}>×</button>
            </div>
            {modal === "new" ? (
              <div className="form-grid">
                <label>
                  Nombre
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>
                <label>
                  SKU
                  <input
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  />
                </label>
                <label>
                  Código de barras
                  <input
                    value={form.barcode}
                    onChange={(e) =>
                      setForm({ ...form, barcode: e.target.value })
                    }
                  />
                </label>
                <label>
                  Categoría
                  <input
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value })
                    }
                  />
                </label>
                <label>
                  Costo
                  <input
                    type="number"
                    value={form.cost}
                    onChange={(e) => setForm({ ...form, cost: e.target.value })}
                  />
                </label>
                <label>
                  Precio de venta
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) =>
                      setForm({ ...form, price: e.target.value })
                    }
                  />
                </label>
                <label>
                  Inventario inicial
                  <input
                    type="number"
                    value={form.stock}
                    onChange={(e) =>
                      setForm({ ...form, stock: e.target.value })
                    }
                  />
                </label>
              </div>
            ) : (
              <div className="form-grid one">
                <label>
                  Cantidad del ajuste
                  <input
                    autoFocus
                    type="number"
                    placeholder="Use negativo para retirar"
                    value={adjust.quantity}
                    onChange={(e) =>
                      setAdjust({ ...adjust, quantity: e.target.value })
                    }
                  />
                </label>
                <label>
                  Motivo
                  <textarea
                    value={adjust.reason}
                    onChange={(e) =>
                      setAdjust({ ...adjust, reason: e.target.value })
                    }
                  />
                </label>
                <div className="balance-preview">
                  <span>Existencia actual</span>
                  <b>{selected?.stock} unidades</b>
                  <span>Nuevo saldo</span>
                  <strong>
                    {(selected?.stock || 0) + Number(adjust.quantity || 0)}{" "}
                    unidades
                  </strong>
                </div>
              </div>
            )}
            <div className="modal-actions">
              <button className="secondary" onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button
                className="primary"
                onClick={modal === "new" ? save : apply}
              >
                {modal === "new" ? "Guardar producto" : "Aplicar ajuste"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
function Generic({
  title,
  lead,
  action,
  rows,
  notify,
}: {
  title: string;
  lead: string;
  action: string;
  rows: string[][];
  notify: (s: string) => void;
}) {
  return (
    <>
      <div className="page-intro">
        <div>
          <h2>{title}</h2>
          <p>{lead}</p>
        </div>
        <button
          className="primary"
          onClick={() => notify(`${action}: listo para diligenciar`)}
        >
          + {action}
        </button>
      </div>
      <article className="panel table-panel">
        <div className="filters">
          <div className="table-search">
            ⌕<input placeholder="Buscar..." />
          </div>
          <select>
            <option>Todos los estados</option>
          </select>
          <button>Filtrar</button>
        </div>
        <table>
          <thead>
            <tr>
              {[
                "Referencia",
                "Nombre / proveedor",
                "Fecha o saldo",
                "Actividad",
                "Estado / total",
              ].map((x) => (
                <th key={x}>{x}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j}>
                    {j === 4 ? <span className="status ok">{c}</span> : c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </>
  );
}
function ReportsLegacy() {
  return (
    <>
      <div className="page-intro">
        <div>
          <h2>Reportes y analítica</h2>
          <p>Información consolidada para tomar mejores decisiones.</p>
        </div>
        <select className="date-select">
          <option>1–18 agosto de 2026</option>
        </select>
      </div>
      <div className="kpi-grid">
        <KPI
          label="Ventas netas"
          value="$ 74,8 M"
          change="+8,6% vs. periodo anterior"
          tone="green"
          icon="$"
        />
        <KPI
          label="Utilidad bruta"
          value="$ 20,1 M"
          change="Margen 26,9%"
          tone="blue"
          icon="↗"
        />
        <KPI
          label="Ticket promedio"
          value="$ 31.840"
          change="2.348 transacciones"
          tone="purple"
          icon="#"
        />
        <KPI
          label="Rotación"
          value="3,4×"
          change="Inventario promedio"
          tone="orange"
          icon="↻"
        />
      </div>
      <article className="panel report-chart">
        <div className="panel-head">
          <div>
            <h3>Comportamiento de ventas</h3>
            <p>Ventas netas por día</p>
          </div>
          <div className="legend">
            <i /> Ventas
          </div>
        </div>
        <div className="line-chart">
          <div className="grid-lines">
            <span />
            <span />
            <span />
            <span />
          </div>
          <svg viewBox="0 0 900 240" preserveAspectRatio="none">
            <path
              d="M0,190 C60,160 90,175 145,140 S240,80 290,110 S380,165 430,115 S520,60 580,90 S680,150 735,95 S825,45 900,70"
              fill="none"
              stroke="#0b887e"
              strokeWidth="5"
            />
          </svg>
        </div>
      </article>
    </>
  );
}
function SettingsLegacy({ notify }: { notify: (s: string) => void }) {
  return (
    <>
      <div className="page-intro">
        <div>
          <h2>Configuración</h2>
          <p>Personalice la operación de su empresa.</p>
        </div>
      </div>
      <div className="settings-grid">
        {[
          [
            "Empresa y sedes",
            "Datos fiscales, sucursales, bodegas y terminales",
            "⌂",
          ],
          ["Usuarios y permisos", "Roles, autorizaciones y límites", "◎"],
          [
            "Facturación e impuestos",
            "Numeraciones, impuestos y proveedor electrónico",
            "#",
          ],
          [
            "Punto de venta",
            "Recibos, medios de pago, cajas y periféricos",
            "▣",
          ],
          ["Inventario", "Costeo, stock negativo, unidades y alertas", "▦"],
          ["Integraciones", "Impresoras, básculas, WhatsApp y API", "◇"],
        ].map((x) => (
          <button
            className="setting-card"
            key={x[0]}
            onClick={() => notify(`${x[0]} seleccionado`)}
          >
            <span>{x[2]}</span>
            <div>
              <b>{x[0]}</b>
              <p>{x[1]}</p>
            </div>
            <i>›</i>
          </button>
        ))}
      </div>
    </>
  );
}
function SaaS() {
  return <PlatformOwner />;
}
function KPI({
  label,
  value,
  change,
  tone,
  icon,
}: {
  label: string;
  value: string;
  change: string;
  tone: string;
  icon: string;
}) {
  return (
    <article className="kpi">
      <div className={`kpi-icon ${tone}`}>{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small className={tone}>{change}</small>
      </div>
    </article>
  );
}
function Alert({
  tone,
  icon,
  title,
  text,
}: {
  tone: string;
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="alert-row">
      <div className={`alert-icon ${tone}`}>{icon}</div>
      <div>
        <b>{title}</b>
        <small>{text}</small>
      </div>
      <span>›</span>
    </div>
  );
}
function ClientsLegacy({ notify }: { notify: (s: string) => void }) {
  type C = {
    id: string;
    documentType: string;
    documentNumber: string;
    name: string;
    phone: string | null;
    email: string | null;
    creditLimit: number;
    creditDays: number;
    balance: number;
    overdue: number;
    active: number;
  };
  const [items, setItems] = useState<C[]>([]),
    [q, setQ] = useState(""),
    [modal, setModal] = useState<"new" | "payment" | null>(null),
    [selected, setSelected] = useState<C | null>(null),
    [form, setForm] = useState({
      documentType: "CC",
      documentNumber: "",
      name: "",
      phone: "",
      email: "",
      creditLimit: "0",
      creditDays: "30",
    }),
    [payment, setPayment] = useState({ amount: "", method: "cash" });
  const load = async () => {
    await fetch("/api/bootstrap");
    const r = await fetch(`/api/customers?q=${encodeURIComponent(q)}`),
      d = await readJson<any>(r);
    setItems(d.customers || []);
  };
  useEffect(() => {
    load();
  }, [q]);
  const save = async () => {
    const payload = {
        ...form,
        creditLimit: Number(form.creditLimit),
        creditDays: Number(form.creditDays),
      },
      r = await offlinePost("/api/customers", payload),
      d = await readJson<any>(r);
    if (!r.ok) return notify(d.error);
    setModal(null);
    notify(
      d.queued
        ? "Cliente guardado para sincronizar"
        : "Cliente creado correctamente",
    );
    if (!d.queued) load();
  };
  const pay = async () => {
    if (!selected) return;
    const r = await offlinePatch("/api/customers", {
        id: selected.id,
        amount: Number(payment.amount),
        method: payment.method,
      }),
      d = await readJson<any>(r);
    if (!r.ok) return notify(d.error);
    setModal(null);
    notify(
      d.queued
        ? "Abono guardado para sincronizar"
        : `Abono aplicado. Saldo restante ${money(d.payment.remaining)}`,
    );
    if (!d.queued) load();
  };
  const total = items.reduce((s, x) => s + Number(x.balance), 0),
    overdue = items.reduce((s, x) => s + Number(x.overdue), 0);
  return (
    <>
      <div className="page-intro">
        <div>
          <h2>Clientes y cartera</h2>
          <p>Crédito, abonos y estados de cuenta persistentes.</p>
        </div>
        <button className="primary" onClick={() => setModal("new")}>
          + Nuevo cliente
        </button>
      </div>
      <div className="summary-strip">
        <KPI
          label="Clientes activos"
          value={String(items.filter((x) => x.active).length)}
          change="Con información actualizada"
          tone="blue"
          icon="◎"
        />
        <KPI
          label="Cartera total"
          value={money(total)}
          change="Saldo por cobrar"
          tone="purple"
          icon="$"
        />
        <KPI
          label="Cartera vencida"
          value={money(overdue)}
          change="Requiere seguimiento"
          tone="orange"
          icon="!"
        />
        <KPI
          label="Cupo disponible"
          value={money(
            items.reduce(
              (s, x) => s + Math.max(0, x.creditLimit - x.balance),
              0,
            ),
          )}
          change="Entre clientes activos"
          tone="green"
          icon="↗"
        />
      </div>
      <article className="panel table-panel">
        <div className="filters">
          <div className="table-search">
            ⌕
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar cliente o documento..."
            />
          </div>
          <span className="db-badge">● Cartera actualizada</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Documento</th>
              <th>Contacto</th>
              <th>Cupo</th>
              <th>Saldo</th>
              <th>Vencido</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {items.length ? (
              items.map((c) => (
                <tr key={c.id}>
                  <td>
                    <b>{c.name}</b>
                  </td>
                  <td>
                    {c.documentType} {c.documentNumber}
                  </td>
                  <td>
                    {c.phone || "—"}
                    <small className="cell-sub">
                      {c.email || "Sin correo"}
                    </small>
                  </td>
                  <td>{money(c.creditLimit)}</td>
                  <td>
                    <b>{money(c.balance)}</b>
                  </td>
                  <td className={c.overdue > 0 ? "debt" : ""}>
                    {money(c.overdue)}
                  </td>
                  <td>
                    <span
                      className={c.overdue > 0 ? "status low" : "status ok"}
                    >
                      {c.overdue > 0 ? "Vencido" : "Al día"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="table-action"
                      disabled={c.balance <= 0}
                      onClick={() => {
                        setSelected(c);
                        setPayment({
                          amount: String(c.balance),
                          method: "cash",
                        });
                        setModal("payment");
                      }}
                    >
                      Abonar
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8}>
                  Aún no hay clientes registrados. Cree el primero para
                  comenzar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </article>
      {modal && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <section className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3>{modal === "new" ? "Nuevo cliente" : "Registrar abono"}</h3>
                <p>
                  {modal === "new"
                    ? "Datos comerciales y condiciones de crédito"
                    : selected?.name}
                </p>
              </div>
              <button onClick={() => setModal(null)}>×</button>
            </div>
            {modal === "new" ? (
              <div className="form-grid">
                <label>
                  Tipo de documento
                  <select
                    value={form.documentType}
                    onChange={(e) =>
                      setForm({ ...form, documentType: e.target.value })
                    }
                  >
                    <option>CC</option>
                    <option>NIT</option>
                    <option>CE</option>
                    <option>Pasaporte</option>
                  </select>
                </label>
                <label>
                  Número de documento
                  <input
                    value={form.documentNumber}
                    onChange={(e) =>
                      setForm({ ...form, documentNumber: e.target.value })
                    }
                  />
                </label>
                <label>
                  Nombre o razón social
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>
                <label>
                  Teléfono
                  <input
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                  />
                </label>
                <label>
                  Correo
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                  />
                </label>
                <label>
                  Cupo de crédito
                  <input
                    type="number"
                    value={form.creditLimit}
                    onChange={(e) =>
                      setForm({ ...form, creditLimit: e.target.value })
                    }
                  />
                </label>
                <label>
                  Plazo en días
                  <input
                    type="number"
                    value={form.creditDays}
                    onChange={(e) =>
                      setForm({ ...form, creditDays: e.target.value })
                    }
                  />
                </label>
              </div>
            ) : (
              <div className="payment-body">
                <div className="receipt-total">
                  <span>Saldo pendiente</span>
                  <b>{money(selected?.balance || 0)}</b>
                </div>
                <label>
                  Valor del abono
                  <input
                    autoFocus
                    type="number"
                    max={selected?.balance}
                    value={payment.amount}
                    onChange={(e) =>
                      setPayment({ ...payment, amount: e.target.value })
                    }
                  />
                </label>
                <label>
                  Medio de pago
                  <select
                    value={payment.method}
                    onChange={(e) =>
                      setPayment({ ...payment, method: e.target.value })
                    }
                  >
                    <option value="cash">Efectivo</option>
                    <option value="transfer">Transferencia</option>
                    <option value="card">Tarjeta</option>
                  </select>
                </label>
              </div>
            )}
            <div className="modal-actions">
              <button className="secondary" onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button
                className="primary"
                onClick={modal === "new" ? save : pay}
              >
                {modal === "new" ? "Guardar cliente" : "Aplicar abono"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
function PurchasesLegacy({ notify }: { notify: (s: string) => void }) {
  type S = {
    id: string;
    name: string;
    documentNumber: string;
    balance: number;
    paymentDays: number;
  };
  type O = {
    id: string;
    number: string;
    supplierName: string;
    supplierId: string;
    status: string;
    total: number;
    balance: number;
    createdAt: string;
  };
  type P = { id: string; name: string; cost: number; stock: number };
  const [suppliers, setSuppliers] = useState<S[]>([]),
    [orders, setOrders] = useState<O[]>([]),
    [productsList, setProductsList] = useState<P[]>([]),
    [modal, setModal] = useState<
      "supplier" | "order" | "receive" | "pay" | null
    >(null),
    [selected, setSelected] = useState<O | null>(null),
    [supplier, setSupplier] = useState({
      documentNumber: "",
      name: "",
      contactName: "",
      phone: "",
      email: "",
      paymentDays: "30",
    }),
    [order, setOrder] = useState({
      supplierId: "",
      productId: "",
      quantity: "1",
      unitCost: "",
      notes: "",
    }),
    [pay, setPay] = useState({ amount: "", method: "transfer" });
  const load = async () => {
    await fetch("/api/bootstrap");
    const [s, o, p] = await Promise.all([
        fetch("/api/suppliers"),
        fetch("/api/purchases"),
        fetch("/api/products"),
      ]),
      sd = await readJson<any>(s),
      od = await readJson<any>(o),
      pd = await readJson<any>(p);
    setSuppliers(sd.suppliers || []);
    setOrders(od.orders || []);
    setProductsList(pd.products || []);
  };
  useEffect(() => {
    load();
  }, []);
  const saveSupplier = async () => {
    const r = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...supplier,
          paymentDays: Number(supplier.paymentDays),
        }),
      }),
      d = await readJson<any>(r);
    if (!r.ok) return notify(d.error);
    setModal(null);
    notify("Proveedor guardado");
    load();
  };
  const saveOrder = async () => {
    const r = await fetch("/api/purchases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          supplierId: order.supplierId,
          notes: order.notes,
          lines: [
            {
              productId: order.productId,
              quantity: Number(order.quantity),
              unitCost: Number(order.unitCost),
            },
          ],
        }),
      }),
      d = await readJson<any>(r);
    if (!r.ok) return notify(d.error);
    setModal(null);
    notify(`Orden ${d.order.number} creada`);
    load();
  };
  const action = async (kind: "receive" | "pay") => {
    if (!selected) return;
    const r = await fetch("/api/purchases", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: kind,
          orderId: selected.id,
          amount: Number(pay.amount),
          method: pay.method,
        }),
      }),
      d = await readJson<any>(r);
    if (!r.ok) return notify(d.error);
    setModal(null);
    notify(
      kind === "receive"
        ? `Recepción ${d.reference} aplicada al inventario`
        : `Pago aplicado. Saldo ${money(d.remaining)}`,
    );
    load();
  };
  const payable = orders.reduce((s, x) => s + Number(x.balance), 0);
  return (
    <>
      <div className="page-intro">
        <div>
          <h2>Compras y abastecimiento</h2>
          <p>Proveedores, recepciones e inventario conectados.</p>
        </div>
        <div>
          <button className="secondary" onClick={() => setModal("supplier")}>
            + Proveedor
          </button>
          <button className="primary" onClick={() => setModal("order")}>
            + Orden de compra
          </button>
        </div>
      </div>
      <div className="summary-strip">
        <KPI
          label="Proveedores"
          value={String(suppliers.length)}
          change="Activos registrados"
          tone="blue"
          icon="◎"
        />
        <KPI
          label="Órdenes abiertas"
          value={String(orders.filter((x) => x.status !== "received").length)}
          change="Pendientes de recepción"
          tone="orange"
          icon="↓"
        />
        <KPI
          label="Cuentas por pagar"
          value={money(payable)}
          change="Saldo vigente"
          tone="purple"
          icon="$"
        />
        <KPI
          label="Compras recibidas"
          value={money(
            orders
              .filter((x) => x.status === "received")
              .reduce((s, x) => s + x.total, 0),
          )}
          change="Acumulado registrado"
          tone="green"
          icon="✓"
        />
      </div>
      <article className="panel table-panel">
        <div className="filters">
          <b>Órdenes de compra</b>
          <span className="db-badge">● Inventario conectado</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Orden</th>
              <th>Proveedor</th>
              <th>Fecha</th>
              <th>Total</th>
              <th>Saldo</th>
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
                  </td>
                  <td>{o.supplierName}</td>
                  <td>{new Date(o.createdAt).toLocaleDateString("es-CO")}</td>
                  <td>{money(o.total)}</td>
                  <td>{money(o.balance)}</td>
                  <td>
                    <span
                      className={
                        o.status === "received" ? "status ok" : "status low"
                      }
                    >
                      {o.status === "received" ? "Recibida" : "Ordenada"}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      {o.status !== "received" && (
                        <button
                          className="table-action"
                          onClick={() => {
                            setSelected(o);
                            setModal("receive");
                          }}
                        >
                          Recibir
                        </button>
                      )}
                      {o.balance > 0 && (
                        <button
                          className="table-action"
                          onClick={() => {
                            setSelected(o);
                            setPay({
                              amount: String(o.balance),
                              method: "transfer",
                            });
                            setModal("pay");
                          }}
                        >
                          Pagar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7}>
                  Cree un proveedor y su primera orden de compra.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </article>
      {modal && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <section className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3>
                  {modal === "supplier"
                    ? "Nuevo proveedor"
                    : modal === "order"
                      ? "Nueva orden de compra"
                      : modal === "receive"
                        ? "Recibir mercancía"
                        : "Pagar al proveedor"}
                </h3>
                <p>{selected?.number || "Sede Centro"}</p>
              </div>
              <button onClick={() => setModal(null)}>×</button>
            </div>
            {modal === "supplier" ? (
              <div className="form-grid">
                <label>
                  NIT o documento
                  <input
                    value={supplier.documentNumber}
                    onChange={(e) =>
                      setSupplier({
                        ...supplier,
                        documentNumber: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Nombre o razón social
                  <input
                    value={supplier.name}
                    onChange={(e) =>
                      setSupplier({ ...supplier, name: e.target.value })
                    }
                  />
                </label>
                <label>
                  Persona de contacto
                  <input
                    value={supplier.contactName}
                    onChange={(e) =>
                      setSupplier({ ...supplier, contactName: e.target.value })
                    }
                  />
                </label>
                <label>
                  Teléfono
                  <input
                    value={supplier.phone}
                    onChange={(e) =>
                      setSupplier({ ...supplier, phone: e.target.value })
                    }
                  />
                </label>
                <label>
                  Correo
                  <input
                    value={supplier.email}
                    onChange={(e) =>
                      setSupplier({ ...supplier, email: e.target.value })
                    }
                  />
                </label>
                <label>
                  Plazo de pago
                  <input
                    type="number"
                    value={supplier.paymentDays}
                    onChange={(e) =>
                      setSupplier({ ...supplier, paymentDays: e.target.value })
                    }
                  />
                </label>
              </div>
            ) : modal === "order" ? (
              <div className="form-grid">
                <label>
                  Proveedor
                  <select
                    value={order.supplierId}
                    onChange={(e) =>
                      setOrder({ ...order, supplierId: e.target.value })
                    }
                  >
                    <option value="">Seleccione</option>
                    {suppliers.map((s) => (
                      <option value={s.id} key={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Producto
                  <select
                    value={order.productId}
                    onChange={(e) => {
                      const p = productsList.find(
                        (x) => x.id === e.target.value,
                      );
                      setOrder({
                        ...order,
                        productId: e.target.value,
                        unitCost: String(p?.cost || 0),
                      });
                    }}
                  >
                    <option value="">Seleccione</option>
                    {productsList.map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Cantidad
                  <input
                    type="number"
                    value={order.quantity}
                    onChange={(e) =>
                      setOrder({ ...order, quantity: e.target.value })
                    }
                  />
                </label>
                <label>
                  Costo unitario
                  <input
                    type="number"
                    value={order.unitCost}
                    onChange={(e) =>
                      setOrder({ ...order, unitCost: e.target.value })
                    }
                  />
                </label>
                <label>
                  Observaciones
                  <textarea
                    value={order.notes}
                    onChange={(e) =>
                      setOrder({ ...order, notes: e.target.value })
                    }
                  />
                </label>
              </div>
            ) : modal === "receive" ? (
              <div className="payment-body">
                <div className="receipt-total">
                  <span>Proveedor</span>
                  <b>{selected?.supplierName}</b>
                </div>
                <div className="receipt-total">
                  <span>Total a recibir</span>
                  <b>{money(selected?.total || 0)}</b>
                </div>
                <div className="success-box">
                  La recepción aumentará existencias, actualizará costos y
                  creará la cuenta por pagar.
                </div>
              </div>
            ) : (
              <div className="payment-body">
                <div className="receipt-total">
                  <span>Saldo pendiente</span>
                  <b>{money(selected?.balance || 0)}</b>
                </div>
                <label>
                  Valor del pago
                  <input
                    type="number"
                    value={pay.amount}
                    onChange={(e) => setPay({ ...pay, amount: e.target.value })}
                  />
                </label>
                <label>
                  Medio
                  <select
                    value={pay.method}
                    onChange={(e) => setPay({ ...pay, method: e.target.value })}
                  >
                    <option value="transfer">Transferencia</option>
                    <option value="cash">Efectivo</option>
                    <option value="card">Tarjeta</option>
                  </select>
                </label>
              </div>
            )}
            <div className="modal-actions">
              <button className="secondary" onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button
                className="primary"
                onClick={
                  modal === "supplier"
                    ? saveSupplier
                    : modal === "order"
                      ? saveOrder
                      : () => action(modal === "receive" ? "receive" : "pay")
                }
              >
                {modal === "supplier"
                  ? "Guardar proveedor"
                  : modal === "order"
                    ? "Crear orden"
                    : modal === "receive"
                      ? "Confirmar recepción"
                      : "Aplicar pago"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
