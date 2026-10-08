import { FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, money } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Product, Addon } from "../types";

type CartLine = {
  id: string;
  productId: string;
  addons: Record<string, number>;
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
  const [busy, setBusy] = useState(false);

  const requestKey = useRef("");

  useEffect(() => {
    Promise.all([
      api<Product[]>("/products"),
      api<Addon[]>("/addons"),
    ])
      .then(([drinks, extras]) => {
        setProducts(drinks);
        setAddons(extras);
      })
      .catch((e) => setError(e.message));
  }, []);

  function changed() {
    requestKey.current = "";
    setSuccess("");
  }

  function lineTotal(line: CartLine) {
    const product = products.find((p) => p.id === line.productId);
    return (
      (product?.priceCentavos || 0) +
      addons.reduce(
        (sum, addon) =>
          sum + addon.priceCentavos * (line.addons[addon.id] || 0),
        0,
      )
    );
  }

  const total = cart.reduce((sum, line) => sum + lineTotal(line), 0);

  function addCup(productId: string) {
    if (busy) return;

    if (cart.length >= 50) {
      setError("Maximum 50 cups per order.");
      return;
    }

    changed();
    setError("");
    setCart((old) => [
      ...old,
      { id: key(), productId, addons: {} },
    ]);
  }

  function removeCup(lineId: string) {
    changed();
    setCart((old) => old.filter((line) => line.id !== lineId));
  }

  function updateAddon(
    lineId: string,
    addonId: string,
    value: string,
  ) {
    const quantity = Math.min(
      99,
      Math.max(0, Math.floor(Number(value) || 0)),
    );

    changed();

    setCart((old) =>
      old.map((line) =>
        line.id === lineId
          ? {
              ...line,
              addons: { ...line.addons, [addonId]: quantity },
            }
          : line,
      ),
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();

    if (busy) return;

    if (!cart.length) {
      setError("Select at least one drink.");
      return;
    }

    setBusy(true);
    setError("");
    requestKey.current ||= key();

    try {
      const result = await api<{ id: string }>("/orders", {
        method: "POST",
        headers: { "Idempotency-Key": requestKey.current },
        body: JSON.stringify({
          customer,
          phone,
          address,
          fulfillment,
          source,
          items: cart.map((line) => ({
            productId: line.productId,
            quantity: 1,
            addons: Object.entries(line.addons)
              .filter(([, quantity]) => quantity > 0)
              .map(([addonId, quantity]) => ({
                addonId,
                quantity,
              })),
          })),
        }),
      });

      setSuccess(result.id);
      setCart([]);
      setCustomer("");
      setPhone("");
      setAddress("");
      requestKey.current = "";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Order failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pos">
      <header className="pos-header">
        <div className="pos-brand">
          <img src="/estylo-logo.png" alt="Estylo Coffee" />
          <div>
            <b>ESTYLO COFFEE</b>
            <small className="d-block">Cashier workspace</small>
          </div>
        </div>

        <div className="pos-user">
          <span>{user?.displayName}</span>
          <div>
            <Link
              className="text-warning me-3"
              to={user?.role === "ADMIN" ? "/dashboard" : "/orders"}
            >
              Management
            </Link>
            <button
              className="btn btn-sm btn-outline-light"
              onClick={() =>
                logout().catch((e) => setError(e.message))
              }
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div role="alert" className="alert alert-danger m-3">
          {error}
        </div>
      )}

      {success && (
        <div role="status" className="alert alert-success m-3">
          Order {success.slice(0, 8)} created.{" "}
          <Link to="/orders">Open order board</Link>
        </div>
      )}

      <div className="pos-grid">
        <section className="pos-left">
          <div className="section-label">COFFEE MENU</div>
          <h2 className="mb-4">Make someone's day.</h2>
          <p>Tap a drink to add one separately customizable cup.</p>

          <div className="product-grid">
            {products
              .filter((p) => p.active)
              .map((p) => (
                <button
                  type="button"
                  disabled={busy || !p.priceCentavos}
                  className="tile"
                  key={p.id}
                  onClick={() => addCup(p.id)}
                >
                  <strong>{p.name}</strong>
                  <span>
                    {p.priceCentavos
                      ? money(p.priceCentavos)
                      : "Price not configured"}
                  </span>
                </button>
              ))}
          </div>

          {!products.some((p) => p.active) && (
            <p className="empty">No menu available.</p>
          )}
        </section>

        <form
          className="pos-right"
          onSubmit={submit}
          onChange={changed}
        >
          <h4>Current order</h4>

          <div className="sale-lines">
            {!cart.length ? (
              <p className="empty">Select drinks to begin.</p>
            ) : (
              cart.map((line, index) => {
                const product = products.find(
                  (p) => p.id === line.productId,
                );

                return (
                  <div key={line.id} className="mb-3 pb-3 border-bottom">
                    <div className="sale-line">
                      <div>
                        <strong>
                          Cup {index + 1} — {product?.name}
                        </strong>
                        <small>
                          Base price: {money(product?.priceCentavos || 0)}
                        </small>
                      </div>

                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        disabled={busy}
                        aria-label={`Remove cup ${index + 1}`}
                        onClick={() => removeCup(line.id)}
                      >
                        Remove
                      </button>
                    </div>

                    <small>Add-ons for this cup only</small>

                    {addons
                      .filter((a) => a.active)
                      .map((addon) => (
                        <label
                          key={addon.id}
                          className="d-flex justify-content-between align-items-center gap-2 mt-2"
                        >
                          <span>
                            {addon.name} ({money(addon.priceCentavos)})
                          </span>
                          <input
                            style={{ width: 80 }}
                            aria-label={`Cup ${index + 1} ${addon.name} quantity`}
                            className="form-control"
                            type="number"
                            min="0"
                            max="99"
                            step="1"
                            disabled={busy}
                            value={line.addons[addon.id] || 0}
                            onChange={(e) =>
                              updateAddon(
                                line.id,
                                addon.id,
                                e.target.value,
                              )
                            }
                          />
                        </label>
                      ))}

                    <strong className="d-block mt-2">
                      Cup total: {money(lineTotal(line))}
                    </strong>
                  </div>
                );
              })
            )}
          </div>

          <fieldset disabled={busy}>
            <div className="totals">
              <div className="total-row grand-total">
                <span>Total</span>
                <span>{money(total)}</span>
              </div>
            </div>

            <label className="form-label mt-3" htmlFor="customer">
              Customer
            </label>
            <input
              id="customer"
              className="form-control"
              required
              maxLength={100}
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
            />

            <label className="form-label mt-3" htmlFor="phone">
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              className="form-control"
              maxLength={30}
              required={source === "SMS" || fulfillment === "DELIVERY"}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <div className="row mt-3">
              <div className="col">
                <label htmlFor="fulfillment">Fulfillment</label>
                <select
                  id="fulfillment"
                  className="form-select"
                  value={fulfillment}
                  onChange={(e) => setFulfillment(e.target.value)}
                >
                  <option value="PICKUP">Pickup</option>
                  <option value="DELIVERY">Delivery</option>
                </select>
              </div>

              <div className="col">
                <label htmlFor="source">Source</label>
                <select
                  id="source"
                  className="form-select"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                >
                  <option value="WALK_IN">Walk-in</option>
                  <option value="SMS">SMS</option>
                </select>
              </div>
            </div>

            {fulfillment === "DELIVERY" && (
              <>
                <label htmlFor="address" className="mt-3">
                  Delivery address
                </label>
                <textarea
                  id="address"
                  className="form-control"
                  required
                  maxLength={300}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </>
            )}

            <button
              className="btn btn-estylo complete-btn w-100"
              disabled={busy || !cart.length}
            >
              {busy ? "CREATING…" : "CREATE ORDER"}
            </button>

            <button
              type="button"
              className="btn btn-outline-light clear-btn w-100"
              disabled={busy}
              onClick={() => {
                setCart([]);
                changed();
              }}
            >
              Clear cart
            </button>
          </fieldset>
        </form>
      </div>
    </div>
  );
}