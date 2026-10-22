import { FormEvent, useEffect, useRef, useState } from "react";
import { api, money } from "../api/client";
import type { Product, Addon } from "../types";
import { generateUUID } from "../utils/uuid";
import "./OnsiteOrderModal.css";

type CartLine = { id: string; productId: string; addons: Record<string, number> };
type MenuResponse = { products: Product[]; addons: Addon[] };
type Receipt = {
  id: string; queueNumber?: number | null; customer: string;
  totalCentavos: number; status: string; payment: string;
  items: { name: string; quantity: number; unitPriceCentavos: number;
    addons: { name: string; quantity: number; unitPriceCentavos: number }[] }[];
};

export function OnsiteOrderPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [addonModalLineId, setAddonModalLineId] = useState<string | null>(null);
  const [addonDraft, setAddonDraft] = useState<Record<string, number>>({});
  const requestKey = useRef("");
  const submitting = useRef(false);

  useEffect(() => {
    let active = true;
    api<MenuResponse>("/onsite/menu")
      .then(data => { if (active) { setProducts(data.products); setAddons(data.addons); } })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : "Unable to load menu"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function changed() { requestKey.current = ""; setError(""); }
  const activeAddons = addons.filter(a => a.active);
  const selectedLine = cart.find(line => line.id === addonModalLineId);
  const selectedProduct = products.find(p => p.id === selectedLine?.productId);
  const productFor = (line: CartLine) => products.find(p => p.id === line.productId);
  const cupTotal = (line: CartLine) =>
    (productFor(line)?.priceCentavos ?? 0) + addons.reduce(
      (sum, a) => sum + a.priceCentavos * (line.addons[a.id] || 0), 0);
  const total = cart.reduce((sum, line) => sum + cupTotal(line), 0);
  const draftCupTotal = (selectedProduct?.priceCentavos ?? 0) + addons.reduce(
    (sum, a) => sum + a.priceCentavos * (addonDraft[a.id] || 0), 0);
  const counts = cart.reduce<Record<string, number>>((acc, line) => {
    acc[line.productId] = (acc[line.productId] || 0) + 1;
    return acc;
  }, {});

  function addCup(productId: string) {
    if (busy || receipt) return;
    if (cart.length >= 50) { setError("Maximum of 50 cups per order."); return; }
    changed();
    setCart(prev => [...prev, { id: generateUUID(), productId, addons: {} }]);
  }
  function removeCup(id: string) {
    if (busy) return;
    changed();
    setCart(prev => prev.filter(line => line.id !== id));
    if (addonModalLineId === id) setAddonModalLineId(null);
  }
  function openAddons(line: CartLine) {
    if (busy || !activeAddons.length) return;
    setAddonDraft({ ...line.addons });
    setAddonModalLineId(line.id);
  }
  function adjustAddon(id: string, delta: number) {
    setAddonDraft(prev => ({ ...prev, [id]: Math.min(99, Math.max(0, (prev[id] || 0) + delta)) }));
  }
  function saveAddons() {
    if (!addonModalLineId || busy) return;
    changed();
    setCart(prev => prev.map(line => line.id === addonModalLineId
      ? { ...line, addons: { ...addonDraft } } : line));
    setAddonModalLineId(null);
  }
  function reviewOrder(event: FormEvent) {
    event.preventDefault();
    if (busy || submitting.current || receipt) return;
    if (!customer.trim()) { setError("Please enter your name."); return; }
    if (!cart.length) { setError("Please select at least one coffee."); return; }
    setError("");
    setReviewOpen(true);
  }
  async function confirmOrder() {
    if (busy || submitting.current || !reviewOpen || !cart.length || !customer.trim()) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    requestKey.current ||= generateUUID();
    try {
      const result = await api<Receipt>("/onsite/orders", {
        method: "POST",
        headers: { "Idempotency-Key": requestKey.current },
        body: JSON.stringify({
          customer: customer.trim(),
          items: cart.map(line => ({
            productId: line.productId,
            quantity: 1,
            addons: Object.entries(line.addons)
              .filter(([, quantity]) => quantity > 0)
              .map(([addonId, quantity]) => ({ addonId, quantity })),
          })),
        }),
      });
      setReceipt(result);
      setReviewOpen(false);
      setAddonModalLineId(null);
      setCart([]);
      requestKey.current = "";
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to place order");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  function newOrder() {
    setReceipt(null); setCart([]); setCustomer(""); setReviewOpen(false);
    setAddonModalLineId(null); setAddonDraft({}); requestKey.current = ""; setError("");
  }

  return (
    <div className="onsite-page">
      <header className="onsite-header">
        <img src="/estylo-logo.png" alt="Estylo Coffee" />
        <h2>ESTYLO COFFEE</h2>
        <p>Onsite Ordering</p>
      </header>
      <main className="onsite-main">
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        {receipt ? (
          <section className="onsite-receipt">
            <h2>Order Received!</h2>
            <p>Thank you, <strong>{receipt.customer}</strong>.</p>
            <p className="onsite-gold">Please proceed to the cashier for payment.</p>
            {receipt.queueNumber != null && <><small>QUEUE NUMBER</small><h1>#{String(receipt.queueNumber).padStart(3, "0")}</h1></>}
            <small>ORDER REFERENCE</small><h3>{receipt.id.slice(0, 8).toUpperCase()}</h3>
            <hr />
            {receipt.items.map((item, index) => {
              const extras = item.addons.reduce((sum, a) => sum + a.quantity * a.unitPriceCentavos, 0);
              return <div className="onsite-receipt-item" key={index}>
                <div className="onsite-between"><strong>{item.quantity} × {item.name}</strong>
                  <strong>{money(item.quantity * (item.unitPriceCentavos + extras))}</strong></div>
                {item.addons.map((a, i) => <small key={i}>+ {a.name} × {a.quantity}</small>)}
              </div>;
            })}
            <hr />
            <div className="onsite-between"><h4>Total Amount</h4><h3 className="onsite-gold">{money(receipt.totalCentavos)}</h3></div>
            <p>Payment: <strong>UNPAID</strong></p>
            <p className="onsite-muted">Keep this screen open or take a screenshot of your order reference.</p>
            <button type="button" className="btn btn-warning w-100 mt-3" onClick={newOrder}>Place Another Order</button>
            <a href="/queue" className="btn btn-outline-light w-100 mt-2">View Coffee Queue</a>
          </section>
        ) : <>
          <div className="onsite-intro"><div><h2>Order Your Coffee</h2><p>Choose your drinks, customize each cup, and review before ordering.</p></div>
            <span className="onsite-cart-pill"><i className="bi bi-cup-hot" /> {cart.length} cups</span></div>
          <div className="onsite-layout">
            <section className="onsite-panel">
              <h4>Coffee Menu</h4>
              {loading ? <p>Loading menu...</p> : <div className="onsite-products">
                {products.filter(p => p.active).map(product => {
                  const count = counts[product.id] || 0;
                  return <button type="button" key={product.id}
                    className={`onsite-tile${count ? " onsite-tile-selected" : ""}`}
                    disabled={busy || !product.priceCentavos}
                    aria-label={`Add one ${product.name}; ${count} already selected`}
                    onClick={() => addCup(product.id)}>
                    {count > 0 && <span className="onsite-count-badge" aria-label={`${count} selected`}>{count}</span>}
                    <strong>{product.name}</strong>
                    <span className="onsite-gold">{product.priceCentavos ? money(product.priceCentavos) : "Price not configured"}</span>
                    <small>+ Add cup</small>
                  </button>;
                })}
              </div>}
              {!loading && !products.some(p => p.active) && <p>No coffee available at the moment.</p>}
            </section>
            <form className="onsite-panel onsite-order" onSubmit={reviewOrder}>
              <h4>Your Order</h4><p className="onsite-muted">{cart.length} cup(s) selected</p>
              {!cart.length && <p className="onsite-muted">Tap a coffee from the menu to get started.</p>}
              {cart.map((line, index) => {
                const product = productFor(line);
                const chosen = activeAddons.filter(a => (line.addons[a.id] || 0) > 0);
                const addonCount = chosen.reduce((sum, a) => sum + line.addons[a.id], 0);
                return <div key={line.id} className="onsite-cup">
                  <div className="onsite-between onsite-cup-top">
                    <div><strong>Cup {index + 1} — {product?.name}</strong><small>{money(product?.priceCentavos ?? 0)} base</small></div>
                    <button type="button" className="btn btn-outline-danger" disabled={busy} onClick={() => removeCup(line.id)}>Remove</button>
                  </div>
                  <div className="onsite-between onsite-cup-bottom">
                    <button type="button" className="btn btn-outline-warning" disabled={busy || !activeAddons.length}
                      onClick={() => openAddons(line)}>Add-ons {addonCount > 0 && <span className="onsite-addon-count">{addonCount}</span>}</button>
                    <strong>{money(cupTotal(line))}</strong>
                  </div>
                  <small className="onsite-muted">{chosen.length ? chosen.map(a => `${a.name} × ${line.addons[a.id]}`).join(" · ") : "No add-ons selected"}</small>
                </div>;
              })}
              <div className="onsite-between onsite-total"><h4>Total</h4><h3 className="onsite-gold">{money(total)}</h3></div>
              <label htmlFor="onsite-customer" className="form-label">Name for your order</label>
              <input id="onsite-customer" className="form-control" required maxLength={100}
                placeholder="Enter your name" disabled={busy} value={customer}
                onChange={e => { changed(); setCustomer(e.target.value); }} />
              <p className="onsite-muted mt-3">No phone number or account required. Payment will be handled at the cashier.</p>
              <button type="submit" className="btn btn-warning btn-lg w-100 mt-2" disabled={busy || loading || !cart.length}>
                Review Order — {money(total)}
              </button>
              {cart.length > 0 && <button type="button" className="btn btn-outline-light w-100 mt-2" disabled={busy}
                onClick={() => { changed(); setCart([]); }}>Clear Cart</button>}
            </form>
          </div>
        </>}
      </main>

      {addonModalLineId && selectedLine && !receipt && <div className="onsite-modal-backdrop"
        onClick={e => { if (e.target === e.currentTarget && !busy) setAddonModalLineId(null); }}>
        <section className="onsite-modal" role="dialog" aria-modal="true" aria-labelledby="onsite-addons-title">
          <header className="onsite-modal-header"><div><h4 id="onsite-addons-title">Add-ons for Cup {cart.findIndex(l => l.id === selectedLine.id) + 1}</h4>
            <p>{selectedProduct?.name} · Tap + or − to adjust add-ons.</p></div>
            <button type="button" className="onsite-close" disabled={busy} aria-label="Close add-ons" onClick={() => setAddonModalLineId(null)}>×</button></header>
          <div className="onsite-modal-list">{activeAddons.map(a => {
            const quantity = addonDraft[a.id] || 0;
            return <div className="onsite-addon-option" key={a.id}>
              <div><strong>{a.name}</strong><small>{money(a.priceCentavos)} each</small></div>
              <div className="onsite-qty-controls">
                <button type="button" disabled={busy || quantity === 0} aria-label={`Remove one ${a.name}`} onClick={() => adjustAddon(a.id, -1)}>−</button>
                <strong>{quantity}</strong>
                <button type="button" disabled={busy || quantity >= 99} aria-label={`Add one ${a.name}`} onClick={() => adjustAddon(a.id, 1)}>+</button>
              </div>
            </div>;
          })}</div>
          <footer className="onsite-modal-footer"><div className="onsite-between"><strong>Cup total</strong><strong className="onsite-gold">{money(draftCupTotal)}</strong></div>
            <div className="onsite-modal-actions"><button type="button" className="btn btn-outline-light" disabled={busy} onClick={() => setAddonModalLineId(null)}>Cancel</button>
              <button type="button" className="btn btn-warning" disabled={busy} onClick={saveAddons}>Save add-ons</button></div></footer>
        </section>
      </div>}

      {reviewOpen && !receipt && <div className="onsite-modal-backdrop">
        <section className="onsite-modal" role="dialog" aria-modal="true" aria-labelledby="onsite-review-title">
          <header className="onsite-modal-header"><div><h4 id="onsite-review-title">Review & Confirm Order</h4><p>Nothing is submitted until you tap Confirm Order.</p></div>
            <button type="button" className="onsite-close" disabled={busy} aria-label="Back to edit" onClick={() => setReviewOpen(false)}>×</button></header>
          <div className="onsite-modal-list">
            <p><strong>Customer:</strong> {customer.trim()}</p>
            <p className="onsite-gold">Please pay at the cashier after placing your order.</p>
            {cart.map((line, index) => {
              const chosen = addons.filter(a => (line.addons[a.id] || 0) > 0);
              return <div key={line.id} className="onsite-review-cup"><div className="onsite-between"><strong>Cup {index + 1} — {productFor(line)?.name}</strong><strong>{money(cupTotal(line))}</strong></div>
                {chosen.map(a => <small key={a.id}>+ {a.name} × {line.addons[a.id]} — {money(a.priceCentavos * line.addons[a.id])}</small>)}
              </div>;
            })}
            <div className="onsite-between"><strong>Total cups</strong><strong>{cart.length}</strong></div>
            <div className="onsite-between"><strong>Grand total</strong><strong className="onsite-gold">{money(total)}</strong></div>
            {error && <div role="alert" className="alert alert-danger mt-3">{error}</div>}
          </div>
          <footer className="onsite-modal-footer"><div className="onsite-modal-actions">
            <button type="button" className="btn btn-outline-light" disabled={busy} onClick={() => { setReviewOpen(false); setError(""); }}>Back to Edit</button>
            <button type="button" className="btn btn-warning" disabled={busy} onClick={confirmOrder}>{busy ? "Placing Order…" : "Confirm Order"}</button>
          </div></footer>
        </section>
      </div>}
    </div>
  );
}
