import { FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./CashierHeader.css";
import "./CashierCupBadges.css";
import { api, money } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Product, Addon } from "../types";

type CartLine = {
  id: string;
  productId: string;
  addons: Record<string, number>;
  freeDrink: boolean;
};

function key() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
}

export function CashierPage() {
  const { user, logout } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [fulfillment, setFulfillment] = useState("PICKUP");
  const [source, setSource] = useState("WALK_IN");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [successQueue, setSuccessQueue] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<{
    id: string;
    queueNumber: number | null;
    customer: string;
    cups: number;
    total: number;
  } | null>(null);
  const submitting = useRef(false);
  const [addonModalLineId, setAddonModalLineId] = useState<string | null>(null);
  const [addonDraft, setAddonDraft] = useState<Record<string, number>>({});
  const requestKey = useRef("");

  const activeAddons = addons.filter((addon) => addon.active);
  const editingLine = cart.find((line) => line.id === addonModalLineId);
  const editingProduct = products.find((product) => product.id === editingLine?.productId);

  useEffect(() => {
    Promise.all([api<Product[]>("/products"), api<Addon[]>("/addons")])
      .then(([drinks, extras]) => {
        setProducts(drinks);
        setAddons(extras);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Unable to load menu."));
  }, []);

  useEffect(() => {
    if (!addonModalLineId) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setAddonModalLineId(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [addonModalLineId]);

  function changed() {
    requestKey.current = "";
    setSuccess("");
    setSuccessQueue(null);
  }

  function basePrice(line: CartLine) {
    return products.find((p) => p.id === line.productId)?.priceCentavos || 0;
  }

  function addonPrice(line: CartLine) {
    return addons.reduce((sum, addon) =>
      sum + addon.priceCentavos * (line.addons[addon.id] || 0), 0);
  }

  function lineTotal(line: CartLine) {
    return (line.freeDrink ? 0 : basePrice(line)) + addonPrice(line);
  }

  const total = cart.reduce((sum, line) => sum + lineTotal(line), 0);
  const totalCupCount = cart.length;
  const discount = cart.reduce((sum, line) => sum + (line.freeDrink ? basePrice(line) : 0), 0);

  function addCup(productId: string) {
    if (busy) return;
    if (cart.length >= 50) {
      setError("Maximum 50 cups per order.");
      return;
    }
    changed();
    setError("");
    setCart((old) => [...old, { id: key(), productId, addons: {}, freeDrink: false }]);
  }

  function removeCup(lineId: string) {
    if (busy) return;
    changed();
    setCart((old) => old.filter((line) => line.id !== lineId));
  }

  function toggleFreeDrink(lineId: string, freeDrink: boolean) {
    if (busy) return;
    changed();
    setCart((old) => old.map((line) =>
      line.id === lineId ? { ...line, freeDrink } : line));
  }

  function openAddonModal(line: CartLine) {
    if (busy || !activeAddons.length) return;
    setAddonDraft({ ...line.addons });
    setAddonModalLineId(line.id);
  }

  function updateAddonQuantity(addonId: string, change: number) {
    setAddonDraft((old) => ({
      ...old,
      [addonId]: Math.min(99, Math.max(0, (old[addonId] || 0) + change)),
    }));
  }

  function saveAddonChanges() {
    if (!addonModalLineId || busy) return;
    changed();
    setCart((old) => old.map((line) =>
      line.id === addonModalLineId ? { ...line, addons: { ...addonDraft } } : line));
    setAddonModalLineId(null);
  }

  const draftAddonTotal = addons.reduce((sum, addon) =>
    sum + addon.priceCentavos * (addonDraft[addon.id] || 0), 0);
  const editingCupTotal = (editingLine?.freeDrink ? 0 : (editingProduct?.priceCentavos || 0)) + draftAddonTotal;

  function reviewOrder(e: FormEvent) {
    e.preventDefault();
    if (busy || submitting.current) return;
    if (!cart.length) {
      setError("Select at least one drink.");
      return;
    }
    setError("");
    setReviewOpen(true);
  }

  async function confirmOrder() {
    if (busy || submitting.current || !reviewOpen || !cart.length) return;
    submitting.current = true;
    if (!cart.length) {
      setError("Select at least one drink.");
      return;
    }
    setBusy(true);
    setError("");
    requestKey.current ||= key();
    try {
      const result = await api<{ id: string; queueNumber: number | null }>("/orders", {
        method: "POST",
        headers: { "Idempotency-Key": requestKey.current },
        body: JSON.stringify({
          customer, phone, address, fulfillment, source,
          items: cart.map((line) => ({
            productId: line.productId,
            quantity: 1,
            freeDrink: line.freeDrink,
            addons: Object.entries(line.addons)
              .filter(([, quantity]) => quantity > 0)
              .map(([addonId, quantity]) => ({ addonId, quantity })),
          })),
        }),
      });
      setSuccess(result.id);
      setSuccessQueue(result.queueNumber);
      setCreatedOrder({
        id: result.id,
        queueNumber: result.queueNumber,
        customer: customer.trim() || "Walk-in Customer",
        cups: cart.length,
        total,
      });
      setReviewOpen(false);
      setCart([]);
      setCustomer("");
      setPhone("");
      setAddress("");
      setAddonModalLineId(null);
      setAddonDraft({});
      requestKey.current = "";
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Order failed");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="pos">
      <header className="pos-header cashier-topbar">
        <div className="pos-brand cashier-topbar-brand">
          <img src="/estylo-logo.png" alt="Estylo Coffee" />
          <div>
            <b>ESTYLO COFFEE</b>
            <small className="d-block">Cashier workspace</small>
          </div>
        </div>
        <div className="cashier-topbar-right">
          <span className="cashier-topbar-user" title={user?.displayName}>
            <i className="bi bi-person-circle" aria-hidden="true" />
            {user?.displayName}
          </span>
          <nav className="cashier-topbar-actions" aria-label="Cashier navigation">
            <Link to="/orders" className="cashier-nav-btn cashier-nav-primary">
              <i className="bi bi-receipt" aria-hidden="true" />
              <span>View Orders</span>
            </Link>
            {user?.role === "ADMIN" && (
              <Link to="/dashboard" className="cashier-nav-btn cashier-nav-secondary">
                <i className="bi bi-grid-1x2" aria-hidden="true" />
                <span>Dashboard</span>
              </Link>
            )}
            <button type="button" className="cashier-nav-btn cashier-nav-secondary"
              onClick={() => logout().catch((e) => setError(e.message))}>
              <i className="bi bi-box-arrow-right" aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </nav>
        </div>
      </header>

      {error && <div role="alert" className="alert alert-danger m-3">{error}</div>}
      {success && (
        <div role="status" className="alert alert-success m-3">
          {successQueue != null && <strong>Queue #{String(successQueue).padStart(3, "0")} — </strong>}
          Order {success.slice(0, 8)} created. <Link to="/orders">Open order board</Link>
        </div>
      )}

      <div className="pos-grid">
        <section className="pos-left">
          <div className="section-label">COFFEE MENU</div>
          <h2 className="mb-4">Make someone's day.</h2>
          <p>Tap a drink to add one separately customizable cup.</p>
          <div className="product-grid">
            {products.filter((p) => p.active).map((p) => {
              const selectedCups = cart.filter((line) => line.productId === p.id).length;
              return (
                <button type="button" disabled={busy || !p.priceCentavos}
                  className={`tile cashier-drink-tile${selectedCups ? " cashier-drink-selected" : ""}`}
                  key={p.id} onClick={() => addCup(p.id)}
                  aria-label={`${p.name}, ${selectedCups} cup${selectedCups === 1 ? "" : "s"} selected. Add one cup.`}>
                  {selectedCups > 0 && (
                    <span className="cashier-cup-badge" aria-label={`${selectedCups} selected cups`}>
                      {selectedCups}
                    </span>
                  )}
                  <strong>{p.name}</strong>
                  <span>{p.priceCentavos ? money(p.priceCentavos) : "Price not configured"}</span>
                </button>
              );
            })}
          </div>
          {!products.some((p) => p.active) && <p className="empty">No menu available.</p>}
        </section>

        <form className="pos-right" onSubmit={reviewOrder} onChange={changed}>
          <h4>Current order</h4>
          <div className="sale-lines">
            {!cart.length ? <p className="empty">Select drinks to begin.</p> :
              cart.map((line, index) => {
                const product = products.find((p) => p.id === line.productId);
                const selectedAddons = activeAddons.filter((addon) => (line.addons[addon.id] || 0) > 0);
                const selectedAddonCount = selectedAddons.reduce((sum, addon) => sum + (line.addons[addon.id] || 0), 0);
                const addonSummary = selectedAddons.map((addon) => `${addon.name} × ${line.addons[addon.id]}`).join(" · ");
                return (
                  <div key={line.id} className="sale-item">
                    <div className="sale-line">
                      <div className="sale-item-main">
                        <strong>Cup {index + 1} — {product?.name}</strong>
                        <small>Base price: {line.freeDrink ? <><s>{money(basePrice(line))}</s> <strong className="text-success">FREE</strong></> : money(basePrice(line))}</small>
                      </div>
                      <div className="sale-item-actions">
                        <button type="button" className="btn btn-sm btn-outline-warning addon-open-btn"
                          disabled={busy || !activeAddons.length} onClick={() => openAddonModal(line)}
                          aria-label={`Add-ons for cup ${index + 1}`}>
                          Add-ons {selectedAddonCount > 0 && <span className="addon-count">{selectedAddonCount}</span>}
                        </button>
                        <button type="button" className="btn btn-sm btn-outline-danger"
                          disabled={busy} onClick={() => removeCup(line.id)}>Remove</button>
                      </div>
                    </div>
                    <label className="d-flex align-items-center gap-2 mt-2 mb-2" style={{ cursor: "pointer", minHeight: 44 }}>
                      <input type="checkbox" className="form-check-input mt-0" style={{ width: 22, height: 22 }}
                        checked={line.freeDrink} disabled={busy}
                        onChange={(e) => toggleFreeDrink(line.id, e.target.checked)} />
                      <strong>Free Drink</strong>
                      <small className="text-secondary">(base drink only; add-ons charged)</small>
                    </label>
                    <small className="addon-summary">{addonSummary || "No add-ons selected"}</small>
                    {line.freeDrink && <small className="d-block text-success">Complimentary base drink · Add-ons: {money(addonPrice(line))}</small>}
                    <div className="sale-item-footer"><strong>Cup total: {money(lineTotal(line))}</strong></div>
                  </div>
                );
              })}
          </div>

          <fieldset disabled={busy}>
            <div className="totals">
              <div className="total-row cup-count-row"><span>Total Cup Count</span><strong>{totalCupCount}</strong></div>
              {discount > 0 && <div className="total-row"><span>Free drink discount</span><strong>−{money(discount)}</strong></div>}
              <div className="total-row grand-total"><span>Total Amount</span><span>{money(total)}</span></div>
            </div>
            <label className="form-label mt-3" htmlFor="customer">Customer Name (optional for walk-in pickup)</label>
            <input id="customer" className="form-control" required={source === "SMS" || fulfillment === "DELIVERY"}
              maxLength={100} placeholder="Leave blank to use queue number" value={customer}
              onChange={(e) => setCustomer(e.target.value)} />
            <label className="form-label mt-3" htmlFor="phone">Phone</label>
            <input id="phone" type="tel" className="form-control" maxLength={30}
              required={source === "SMS" || fulfillment === "DELIVERY"} value={phone}
              onChange={(e) => setPhone(e.target.value)} />
            <div className="row mt-3">
              <div className="col">
                <label htmlFor="fulfillment">Fulfillment</label>
                <select id="fulfillment" className="form-select" value={fulfillment}
                  onChange={(e) => setFulfillment(e.target.value)}>
                  <option value="PICKUP">Pickup</option><option value="DELIVERY">Delivery</option>
                </select>
              </div>
              <div className="col">
                <label htmlFor="source">Source</label>
                <select id="source" className="form-select" value={source}
                  onChange={(e) => setSource(e.target.value)}>
                  <option value="WALK_IN">Walk-in</option><option value="SMS">SMS</option>
                </select>
              </div>
            </div>
            {fulfillment === "DELIVERY" && <>
              <label htmlFor="address" className="mt-3">Delivery address</label>
              <textarea id="address" className="form-control" required maxLength={300}
                value={address} onChange={(e) => setAddress(e.target.value)} />
            </>}
            <button type="submit" className="btn btn-estylo complete-btn w-100" disabled={busy || !cart.length}>
              CREATE ORDER
            </button>
            <button type="button" className="btn btn-outline-light clear-btn w-100" disabled={busy}
              onClick={() => { setCart([]); setAddonModalLineId(null); setAddonDraft({}); changed(); }}>
              Clear cart
            </button>
          </fieldset>
        </form>
      </div>

      {/* Order review: the POST request is only triggered by Confirm Order. */}
      {reviewOpen && (
        <div className="addon-modal-backdrop" role="presentation">
          <section
            className="addon-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-order-title"
            style={{ maxHeight: "90vh", overflowY: "auto" }}
          >
            <header className="addon-modal-header">
              <div>
                <h4 id="review-order-title">Review & Confirm Order</h4>
                <p>Nothing is saved until you tap Confirm Order.</p>
              </div>
              <button type="button" className="addon-modal-close"
                disabled={busy} aria-label="Back to edit"
                onClick={() => setReviewOpen(false)}>×</button>
            </header>
            <div className="p-3">
              <p className="mb-1"><strong>Customer:</strong> {customer.trim() || "Walk-in Customer"}</p>
              <p className="mb-1"><strong>Fulfillment:</strong> {fulfillment.replace("_", " ")}</p>
              <p className="mb-1"><strong>Source:</strong> {source.replace("_", " ")}</p>
              {phone.trim() && <p className="mb-1"><strong>Phone:</strong> {phone}</p>}
              {fulfillment === "DELIVERY" && <p><strong>Address:</strong> {address}</p>}
              <p className="small text-secondary mt-2">Queue number will be assigned after confirmation.</p>
              <hr />
              {cart.map((line, index) => {
                const product = products.find((p) => p.id === line.productId);
                const chosen = addons.filter((addon) => (line.addons[addon.id] || 0) > 0);
                return (
                  <div key={line.id} className="mb-3 pb-2 border-bottom">
                    <div className="d-flex justify-content-between gap-2">
                      <strong>Cup {index + 1} — {product?.name || "Drink"}</strong>
                      <strong>{money(lineTotal(line))}</strong>
                    </div>
                    <small className="d-block">
                      Base: {line.freeDrink ? <><s>{money(basePrice(line))}</s> <strong className="text-success">FREE</strong></> : money(basePrice(line))}
                    </small>
                    {chosen.map((addon) => (
                      <small key={addon.id} className="d-block">
                        + {addon.name} × {line.addons[addon.id]} — {money(addon.priceCentavos * line.addons[addon.id])}
                      </small>
                    ))}
                    {line.freeDrink && <small className="d-block text-success">Only the base drink is free; add-ons are charged.</small>}
                  </div>
                );
              })}
              <div className="d-flex justify-content-between"><strong>Total cups</strong><strong>{totalCupCount}</strong></div>
              {discount > 0 && <div className="d-flex justify-content-between"><span>Free drink discount</span><strong>−{money(discount)}</strong></div>}
              <div className="d-flex justify-content-between mt-2"><strong>Grand total</strong><strong>{money(total)}</strong></div>
              {error && <div role="alert" className="alert alert-danger mt-3">{error}</div>}
            </div>
            <footer className="addon-modal-footer">
              <div className="addon-modal-actions" style={{ width: "100%" }}>
                <button type="button" className="btn btn-outline-light" disabled={busy}
                  onClick={() => { setReviewOpen(false); setError(""); }}>Back to Edit</button>
                <button type="button" className="btn btn-estylo" disabled={busy}
                  onClick={confirmOrder}>{busy ? "Creating…" : "Confirm Order"}</button>
              </div>
            </footer>
          </section>
        </div>
      )}

      {/* Actual backend-assigned queue number is shown only after creation. */}
      {createdOrder && (
        <div className="addon-modal-backdrop" role="presentation">
          <section className="addon-modal" role="dialog" aria-modal="true" aria-labelledby="created-order-title">
            <header className="addon-modal-header">
              <div>
                <h4 id="created-order-title">Order Created Successfully!</h4>
                <p>Order {createdOrder.id.slice(0, 8)}</p>
              </div>
            </header>
            <div className="p-4 text-center">
              <div className="small text-secondary">QUEUE NUMBER</div>
              <h2 className="display-4 text-warning">
                {createdOrder.queueNumber == null ? "Pending" : `#${String(createdOrder.queueNumber).padStart(3, "0")}`}
              </h2>
              <div className="small text-secondary">CUSTOMER NAME</div>
              <h4>{createdOrder.customer}</h4>
              <p>{createdOrder.cups} cup(s) · {money(createdOrder.total)}</p>
            </div>
            <footer className="addon-modal-footer">
              <div className="addon-modal-actions" style={{ width: "100%" }}>
                <button type="button" className="btn btn-outline-light"
                  onClick={() => setCreatedOrder(null)}>Create New Order</button>
                <Link className="btn btn-estylo" to="/orders">Open Order Board</Link>
              </div>
            </footer>
          </section>
        </div>
      )}

      {addonModalLineId && editingLine && (
        <div className="addon-modal-backdrop" role="presentation"
          onClick={(event) => { if (event.target === event.currentTarget) setAddonModalLineId(null); }}>
          <section className="addon-modal" role="dialog" aria-modal="true" aria-labelledby="addon-modal-title">
            <header className="addon-modal-header">
              <div>
                <h4 id="addon-modal-title">Add-ons for Cup {cart.findIndex((line) => line.id === editingLine.id) + 1}</h4>
                <p>{editingProduct?.name} · Tap + or − to adjust add-ons.</p>
              </div>
              <button type="button" className="addon-modal-close" aria-label="Close add-ons"
                onClick={() => setAddonModalLineId(null)}>×</button>
            </header>
            <div className="addon-modal-list">
              {activeAddons.map((addon) => {
                const quantity = addonDraft[addon.id] || 0;
                return (
                  <div key={addon.id} className="addon-option">
                    <div className="addon-option-info">
                      <span className="addon-option-name">{addon.name}</span>
                      <span className="addon-option-price">{money(addon.priceCentavos)} each</span>
                    </div>
                    <div className="addon-quantity-controls">
                      <button type="button" className="addon-qty-btn" disabled={busy || quantity === 0}
                        aria-label={`Remove one ${addon.name}`} onClick={() => updateAddonQuantity(addon.id, -1)}>−</button>
                      <span className="addon-qty-value">{quantity}</span>
                      <button type="button" className="addon-qty-btn" disabled={busy || quantity >= 99}
                        aria-label={`Add one ${addon.name}`} onClick={() => updateAddonQuantity(addon.id, 1)}>+</button>
                    </div>
                  </div>
                );
              })}
            </div>
            <footer className="addon-modal-footer">
              <div className="addon-modal-total"><span>Cup total</span><strong>{money(editingCupTotal)}</strong></div>
              <div className="addon-modal-actions">
                <button type="button" className="btn btn-outline-light" onClick={() => setAddonModalLineId(null)}>Cancel</button>
                <button type="button" className="btn btn-estylo" disabled={busy} onClick={saveAddonChanges}>Save add-ons</button>
              </div>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
