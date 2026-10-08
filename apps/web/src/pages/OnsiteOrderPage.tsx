
import { FormEvent, useEffect, useRef, useState } from "react";
import { api, money } from "../api/client";
import type { Product, Addon } from "../types";

type CartLine = {
  id: string;
  productId: string;
  addons: Record<string, number>;
};

type MenuResponse = {
  products: Product[];
  addons: Addon[];
};

type Receipt = {
  id: string;
  customer: string;
  totalCentavos: number;
  status: string;
  payment: string;
  items: {
    name: string;
    quantity: number;
    unitPriceCentavos: number;
    addons: {
      name: string;
      quantity: number;
      unitPriceCentavos: number;
    }[];
  }[];
};

function newKey() {
  return crypto.randomUUID();
}

export function OnsiteOrderPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestKey = useRef("");

  useEffect(() => {
    let active = true;

    async function loadMenu() {
      try {
        const data = await api<MenuResponse>("/onsite/menu");
        if (active) {
          setProducts(data.products);
          setAddons(data.addons);
        }
      } catch (e) {
        if (active) {
          setError(
            e instanceof Error ? e.message : "Unable to load menu"
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadMenu();
    return () => { active = false; };
  }, []);

  function changed() {
    requestKey.current = "";
    setError("");
  }

  function cupTotal(line: CartLine) {
    const product = products.find(
      (p) => p.id === line.productId
    );

    const base = product?.priceCentavos ?? 0;

    const extras = addons.reduce(
      (sum, addon) =>
        sum +
        addon.priceCentavos * (line.addons[addon.id] ?? 0),
      0
    );

    return base + extras;
  }

  const total = cart.reduce(
    (sum, line) => sum + cupTotal(line),
    0
  );

  function addCup(productId: string) {
    if (busy) return;

    if (cart.length >= 50) {
      setError("Maximum of 50 cups per order.");
      return;
    }

    changed();
    setCart((previous) => [
      ...previous,
      {
        id: newKey(),
        productId,
        addons: {},
      },
    ]);
  }

  function removeCup(id: string) {
    changed();
    setCart((previous) =>
      previous.filter((line) => line.id !== id)
    );
  }

  function updateAddon(
    lineId: string,
    addonId: string,
    quantity: number
  ) {
    changed();

    const safeQuantity = Math.min(
      99,
      Math.max(0, Math.floor(Number(quantity) || 0))
    );

    setCart((previous) =>
      previous.map((line) =>
        line.id === lineId
          ? {
              ...line,
              addons: {
                ...line.addons,
                [addonId]: safeQuantity,
              },
            }
          : line
      )
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (busy || receipt) return;

    if (!customer.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (!cart.length) {
      setError("Please select at least one coffee.");
      return;
    }

    const confirmed = window.confirm(
      `Place ${cart.length} cup(s) for ${money(total)}?\n\n` +
      "Please pay at the cashier."
    );

    if (!confirmed) return;

    setBusy(true);
    setError("");

    if (!requestKey.current) {
      requestKey.current = newKey();
    }

    try {
      const result = await api<Receipt>("/onsite/orders", {
        method: "POST",
        headers: {
          "Idempotency-Key": requestKey.current,
        },
        body: JSON.stringify({
          customer: customer.trim(),
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

      setReceipt(result);
      setCart([]);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to place order"
      );
    } finally {
      setBusy(false);
    }
  }

  function newOrder() {
    setReceipt(null);
    setCart([]);
    setCustomer("");
    requestKey.current = "";
    setError("");
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#121212",
        color: "#fff",
      }}
    >
      <header
        style={{
          background: "#1d1d1d",
          borderBottom: "1px solid #444",
          padding: "20px 24px",
          textAlign: "center",
        }}
      >
        <img
          src="/estylo-logo.png"
          alt="Estylo Coffee"
          style={{
            width: 76,
            height: 76,
            objectFit: "contain",
          }}
        />
        <h2 className="mt-2 mb-1">ESTYLO COFFEE</h2>
        <p style={{ color: "#d7bd76", margin: 0 }}>
          Onsite Ordering
        </p>
      </header>

      <main
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "24px 16px 64px",
        }}
      >
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        {receipt ? (
          <section
            className="card p-4 mx-auto"
            style={{
              maxWidth: 580,
              background: "#222",
              color: "#fff",
              border: "1px solid #555",
            }}
          >
            <div className="text-center">
              <div style={{ fontSize: 42 }}>☕</div>
              <h2>Order Received!</h2>
              <p>
                Thank you, <strong>{receipt.customer}</strong>.
              </p>
              <p style={{ color: "#d7bd76" }}>
                Please proceed to the cashier for payment.
              </p>
            </div>

            <hr />

            <div className="mb-3">
              <small>ORDER REFERENCE</small>
              <h3>{receipt.id.slice(0, 8).toUpperCase()}</h3>
            </div>

            {receipt.items.map((item, index) => {
              const extras = item.addons.reduce(
                (sum, addon) =>
                  sum +
                  addon.quantity * addon.unitPriceCentavos,
                0
              );

              return (
                <div key={index} className="mb-3">
                  <div className="d-flex justify-content-between">
                    <strong>
                      {item.quantity} × {item.name}
                    </strong>
                    <span>
                      {money(
                        item.quantity *
                        (item.unitPriceCentavos + extras)
                      )}
                    </span>
                  </div>
                  {item.addons.map((addon, i) => (
                    <small
                      key={i}
                      className="d-block text-secondary"
                    >
                      + {addon.name} × {addon.quantity}
                    </small>
                  ))}
                </div>
              );
            })}

            <hr />

            <div className="d-flex justify-content-between">
              <h4>Total Amount</h4>
              <h3 style={{ color: "#d7bd76" }}>
                {money(receipt.totalCentavos)}
              </h3>
            </div>

            <p className="mt-3">
              Payment: <strong>UNPAID</strong>
            </p>

            <p className="small text-secondary">
              Keep this screen open or take a screenshot
              of your order reference.
            </p>

            <button
              type="button"
              className="btn btn-warning w-100 mt-3"
              onClick={newOrder}
            >
              Place Another Order
            </button>

            <a
              href="/queue"
              className="btn btn-outline-light w-100 mt-2"
            >
              View Coffee Queue
            </a>
          </section>
        ) : (
          <>
            <div className="mb-4">
              <h2>Order Your Coffee</h2>
              <p style={{ color: "#bbb" }}>
                Choose your drinks, customize each cup,
                and review the total before ordering.
              </p>
            </div>

            <div className="row g-4">
              <section className="col-12 col-lg-7">
                <div
                  className="card p-3"
                  style={{
                    background: "#222",
                    color: "#fff",
                    borderColor: "#444",
                  }}
                >
                  <h4 className="mb-3">Coffee Menu</h4>

                  {loading ? (
                    <p>Loading menu...</p>
                  ) : (
                    <div className="row g-3">
                      {products.map((product) => (
                        <div
                          className="col-6 col-md-4"
                          key={product.id}
                        >
                          <button
                            type="button"
                            className="btn w-100 h-100 text-start"
                            disabled={busy}
                            onClick={() => addCup(product.id)}
                            style={{
                              background: "#303030",
                              color: "#fff",
                              border: "1px solid #575757",
                              minHeight: 125,
                              padding: 16,
                            }}
                          >
                            <strong className="d-block mb-3">
                              {product.name}
                            </strong>

                            <span
                              style={{
                                color: "#d7bd76",
                                fontWeight: 700,
                              }}
                            >
                              {money(product.priceCentavos ?? 0)}
                            </span>

                            <small className="d-block mt-2">
                              + Add cup
                            </small>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {!loading && products.length === 0 && (
                    <p>No coffee available at the moment.</p>
                  )}
                </div>
              </section>

              <section className="col-12 col-lg-5">
                <form
                  onSubmit={submit}
                  className="card p-3"
                  style={{
                    background: "#222",
                    color: "#fff",
                    borderColor: "#444",
                  }}
                >
                  <h4>Your Order</h4>

                  <p style={{ color: "#bbb" }}>
                    {cart.length} cup(s) selected
                  </p>

                  {cart.length === 0 && (
                    <p style={{ color: "#bbb" }}>
                      Tap a coffee from the menu to get started.
                    </p>
                  )}

                  {cart.map((line, index) => {
                    const product = products.find(
                      (p) => p.id === line.productId
                    );

                    return (
                      <div
                        key={line.id}
                        className="py-3"
                        style={{
                          borderBottom: "1px solid #444",
                        }}
                      >
                        <div className="d-flex justify-content-between gap-2">
                          <div>
                            <strong>
                              Cup {index + 1}: {product?.name}
                            </strong>
                            <small
                              className="d-block"
                              style={{ color: "#bbb" }}
                            >
                              {money(product?.priceCentavos ?? 0)}
                            </small>
                          </div>

                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            disabled={busy}
                            onClick={() => removeCup(line.id)}
                          >
                            Remove
                          </button>
                        </div>

                        {addons.length > 0 && (
                          <div className="mt-3">
                            <small
                              style={{ color: "#d7bd76" }}
                            >
                              Customize this cup
                            </small>

                            {addons.map((addon) => (
                              <label
                                key={addon.id}
                                className="d-flex align-items-center justify-content-between gap-2 mt-2"
                              >
                                <span className="small">
                                  {addon.name}
                                  <small
                                    className="d-block"
                                    style={{ color: "#bbb" }}
                                  >
                                    + {money(addon.priceCentavos)}
                                  </small>
                                </span>

                                <input
                                  type="number"
                                  min={0}
                                  max={99}
                                  step={1}
                                  className="form-control"
                                  style={{ width: 75 }}
                                  disabled={busy}
                                  aria-label={`${addon.name} quantity`}
                                  value={line.addons[addon.id] ?? 0}
                                  onChange={(event) =>
                                    updateAddon(
                                      line.id,
                                      addon.id,
                                      Number(event.target.value)
                                    )
                                  }
                                />
                              </label>
                            ))}
                          </div>
                        )}

                        <div className="text-end mt-3">
                          <strong>
                            Cup Total: {money(cupTotal(line))}
                          </strong>
                        </div>
                      </div>
                    );
                  })}

                  <div
                    className="d-flex justify-content-between align-items-center py-4"
                  >
                    <h4 className="mb-0">Total</h4>
                    <h3
                      className="mb-0"
                      style={{ color: "#d7bd76" }}
                    >
                      {money(total)}
                    </h3>
                  </div>

                  <label
                    className="form-label"
                    htmlFor="onsite-customer"
                  >
                    Name for your order
                  </label>

                  <input
                    id="onsite-customer"
                    type="text"
                    required
                    maxLength={100}
                    className="form-control"
                    placeholder="Enter your name"
                    value={customer}
                    disabled={busy}
                    onChange={(e) => {
                      changed();
                      setCustomer(e.target.value);
                    }}
                  />

                  <p
                    className="small mt-3"
                    style={{ color: "#bbb" }}
                  >
                    No phone number or account required.
                    Payment will be handled at the cashier.
                  </p>

                  <button
                    type="submit"
                    disabled={
                      busy || loading || cart.length === 0
                    }
                    className="btn btn-warning btn-lg w-100 mt-2"
                  >
                    {busy
                      ? "Placing Order..."
                      : `Place Order — ${money(total)}`}
                  </button>

                  {cart.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-outline-light mt-2"
                      disabled={busy}
                      onClick={() => {
                        changed();
                        setCart([]);
                      }}
                    >
                      Clear Cart
                    </button>
                  )}
                </form>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
