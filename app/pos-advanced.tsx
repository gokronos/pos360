"use client";
import { useEffect, useMemo, useState } from "react";
import { offlinePost } from "./offline-sync";
import { apiJson, readJson } from "./api-client";
const money = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n || 0);
type P = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  category: string;
  price: number;
  stock: number;
};
type Cart = { id: string; qty: number };
type Draft = {
  id: string;
  number: string;
  documentType: string;
  total: number;
  customerName: string;
  payload: string;
  createdAt: string;
};
type Sale = {
  id: string;
  localId: string;
  total: number;
  status: string;
  customerName: string;
  createdAt: string;
};
export default function POS({
  notify,
}: {
  notify: (s: string) => void;
  [key: string]: unknown;
}) {
  const [products, setProducts] = useState<P[]>([]),
    [cart, setCart] = useState<Cart[]>([]),
    [query, setQuery] = useState(""),
    [cash, setCash] = useState<{
      id: string;
      openingAmount: number;
      registerName: string;
    } | null>(null),
    [customers, setCustomers] = useState<
      { id: string; name: string; creditLimit: number; balance: number }[]
    >([]),
    [customerId, setCustomerId] = useState(""),
    [discount, setDiscount] = useState("0"),
    [discountReason, setDiscountReason] = useState("Promoción comercial"),
    [payments, setPayments] = useState<{ method: string; amount: string }[]>([
      { method: "cash", amount: "" },
    ]),
    [drafts, setDrafts] = useState<Draft[]>([]),
    [sales, setSales] = useState<Sale[]>([]),
    [modal, setModal] = useState<
      | "cash"
      | "pay"
      | "drafts"
      | "document"
      | "returns"
      | "receipt"
      | "close"
      | null
    >(null),
    [base, setBase] = useState("100000"),
    [declared, setDeclared] = useState(""),
    [docType, setDocType] = useState("suspended"),
    [notes, setNotes] = useState(""),
    [selectedSale, setSelectedSale] = useState<Sale | null>(null),
    [returnReason, setReturnReason] = useState(
      "Devolución solicitada por el cliente",
    ),
    [receipt, setReceipt] = useState<any>(null),
    [busy, setBusy] = useState(false);
  const load = async () => {
    await apiJson("/api/bootstrap");
    const [pd, cd, cud, ad] = await Promise.all([
      apiJson<{ products: (P & { active?: number })[] }>("/api/products"),
      apiJson<{ session: typeof cash }>("/api/cash"),
      apiJson<{ customers: typeof customers }>("/api/customers"),
      apiJson<{ drafts: Draft[]; sales: Sale[] }>("/api/pos-advanced"),
    ]);
    setProducts((pd.products || []).filter((x) => x.active));
    setCash(cd.session || null);
    setCustomers(cud.customers || []);
    setDrafts(ad.drafts || []);
    setSales(ad.sales || []);
  };
  useEffect(() => {
    void load().catch((error) => notify(error instanceof Error ? error.message : "No fue posible cargar el POS"));
  }, []);
  const filtered = products.filter((p) =>
      `${p.name} ${p.sku} ${p.barcode || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    ),
    subtotal = useMemo(
      () =>
        cart.reduce(
          (s, x) =>
            s + (products.find((p) => p.id === x.id)?.price || 0) * x.qty,
          0,
        ),
      [cart, products],
    ),
    discountAmount = Math.round(
      (subtotal * Math.min(100, Number(discount || 0))) / 100,
    ),
    total = subtotal - discountAmount,
    paymentTotal = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const add = (id: string) =>
      setCart((c) =>
        c.some((x) => x.id === id)
          ? c.map((x) => (x.id === id ? { ...x, qty: x.qty + 1 } : x))
          : [...c, { id, qty: 1 }],
      ),
    change = (id: string, n: number) =>
      setCart((c) =>
        c.map((x) => (x.id === id ? { ...x, qty: Math.max(1, x.qty + n) } : x)),
      );
  const open = async () => {
    const r = await fetch("/api/cash", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "open", amount: Number(base) }),
      }),
      d = await readJson<any>(r);
    if (!r.ok) return notify(d.error);
    setCash(d.session);
    setModal(null);
    notify("Caja abierta");
  };
  const close = async () => {
    const r = await fetch("/api/cash", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "close", amount: Number(declared) }),
      }),
      d = await readJson<any>(r);
    if (!r.ok) return notify(d.error);
    setCash(null);
    setModal(null);
    notify(`Caja cerrada. Diferencia ${money(d.difference)}`);
  };
  const sell = async () => {
    setBusy(true);
    const normalized = payments.map((p) => ({
        ...p,
        amount: Number(p.amount),
      })),
      payload = {
        localId: `pos-${crypto.randomUUID()}`,
        customerId: customerId || undefined,
        items: cart.map((x) => ({ productId: x.id, quantity: x.qty })),
        payments: normalized,
        discountPercent: Number(discount),
        discountReason,
        total,
      },
      r = await offlinePost("/api/sales", payload),
      d = await readJson<any>(r);
    setBusy(false);
    if (!r.ok) return notify(d.error);
    setReceipt({
      ...d.sale,
      items: cart.map((x) => ({
        name: products.find((p) => p.id === x.id)?.name,
        qty: x.qty,
        price: products.find((p) => p.id === x.id)?.price,
      })),
    });
    setCart([]);
    setDiscount("0");
    setPayments([{ method: "cash", amount: "" }]);
    setModal("receipt");
    if (!d.queued) load();
  };
  const saveDraft = async () => {
    const items = cart.map((x) => ({
        productId: x.id,
        quantity: x.qty,
        name: products.find((p) => p.id === x.id)?.name,
        price: products.find((p) => p.id === x.id)?.price,
      })),
      r = await fetch("/api/pos-advanced", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "draft",
          documentType: docType,
          customerId: customerId || undefined,
          items,
          discount: discountAmount,
          notes,
        }),
      }),
      d = await readJson<any>(r);
    if (!r.ok) return notify(d.error);
    setCart([]);
    setModal(null);
    notify(`${d.draft.number} guardado`);
    load();
  };
  const recover = async (id: string) => {
    const r = await fetch("/api/pos-advanced", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      }),
      d = await readJson<any>(r);
    if (!r.ok) return notify(d.error);
    setCart(d.items.map((x: any) => ({ id: x.productId, qty: x.quantity })));
    setCustomerId(d.customerId || "");
    setModal(null);
    notify("Documento recuperado");
  };
  const reverse = async (action: "return" | "void") => {
    if (!selectedSale) return;
    const r = await fetch("/api/pos-advanced", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          saleId: selectedSale.id,
          reason: returnReason,
        }),
      }),
      d = await readJson<any>(r);
    if (!r.ok) return notify(d.error);
    setModal(null);
    notify(`${d.number} procesada e inventario restaurado`);
    load();
  };
  const preparePay = () => {
    setPayments([{ method: "cash", amount: String(total) }]);
    setModal("pay");
  };
  const addPayment = () =>
    setPayments((p) => [...p, { method: "card", amount: "0" }]);
  return (
    <>
      <div className="cash-bar advanced">
        <div>
          <span className={cash ? "online-dot" : "cash-dot"} />
          <b>{cash ? `${cash.registerName} abierta` : "Caja cerrada"}</b>
          <small>
            {cash
              ? `Base ${money(cash.openingAmount)}`
              : "Debe abrir caja para vender"}
          </small>
        </div>
        <div className="pos-toolbar">
          <button onClick={() => setModal("drafts")}>
            Pendientes <b>{drafts.length}</b>
          </button>
          <button onClick={() => setModal("returns")}>Devoluciones</button>
          <button onClick={() => (cash ? setModal("close") : setModal("cash"))}>
            {cash ? "Cerrar caja" : "Abrir caja"}
          </button>
        </div>
      </div>
      <div className="pos-layout">
        <section className="catalog">
          <div className="pos-search">
            ⌕
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Escanee código o busque producto..."
            />
            <kbd>F2</kbd>
          </div>
          <div className="chips">
            <button className="selected">Todos</button>
            <button
              onClick={() => {
                setDocType("quote");
                setModal("document");
              }}
            >
              + Cotización
            </button>
            <button
              onClick={() => {
                setDocType("layaway");
                setModal("document");
              }}
            >
              + Apartado
            </button>
          </div>
          <div className="product-grid">
            {filtered.map((p) => (
              <button
                className="product-card"
                disabled={p.stock <= 0}
                key={p.id}
                onClick={() => add(p.id)}
              >
                <div className="product-art">
                  {p.name[0]}
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
              <small>{cart.length} referencias</small>
            </div>
            <button onClick={() => setCart([])}>Limpiar</button>
          </div>
          <label className="pos-customer">
            Cliente
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">Consumidor final</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="cart-lines">
            {cart.length ? (
              cart.map((x) => {
                const p = products.find((y) => y.id === x.id)!;
                return (
                  <div className="cart-line" key={x.id}>
                    <div className="product-badge">{p.name[0]}</div>
                    <div className="line-info">
                      <b>{p.name}</b>
                      <small>{money(p.price)} c/u</small>
                      <div className="qty">
                        <button onClick={() => change(x.id, -1)}>−</button>
                        <span>{x.qty}</span>
                        <button onClick={() => change(x.id, 1)}>+</button>
                      </div>
                    </div>
                    <strong>{money(p.price * x.qty)}</strong>
                  </div>
                );
              })
            ) : (
              <div className="empty">
                <span>▣</span>
                <b>Venta vacía</b>
                <small>Agregue productos</small>
              </div>
            )}
          </div>
          <div className="cart-summary">
            <div>
              <span>Subtotal</span>
              <b>{money(subtotal)}</b>
            </div>
            <div className="discount-line">
              <span>Descuento</span>
              <label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
                %
              </label>
              <b>-{money(discountAmount)}</b>
            </div>
            <div className="total">
              <span>Total</span>
              <b>{money(total)}</b>
            </div>
            <div className="cart-actions">
              <button
                className="secondary"
                disabled={!cart.length}
                onClick={() => {
                  setDocType("suspended");
                  setModal("document");
                }}
              >
                Suspender
              </button>
              <button
                className="pay"
                disabled={!cart.length || !cash}
                onClick={preparePay}
              >
                <span>Cobrar</span>
                <b>{money(total)}</b>
              </button>
            </div>
          </div>
        </aside>
      </div>
      {modal && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <section
            className={`modal ${modal === "receipt" ? "thermal-modal" : ""}`}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <h3>
                  {modal === "cash"
                    ? "Abrir caja"
                    : modal === "close"
                      ? "Arqueo y cierre"
                      : modal === "pay"
                        ? "Pago combinado"
                        : modal === "drafts"
                          ? "Ventas y documentos pendientes"
                          : modal === "returns"
                            ? "Devoluciones y anulaciones"
                            : modal === "document"
                              ? docType === "quote"
                                ? "Crear cotización"
                                : docType === "layaway"
                                  ? "Crear apartado"
                                  : "Suspender venta"
                              : "Comprobante de venta"}
                </h3>
                <p>POS360 · Sede Centro</p>
              </div>
              <button onClick={() => setModal(null)}>×</button>
            </div>
            {modal === "cash" ? (
              <div className="payment-body">
                <label>
                  Base inicial
                  <input
                    type="number"
                    value={base}
                    onChange={(e) => setBase(e.target.value)}
                  />
                </label>
              </div>
            ) : modal === "close" ? (
              <div className="payment-body">
                <label>
                  Efectivo contado
                  <input
                    type="number"
                    value={declared}
                    onChange={(e) => setDeclared(e.target.value)}
                  />
                </label>
                <div className="success-box">
                  El cierre calculará automáticamente el valor esperado y la
                  diferencia.
                </div>
              </div>
            ) : modal === "pay" ? (
              <div className="payment-body">
                <div className="receipt-total">
                  <span>Total</span>
                  <b>{money(total)}</b>
                </div>
                {payments.map((p, i) => (
                  <div className="split-payment" key={i}>
                    <select
                      value={p.method}
                      onChange={(e) =>
                        setPayments((x) =>
                          x.map((v, j) =>
                            j === i ? { ...v, method: e.target.value } : v,
                          ),
                        )
                      }
                    >
                      <option value="cash">Efectivo</option>
                      <option value="card">Tarjeta</option>
                      <option value="transfer">Transferencia</option>
                      <option value="credit">Crédito</option>
                    </select>
                    <input
                      type="number"
                      value={p.amount}
                      onChange={(e) =>
                        setPayments((x) =>
                          x.map((v, j) =>
                            j === i ? { ...v, amount: e.target.value } : v,
                          ),
                        )
                      }
                    />
                  </div>
                ))}
                <button className="secondary" onClick={addPayment}>
                  + Agregar medio de pago
                </button>
                <div
                  className={
                    Math.abs(paymentTotal - total) <= 1
                      ? "success-box"
                      : "warning-box"
                  }
                >
                  Pagado {money(paymentTotal)} · Falta{" "}
                  {money(Math.max(0, total - paymentTotal))}
                </div>
                {Number(discount) > 0 && (
                  <label>
                    Motivo del descuento
                    <input
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                    />
                  </label>
                )}
              </div>
            ) : modal === "drafts" ? (
              <div className="modal-list">
                {drafts.length ? (
                  drafts.map((d) => (
                    <div className="draft-row" key={d.id}>
                      <div>
                        <b>{d.number}</b>
                        <small>
                          {d.customerName} · {d.documentType}
                        </small>
                      </div>
                      <strong>{money(d.total)}</strong>
                      <button
                        className="table-action"
                        onClick={() => recover(d.id)}
                      >
                        Recuperar
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="success-box">
                    No hay documentos pendientes.
                  </div>
                )}
              </div>
            ) : modal === "returns" ? (
              <div className="modal-list">
                {sales.map((s) => (
                  <div className="draft-row" key={s.id}>
                    <div>
                      <b>{s.localId}</b>
                      <small>
                        {s.customerName} ·{" "}
                        {new Date(s.createdAt).toLocaleString("es-CO")}
                      </small>
                    </div>
                    <strong>{money(s.total)}</strong>
                    {s.status === "completed" && (
                      <button
                        className="table-action"
                        onClick={() => setSelectedSale(s)}
                      >
                        Seleccionar
                      </button>
                    )}
                  </div>
                ))}
                {selectedSale && (
                  <>
                    <label className="return-reason">
                      Motivo
                      <input
                        value={returnReason}
                        onChange={(e) => setReturnReason(e.target.value)}
                      />
                    </label>
                    <div className="return-actions">
                      <button
                        className="secondary"
                        onClick={() => reverse("return")}
                      >
                        Devolver
                      </button>
                      <button
                        className="secondary danger"
                        onClick={() => reverse("void")}
                      >
                        Anular venta
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : modal === "document" ? (
              <div className="payment-body">
                <div className="receipt-total">
                  <span>Total del documento</span>
                  <b>{money(total)}</b>
                </div>
                <label>
                  Observaciones
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
              </div>
            ) : (
              <div className="thermal-receipt">
                <h3>POS360</h3>
                <p>Minimercado La Esquina</p>
                <hr />
                <b>{receipt?.number}</b>
                {receipt?.items?.map((x: any, i: number) => (
                  <div key={i}>
                    <span>
                      {x.qty} × {x.name}
                    </span>
                    <b>{money(x.qty * x.price)}</b>
                  </div>
                ))}
                <hr />
                <div>
                  <span>Subtotal</span>
                  <b>{money(receipt?.subtotal)}</b>
                </div>
                <div>
                  <span>Descuento</span>
                  <b>-{money(receipt?.discount)}</b>
                </div>
                <div className="thermal-total">
                  <span>TOTAL</span>
                  <b>{money(receipt?.total)}</b>
                </div>
                <p>Gracias por su compra</p>
              </div>
            )}
            <div className="modal-actions">
              {modal === "cash" && (
                <button className="primary" onClick={open}>
                  Abrir caja
                </button>
              )}
              {modal === "close" && (
                <button className="primary" onClick={close}>
                  Cerrar y generar arqueo
                </button>
              )}
              {modal === "pay" && (
                <button
                  className="primary"
                  disabled={busy || Math.abs(paymentTotal - total) > 1}
                  onClick={sell}
                >
                  {busy ? "Procesando..." : "Confirmar pago"}
                </button>
              )}
              {modal === "document" && (
                <button className="primary" onClick={saveDraft}>
                  Guardar documento
                </button>
              )}
              {modal === "receipt" && (
                <>
                  <button className="secondary" onClick={() => window.print()}>
                    Imprimir 80 mm
                  </button>
                  <button className="primary" onClick={() => setModal(null)}>
                    Nueva venta
                  </button>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
