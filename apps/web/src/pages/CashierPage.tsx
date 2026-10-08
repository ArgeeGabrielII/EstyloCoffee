import { FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, money } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Product, Addon } from "../types";

function key() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
}

export function CashierPage() {
  const { user, logout } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [selections, setSelections] = useState<
    Record<string, Record<string, number>>
  >({});
  const [cart, setCart] = useState<Record<string, number>>({});
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
    api<Addon[]>("/addons")
      .then(setAddons)
      .catch((e) => setError(e.message));

    api<Product[]>("/products")
      .then(setProducts)
      .catch((e) => setError(e.message));
  }, []);

  const lines = products.filter((p) => cart[p.id]);

  const total = lines.reduce(
    (s, p) =>
      s +
      ((p.priceCentavos || 0) +
        addons.reduce(
          (sum, a) =>
            sum + a.priceCentavos * (selections[p.id]?.[a.id] || 0),
          0,
        )) *
        cart[p.id],
    0,
  );

  function changed() {
    requestKey.current = "";
    setSuccess("");
  }

  function quantity(id: string, d: number) {
    if (d < 0 && cart[id] === 1) {
      setSelections((old) => {
        const next = { ...old };
        delete next[id];
        return next;
      });
    }

    changed();

    setCart((old) => {
      const next = { ...old };
      next[id] = Math.max(0, Math.min(99, (next[id] || 0) + d));
      if (!next[id]) delete next[id];
      return next;
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();

    if (busy) return;

    if (!lines.length) {
      setError("Select at least one drink");
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
          items: lines.map((p) => ({
            productId: p.id,
            quantity: cart[p.id],
            addons: Object.entries(selections[p.id] || {})
              .filter(([, n]) => n > 0)
              .map(([addonId, quantity]) => ({ addonId, quantity })),
          })),
        }),
      });

      setSuccess(result.id);
      setCart({});
      setSelections({});
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

          <div className="product-grid">
            {products
              .filter((p) => p.active)
              .map((p) => (
                <button
                  disabled={busy || !p.priceCentavos}
                  className="tile"
                  key={p.id}
                  onClick={() => quantity(p.id, 1)}
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

          {!products.length && (
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
            {lines.length ? (
              lines.map((p) => (
                <div key={p.id}>
                  <div className="sale-line">
                    <div>
                      {p.name}
                      <small>
                        {money(p.priceCentavos || 0)} each
                      </small>
                    </div>

                    <div className="line-actions">
                      <button
                        type="button"
                        className="qty-btn"
                        disabled={busy}
                        aria-label={"Remove one " + p.name}
                        onClick={() => quantity(p.id, -1)}
                      >
                        −
                      </button>

                      {cart[p.id]}

                      <button
                        type="button"
                        className="qty-btn"
                        disabled={busy}
                        aria-label={"Add one " + p.name}
                        onClick={() => quantity(p.id, 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="mb-3">
                    <small>
                      Add-ons per cup (applies to all {cart[p.id]} cups)
                    </small>

                    {addons
                      .filter((a) => a.active)
                      .map((a) => (
                        <label
                          key={a.id}
                          className="d-flex justify-content-between align-items-center gap-2 mt-2"
                        >
                          {a.name} ({money(a.priceCentavos)})

                          <input
                            style={{ width: 80 }}
                            aria-label={
                              p.name +
                              " " +
                              a.name +
                              " quantity per cup"
                            }
                            className="form-control"
                            type="number"
                            min="0"
                            max="99"
                            step="1"
                            disabled={busy}
                            value={selections[p.id]?.[a.id] || 0}
                            onChange={(e) => {
                              changed();
                              setSelections((old) => ({
                                ...old,
                                [p.id]: {
                                  ...old[p.id],
                                  [a.id]: Math.min(
                                    99,
                                    Math.max(
                                      0,
                                      Math.floor(
                                        Number(e.target.value) || 0,
                                      ),
                                    ),
                                  ),
                                },
                              }));
                            }}
                          />
                        </label>
                      ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="empty">Select drinks to begin.</p>
            )}
          </div>

          <fieldset disabled={busy}>
            <div className="totals">
              <div className="total-row grand-total">
                <span>Total</span>
                <span>{money(total)}</span>
              </div>
            </div>

            <label
              className="form-label mt-3"
              htmlFor="customer"
            >
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
              required={
                source === "SMS" || fulfillment === "DELIVERY"
              }
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
              disabled={busy || !lines.length}
            >
              {busy ? "CREATING…" : "CREATE ORDER"}
            </button>

            <button
              type="button"
              className="btn btn-outline-light clear-btn w-100"
              disabled={busy}
              onClick={() => {
                setCart({});
                setSelections({});
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