"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { offlinePost } from "./offline-sync";
import { apiJson, readJson } from "./api-client";
const formatCurrency = (n: number, currency: string) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n || 0);
type P = {
  id: string;
  sku: string;
  barcode: string | null;
  barcodes?:string[];
  name: string;
  category: string;
  price: number;
  stock: number;
  productType?: string;
  trackInventory?: number;
  priceTiers?: { priceMinor: number; minQuantity: number }[];
  productId?: string;
  variantId?: string;
  variants?: {
    id: string;
    name: string;
    sku: string;
    price: number;
    stock: number;
    barcodes: string[];
    priceTiers: { priceMinor: number; minQuantity: number }[];
  }[];
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
    [favorites,setFavorites]=useState<string[]>([]),
    [favoritesOnly,setFavoritesOnly]=useState(false),
    [priceLists, setPriceLists] = useState<
      { id: string; name: string; currency: string; isDefault: number }[]
    >([]),
    [priceListId, setPriceListId] = useState(""),
    [cash, setCash] = useState<{
      id: string;
      openingAmount: number;
      registerName: string;
      terminalName?: string;
      status?: string;
      currentExpected?: number;
      difference?: number;
    } | null>(null),
    [cashMeta,setCashMeta]=useState<any>({terminals:[],movements:[],allowedMovements:[],pendingApprovals:[]}),
    [terminalId,setTerminalId]=useState(""),
    [cashMovement,setCashMovement]=useState({movementType:"income",amount:"",reason:"",reference:""}),
    [countResult,setCountResult]=useState<any>(null),
    [approvalReason,setApprovalReason]=useState("Diferencia verificada y aprobada"),
    [customers, setCustomers] = useState<
      { id: string; name: string; creditLimit: number; balance: number; priceListId?: string; blocked?: number; overdue?: number }[]
    >([]),
    [customerId, setCustomerId] = useState(""),
    [discount, setDiscount] = useState("0"),
    [discountReason, setDiscountReason] = useState("Promoción comercial"),
    [discountAuthorizationCode,setDiscountAuthorizationCode]=useState(""),
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
      | "movement"
      | "cash-history"
      | "approvals"
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
    [busy, setBusy] = useState(false),
    [business, setBusiness] = useState({
      name: "POS360",
      nit: "",
      currency: "COP",
      receiptFormat: "thermal_80",
    });
  const searchRef=useRef<HTMLInputElement>(null),busyRef=useRef(false),operationIdRef=useRef<string|null>(null);
  const money = (value: number) => formatCurrency(value, business.currency);
  const sellableProducts = (items: (P & { active?: number })[]) =>
    items
      .filter((item) => item.active)
      .flatMap((item) => [
        item,
        ...(item.variants || []).map((variant) => ({
          ...item,
          id: `${item.id}:${variant.id}`,
          productId: item.id,
          variantId: variant.id,
          name: `${item.name} · ${variant.name}`,
          sku: variant.sku,
          barcode: variant.barcodes[0] || null,
          price: variant.price,
          stock: variant.stock,
          priceTiers: variant.priceTiers,
          variants: [],
        })),
      ]);
  const load = async () => {
    const bootstrap = await apiJson<{
      tenant: { name: string };
      configuration: {
        nit?: string;
        currency?: string;
        receiptFormat?: string;
      };
    }>("/api/bootstrap");
    setBusiness({
      name: bootstrap.tenant.name,
      nit: bootstrap.configuration.nit || "",
      currency: bootstrap.configuration.currency || "COP",
      receiptFormat: bootstrap.configuration.receiptFormat || "thermal_80",
    });
    const [initialProducts, cd, cud, ad] = await Promise.all([
      apiJson<{
        products: (P & { active?: number })[];
        priceLists: typeof priceLists;
      }>("/api/products"),
      apiJson<any>("/api/cash"),
      apiJson<{ customers: typeof customers }>("/api/customers"),
      apiJson<{ drafts: Draft[]; sales: Sale[];favorites:string[] }>("/api/pos-advanced"),
    ]);
    const defaultList = initialProducts.priceLists?.find((list) =>
      Boolean(list.isDefault),
    );
    setPriceLists(initialProducts.priceLists || []);
    setPriceListId(defaultList?.id || "");
    if (defaultList) {
      const priced = await apiJson<{
        products: (P & { active?: number })[];
      }>(`/api/products?priceListId=${defaultList.id}`);
      setProducts(sellableProducts(priced.products || []));
    } else setProducts(sellableProducts(initialProducts.products || []));
    setCash(cd.session || null);
    setCashMeta(cd);
    if(!terminalId)setTerminalId(cd.terminals?.[0]?.id||"");
    setCustomers(cud.customers || []);
    setDrafts(ad.drafts || []);
    setSales(ad.sales || []);
    setFavorites(ad.favorites||[]);
  };
  useEffect(() => {
    void load().catch((error) =>
      notify(
        error instanceof Error ? error.message : "No fue posible cargar el POS",
      ),
    );
  }, []);
  const unitPrice = (product: P, quantity: number) => {
      const tier = [...(product.priceTiers || [])]
        .filter((candidate) => candidate.minQuantity <= quantity)
        .sort((a, b) => b.minQuantity - a.minQuantity)[0];
      return tier ? tier.priceMinor / 100 : product.price;
    },
    selectPriceList = async (id: string) => {
      setPriceListId(id);
      const priced = await apiJson<{
        products: (P & { active?: number })[];
      }>(`/api/products${id ? `?priceListId=${id}` : ""}`);
      setProducts(sellableProducts(priced.products || []));
    },
    filtered = products.filter((p) => (!favoritesOnly||favorites.includes(p.productId||p.id))&&
      `${p.name} ${p.sku} ${p.barcode || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    ),
    subtotal = useMemo(
      () =>
        cart.reduce(
          (s, x) =>
            s +
            unitPrice(
              products.find((p) => p.id === x.id)!,
              x.qty,
            ) *
              x.qty,
          0,
        ),
      [cart, products],
    ),
    discountAmount =
      Math.round(subtotal * Math.min(100, Number(discount || 0))) / 100,
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
  const toggleFavorite=async(product:P)=>{const productId=product.productId||product.id,r=await fetch("/api/pos-advanced",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"favorite",productId})}),d=await readJson<any>(r);if(!r.ok)return notify(d.error);setFavorites(x=>d.favorite?[...new Set([...x,productId])]:x.filter(id=>id!==productId))};
  const open = async () => {
    const r = await fetch("/api/cash", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "open", terminalId, amount: Number(base) }),
      }),
      d = await readJson<any>(r);
    if (!r.ok) return notify(d.error);
    setCash(d.session);
    setModal(null);
    notify("Caja abierta");
  };
  const countAndClose = async () => {
    const countResponse = await fetch("/api/cash", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "count", amount: declared, notes: "Arqueo realizado por el cajero" }),
      }),
      countData = await readJson<any>(countResponse);
    if (!countResponse.ok) return notify(countData.error);
    setCountResult(countData.count);
    const closeResponse=await fetch("/api/cash",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"close"})}),closeData=await readJson<any>(closeResponse);
    if(!closeResponse.ok)return notify(closeData.error);
    setModal(null);notify(closeData.pendingApproval?`Diferencia ${money(closeData.difference)} pendiente de aprobación`:"Caja cerrada sin diferencias");await load();
  };
  const saveCashMovement=async()=>{const r=await fetch("/api/cash",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"movement",...cashMovement,amount:cashMovement.amount})}),d=await readJson<any>(r);if(!r.ok)return notify(d.error);setModal(null);notify("Movimiento de caja registrado");await load()};
  const approveDifference=async(sessionId:string)=>{const r=await fetch("/api/cash",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"approve",sessionId,reason:approvalReason})}),d=await readJson<any>(r);if(!r.ok)return notify(d.error);notify("Diferencia aprobada y caja cerrada");await load()};
  const sell = async () => {
    if(busyRef.current)return;
    busyRef.current=true;
    setBusy(true);
    const normalized = payments.map((p) => ({
        ...p,
        amount: Number(p.amount),
      })),
      payload = {
        localId: operationIdRef.current||(operationIdRef.current=`pos-${crypto.randomUUID()}`),
        customerId: customerId || undefined,
        items: cart.map((x) => {
          const product = products.find((candidate) => candidate.id === x.id)!;
          return {
            productId: product.productId || product.id,
            variantId: product.variantId,
            quantity: x.qty,
          };
        }),
        payments: normalized,
        priceListId: priceListId || undefined,
        discountPercent: Number(discount),
        discountReason,
        discountAuthorizationCode:discountAuthorizationCode||undefined,
        total,
      },
      r = await offlinePost("/api/sales", payload),
      d = await readJson<any>(r);
    setBusy(false);
    busyRef.current=false;
    if (!r.ok) return notify(d.error);
    setReceipt({
      ...d.sale,
      items: cart.map((x) => ({
        name: products.find((p) => p.id === x.id)?.name,
        qty: x.qty,
        price: unitPrice(
          products.find((p) => p.id === x.id)!,
          x.qty,
        ),
      })),
    });
    setCart([]);
    setDiscount("0");
    setPayments([{ method: "cash", amount: "" }]);
    setDiscountAuthorizationCode("");operationIdRef.current=null;
    setModal("receipt");
    if (!d.queued) load();
  };
  const saveDraft = async () => {
    const items = cart.map((x) => {
        const product = products.find((candidate) => candidate.id === x.id)!;
        return {
          productId: product.productId || product.id,
          variantId: product.variantId,
          quantity: x.qty,
          name: product.name,
          price: unitPrice(product, x.qty),
        };
      }),
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
    setCart(
      d.items.map((x: any) => ({
        id: x.variantId ? `${x.productId}:${x.variantId}` : x.productId,
        qty: x.quantity,
      })),
    );
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
  const reprint=async(saleId:string)=>{const d=await apiJson<any>(`/api/pos-advanced?saleId=${saleId}`);setReceipt(d.receipt);setModal("receipt")};
  const createDiscountCode=async()=>{const r=await fetch("/api/pos-advanced",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"authorizeDiscount",maxPercent:Number(discount),reason:discountReason})}),d=await readJson<any>(r);if(!r.ok)return notify(d.error);setDiscountAuthorizationCode(d.code);notify(`Código ${d.code} autorizado por 30 minutos`)};
  const preparePay = () => {
    setPayments([{ method: "cash", amount: String(total) }]);
    setModal("pay");
  };
  const addPayment = () =>
    setPayments((p) => [...p, { method: "card", amount: "0" }]);
  useEffect(()=>{const keyboard=(event:KeyboardEvent)=>{if(event.key==="F2"){event.preventDefault();searchRef.current?.focus()}if(event.key==="F4"&&cart.length&&cash){event.preventDefault();preparePay()}if(event.key==="F8"&&cart.length){event.preventDefault();setDocType("suspended");setModal("document")}if(event.key==="Escape")setModal(null)};window.addEventListener("keydown",keyboard);return()=>window.removeEventListener("keydown",keyboard)},[cart.length,cash,total]);
  return (
    <>
      <style>{`.product-card-wrap{position:relative;display:flex}.product-card-wrap>.product-card{width:100%}.favorite-button{position:absolute;left:8px;top:8px;z-index:2;border:1px solid #d8e0e4;border-radius:16px;background:#fff;color:#a56600;padding:5px 9px;font-weight:800;cursor:pointer}.qty input{width:72px;text-align:center;border:1px solid #dfe7ea;border-radius:6px;padding:4px}`}</style>
      <div className="cash-bar advanced">
        <div>
          <span className={cash ? "online-dot" : "cash-dot"} />
          <b>{cash ? `${cash.registerName} · ${cash.terminalName||"Terminal"}` : "Caja cerrada"}</b>
          <small>
            {cash
              ? cash.status==="pending_approval"?`Diferencia ${money(cash.difference||0)} pendiente de supervisor`:`Base ${money(cash.openingAmount)}`
              : "Seleccione terminal y abra caja para vender"}
          </small>
        </div>
        <div className="pos-toolbar">
          <select
            className="inline-select"
            value={priceListId}
            onChange={(e) =>
              void selectPriceList(e.target.value).catch((error) =>
                notify(
                  error instanceof Error
                    ? error.message
                    : "No fue posible cambiar la lista",
                ),
              )
            }
          >
            <option value="">Precio base</option>
            {priceLists.map((list) => (
              <option value={list.id} key={list.id}>
                {list.name}
              </option>
            ))}
          </select>
          <button onClick={() => setModal("drafts")}>
            Pendientes <b>{drafts.length}</b>
          </button>
          <button onClick={() => setModal("returns")}>Devoluciones</button>
          {cash?.status==="open"&&<button onClick={()=>{setCashMovement({movementType:cashMeta.allowedMovements?.[0]||"income",amount:"",reason:"",reference:""});setModal("movement")}}>Movimiento de caja</button>}
          {cash&&<button onClick={()=>setModal("cash-history")}>Movimientos</button>}
          {(cashMeta.pendingApprovals||[]).length>0&&<button onClick={()=>setModal("approvals")}>Aprobar diferencias <b>{cashMeta.pendingApprovals.length}</b></button>}
          <button
            onClick={() => {
              if (!cash) return setModal("cash");
              if (cash.status === "open") return setModal("close");
              return notify("La caja está pendiente de aprobación del supervisor");
            }}
          >
            {cash ? cash.status==="open"?"Arqueo y cierre":"Cierre pendiente" : "Abrir caja"}
          </button>
        </div>
      </div>
      <div className="pos-layout">
        <section className="catalog">
          <div className="pos-search">
            ⌕
            <input
              ref={searchRef}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e)=>{if(e.key==="Enter"){const code=query.trim().toLowerCase(),match=products.find(p=>p.barcode?.toLowerCase()===code||p.sku.toLowerCase()===code||p.barcodes?.some(b=>b.toLowerCase()===code));if(match){e.preventDefault();add(match.id);setQuery("");notify(`${match.name} agregado por código`)}}}}
              placeholder="Escanee código o busque producto..."
            />
            <kbd>F2</kbd>
          </div>
          <div className="chips">
            <button className={!favoritesOnly?"selected":""} onClick={()=>setFavoritesOnly(false)}>Todos</button>
            <button className={favoritesOnly?"selected":""} onClick={()=>setFavoritesOnly(true)}>★ Favoritos ({favorites.length})</button>
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
            <button onClick={()=>{setDocType("order");setModal("document")}}>+ Pedido</button>
          </div>
          <div className="product-grid">
            {filtered.map((p) => (
              <div className="product-card-wrap" key={p.id}><button
                className="product-card"
                disabled={p.trackInventory !== 0 && p.stock <= 0}
                onClick={() => add(p.id)}
              >
                <div className="product-art">
                  {p.name[0]}
                  <span>
                    {p.productType === "service"
                      ? "Servicio"
                      : `${p.stock} disp.`}
                  </span>
                </div>
                <div>
                  <small>{p.category}</small>
                  <b>{p.name}</b>
                  <strong>{money(unitPrice(p, 1))}</strong>
                </div>
              </button><button className="favorite-button" title="Agregar o quitar favorito" onClick={()=>void toggleFavorite(p)}>{favorites.includes(p.productId||p.id)?"★ Favorito":"☆ Favorito"}</button></div>
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
              onChange={(e) => {const id=e.target.value,c=customers.find(x=>x.id===id);setCustomerId(id);if(c?.priceListId!==undefined)void selectPriceList(c.priceListId||"").catch(error=>notify(error instanceof Error?error.message:"No fue posible aplicar la lista del cliente"));}}
            >
              <option value="">Consumidor final</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.blocked?" · BLOQUEADO":c.overdue?" · CARTERA VENCIDA":""}
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
                      <small>{money(unitPrice(p, x.qty))} c/u</small>
                      <div className="qty">
                        <button onClick={() => change(x.id, -1)}>−</button>
                        <input aria-label={`Cantidad de ${p.name}`} type="number" min="0.001" step="0.001" value={x.qty} onChange={e=>setCart(c=>c.map(v=>v.id===x.id?{...v,qty:Math.max(.001,Number(e.target.value)||.001)}:v))}/>
                        <button onClick={() => change(x.id, 1)}>+</button>
                      </div>
                    </div>
                    <strong>{money(unitPrice(p, x.qty) * x.qty)}</strong>
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
                      : modal === "movement"
                        ? "Movimiento de caja"
                        : modal === "cash-history"
                          ? "Movimientos permitidos"
                          : modal === "approvals"
                            ? "Aprobar diferencias"
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
                <label>Terminal autorizada<select value={terminalId} onChange={e=>setTerminalId(e.target.value)}><option value="">Seleccione terminal</option>{(cashMeta.terminals||[]).map((t:any)=><option key={t.id} value={t.id}>{t.name} · {t.registerName} · {t.code}</option>)}</select></label>
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
                  El arqueo calculará el esperado y la diferencia. Una diferencia requiere aprobación de otro supervisor.
                </div>
                {countResult&&<div className="receipt-total"><span>Diferencia</span><b>{money(countResult.difference)}</b></div>}
              </div>
            ) : modal === "movement" ? (<div className="payment-body"><label>Tipo<select value={cashMovement.movementType} onChange={e=>setCashMovement({...cashMovement,movementType:e.target.value})}>{(cashMeta.allowedMovements||[]).map((x:string)=><option key={x} value={x}>{x==="income"?"Ingreso":x==="expense"?"Egreso":"Retiro"}</option>)}</select></label><label>Valor<input type="number" min="0.01" step="0.01" value={cashMovement.amount} onChange={e=>setCashMovement({...cashMovement,amount:e.target.value})}/></label><label>Motivo obligatorio<input value={cashMovement.reason} onChange={e=>setCashMovement({...cashMovement,reason:e.target.value})}/></label><label>Referencia<input value={cashMovement.reference} onChange={e=>setCashMovement({...cashMovement,reference:e.target.value})}/></label></div>
            ) : modal === "cash-history" ? (<div className="modal-list">{(cashMeta.movements||[]).map((m:any)=><div className="draft-row" key={m.id}><div><b>{m.movementType} · {m.userName}</b><small>{m.reason} · {new Date(m.createdAt).toLocaleString("es-CO")}</small></div><strong>{money(m.amount)}</strong></div>)}{!(cashMeta.movements||[]).length&&<div className="success-box">No hay movimientos.</div>}</div>
            ) : modal === "approvals" ? (<div className="payment-body"><label>Justificación de aprobación<input value={approvalReason} onChange={e=>setApprovalReason(e.target.value)}/></label>{(cashMeta.pendingApprovals||[]).map((s:any)=><div className="draft-row" key={s.id}><div><b>{s.cashierName} · {s.terminalName}</b><small>Esperado {money(s.expectedAmount)} · declarado {money(s.closingAmount)}</small></div><strong className="debt">{money(s.difference)}</strong><button className="table-action" onClick={()=>approveDifference(s.id)}>Aprobar y cerrar</button></div>)}</div>
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
                {Number(discount)>10&&<label>Código de autorización administrativa<input value={discountAuthorizationCode} onChange={e=>setDiscountAuthorizationCode(e.target.value.toUpperCase())} placeholder="Código de 8 caracteres"/><button className="secondary" onClick={()=>void createDiscountCode()}>Generar código (administración)</button></label>}
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
                        <button className="table-action" onClick={()=>void reprint(s.id)}>Reimprimir</button>
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
              <div className={`thermal-receipt ${business.receiptFormat}`}>
                <h3>POS360</h3>
                <p>{business.name}</p>
                {business.nit && <p>NIT {business.nit}</p>}
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
                <button className="primary" onClick={countAndClose}>
                  Realizar arqueo y solicitar cierre
                </button>
              )}
              {modal === "movement"&&<button className="primary" onClick={saveCashMovement}>Registrar movimiento</button>}
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
