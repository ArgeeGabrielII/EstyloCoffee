
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

  const [addonModalLineId, setAddonModalLineId] = useState<string | null>(null);
  const [addonDraft, setAddonDraft] = useState<Record<string, number>>({});

  const requestKey = useRef("");

  const activeAddons = addons.filter((addon) => addon.active);

  const editingLine = cart.find(
    (line) => line.id === addonModalLineId
  );

  const editingProduct = products.find(
    (product) => product.id === editingLine?.productId
  );

  useEffect(() => {
    Promise.all([
      api<Product[]>("/products"),
      api<Addon[]>("/addons"),
    ])
      .then(([drinks, extras]) => {
        setProducts(drinks);
        setAddons(extras);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Unable to load menu.");
      });
  }, []);

  useEffect(() => {
    if (!addonModalLineId) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAddonModalLineId(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [addonModalLineId]);

  function changed() {
    requestKey.current = "";
    setSuccess("");
  }

  function lineTotal(line: CartLine) {
    const product = products.find(
      (p) => p.id === line.productId
    );

    const basePrice = product?.priceCentavos || 0;

    const addonPrice = addons.reduce(
      (sum, addon) =>
        sum +
        addon.priceCentavos * (line.addons[addon.id] || 0),
      0
    );

    return basePrice + addonPrice;
  }

  const total = cart.reduce(
    (sum, line) => sum + lineTotal(line),
    0
  );

  const totalCupCount = cart.length;

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
      {
        id: key(),
        productId,
        addons: {},
      },
    ]);
  }

  function removeCup(lineId: string) {
    if (busy) return;

    changed();

    setCart((old) =>
      old.filter((line) => line.id !== lineId)
    );
  }

  function openAddonModal(line: CartLine) {
    if (busy || !activeAddons.length) return;

    setAddonDraft({ ...line.addons });
    setAddonModalLineId(line.id);
  }

  function updateAddonQuantity(
    addonId: string,
    change: number
  ) {
    setAddonDraft((old) => {
      const currentQuantity = old[addonId] || 0;

      const newQuantity = Math.min(
        99,
        Math.max(0, currentQuantity + change)
      );

      return {
        ...old,
        [addonId]: newQuantity,
      };
    });
  }

  function saveAddonChanges() {
    if (!addonModalLineId || busy) return;

    changed();

    setCart((old) =>
      old.map((line) =>
        line.id === addonModalLineId
          ? {
              ...line,
              addons: { ...addonDraft },
            }
          : line
      )
    );

    setAddonModalLineId(null);
  }

  function closeAddonModal() {
    setAddonModalLineId(null);
  }

  const draftAddonTotal = addons.reduce(
    (sum, addon) =>
      sum +
      addon.priceCentavos * (addonDraft[addon.id] || 0),
    0
  );

  const editingCupTotal =
    (editingProduct?.priceCentavos || 0) +
    draftAddonTotal;

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
        headers: {
          "Idempotency-Key": requestKey.current,
        },
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
      setAddonModalLineId(null);
      setAddonDraft({});
      requestKey.current = "";
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Order failed"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pos">
      <header className="pos-header">
        <div className="pos-brand">
          <img
            src="/estylo-logo.png"
            alt="Estylo Coffee"
          />

          <div>
            <b>ESTYLO COFFEE</b>
            <small className="d-block">
              Cashier workspace
            </small>
          </div>
        </div>

        <div className="pos-user">
          <span>{user?.displayName}</span>

          <div>
            <Link
              className="text-warning me-3"
              to={
                user?.role === "ADMIN"
                  ? "/dashboard"
                  : "/orders"
              }
            >
              Management
            </Link>

            <button
              type="button"
              className="btn btn-sm btn-outline-light"
              onClick={() =>
                logout().catch((e) =>
                  setError(e.message)
                )
              }
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="alert alert-danger m-3"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="alert alert-success m-3"
        >
          Order {success.slice(0, 8)} created.{" "}
          <Link to="/orders">
            Open order board
          </Link>
        </div>
      )}

      <div className="pos-grid">
        {/* LEFT SIDE - COFFEE MENU */}

        <section className="pos-left">
          <div className="section-label">
            COFFEE MENU
          </div>

          <h2 className="mb-4">
            Make someone's day.
          </h2>

          <p>
            Tap a drink to add one separately
            customizable cup.
          </p>

          <div className="product-grid">
            {products
              .filter((p) => p.active)
              .map((p) => (
                <button
                  type="button"
                  disabled={
                    busy || !p.priceCentavos
                  }
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
            <p className="empty">
              No menu available.
            </p>
          )}
        </section>

        {/* RIGHT SIDE - CURRENT ORDER */}

        <form
          className="pos-right"
          onSubmit={submit}
          onChange={changed}
        >
          <h4>Current order</h4>

          <div className="sale-lines">
            {!cart.length ? (
              <p className="empty">
                Select drinks to begin.
              </p>
            ) : (
              cart.map((line, index) => {
                const product = products.find(
                  (p) =>
                    p.id === line.productId
                );

                const selectedAddons =
                  activeAddons.filter(
                    (addon) =>
                      (line.addons[addon.id] || 0) > 0
                  );

                const selectedAddonCount =
                  selectedAddons.reduce(
                    (sum, addon) =>
                      sum +
                      (line.addons[addon.id] || 0),
                    0
                  );

                const addonSummary =
                  selectedAddons
                    .map(
                      (addon) =>
                        `${addon.name} × ${
                          line.addons[addon.id]
                        }`
                    )
                    .join(" · ");

                return (
                  <div
                    key={line.id}
                    className="sale-item"
                  >
                    <div className="sale-line">
                      <div className="sale-item-main">
                        <strong>
                          Cup {index + 1} —{" "}
                          {product?.name}
                        </strong>

                        <small>
                          Base price:{" "}
                          {money(
                            product?.priceCentavos || 0
                          )}
                        </small>
                      </div>

                      <div className="sale-item-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-warning addon-open-btn"
                          disabled={
                            busy ||
                            !activeAddons.length
                          }
                          onClick={() =>
                            openAddonModal(line)
                          }
                          aria-label={`Add-ons for cup ${
                            index + 1
                          }`}
                        >
                          Add-ons

                          {selectedAddonCount > 0 && (
                            <span className="addon-count">
                              {selectedAddonCount}
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          disabled={busy}
                          onClick={() =>
                            removeCup(line.id)
                          }
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <small className="addon-summary">
                      {addonSummary ||
                        "No add-ons selected"}
                    </small>

                    <div className="sale-item-footer">
                      <strong>
                        Cup total:{" "}
                        {money(lineTotal(line))}
                      </strong>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <fieldset disabled={busy}>
            {/* ORDER TOTALS */}

            <div className="totals">
              <div className="total-row cup-count-row">
                <span>Total Cup Count</span>
                <strong>
                  {totalCupCount}
                </strong>
              </div>

              <div className="total-row grand-total">
                <span>Total Amount</span>
                <span>
                  {money(total)}
                </span>
              </div>
            </div>

            {/* CUSTOMER DETAILS */}

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
              onChange={(e) =>
                setCustomer(e.target.value)
              }
            />

            <label
              className="form-label mt-3"
              htmlFor="phone"
            >
              Phone
            </label>

            <input
              id="phone"
              type="tel"
              className="form-control"
              maxLength={30}
              required={
                source === "SMS" ||
                fulfillment === "DELIVERY"
              }
              value={phone}
              onChange={(e) =>
                setPhone(e.target.value)
              }
            />

            <div className="row mt-3">
              <div className="col">
                <label htmlFor="fulfillment">
                  Fulfillment
                </label>

                <select
                  id="fulfillment"
                  className="form-select"
                  value={fulfillment}
                  onChange={(e) =>
                    setFulfillment(
                      e.target.value
                    )
                  }
                >
                  <option value="PICKUP">
                    Pickup
                  </option>

                  <option value="DELIVERY">
                    Delivery
                  </option>
                </select>
              </div>

              <div className="col">
                <label htmlFor="source">
                  Source
                </label>

                <select
                  id="source"
                  className="form-select"
                  value={source}
                  onChange={(e) =>
                    setSource(e.target.value)
                  }
                >
                  <option value="WALK_IN">
                    Walk-in
                  </option>

                  <option value="SMS">
                    SMS
                  </option>
                </select>
              </div>
            </div>

            {fulfillment === "DELIVERY" && (
              <>
                <label
                  htmlFor="address"
                  className="mt-3"
                >
                  Delivery address
                </label>

                <textarea
                  id="address"
                  className="form-control"
                  required
                  maxLength={300}
                  value={address}
                  onChange={(e) =>
                    setAddress(e.target.value)
                  }
                />
              </>
            )}

            {/* ORDER ACTIONS */}

            <button
              type="submit"
              className="btn btn-estylo complete-btn w-100"
              disabled={
                busy || !cart.length
              }
            >
              {busy
                ? "CREATING…"
                : "CREATE ORDER"}
            </button>

            <button
              type="button"
              className="btn btn-outline-light clear-btn w-100"
              disabled={busy}
              onClick={() => {
                setCart([]);
                setAddonModalLineId(null);
                setAddonDraft({});
                changed();
              }}
            >
              Clear cart
            </button>
          </fieldset>
        </form>
      </div>

      {/* ADD-ONS MODAL */}

      {addonModalLineId && editingLine && (
        <div
          className="addon-modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeAddonModal();
            }
          }}
        >
          <section
            className="addon-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="addon-modal-title"
          >
            {/* MODAL HEADER */}

            <header className="addon-modal-header">
              <div>
                <h4 id="addon-modal-title">
                  Add-ons for Cup{" "}
                  {cart.findIndex(
                    (line) =>
                      line.id === editingLine.id
                  ) + 1}
                </h4>

                <p>
                  {editingProduct?.name}
                  {" · "}
                  Tap + or − to adjust add-ons.
                </p>
              </div>

              <button
                type="button"
                className="addon-modal-close"
                aria-label="Close add-ons"
                onClick={closeAddonModal}
              >
                ×
              </button>
            </header>

            {/* ADD-ONS LIST */}

            <div className="addon-modal-list">
              {activeAddons.map((addon) => {
                const quantity =
                  addonDraft[addon.id] || 0;

                return (
                  <div
                    key={addon.id}
                    className="addon-option"
                  >
                    <div className="addon-option-info">
                      <span className="addon-option-name">
                        {addon.name}
                      </span>

                      <span className="addon-option-price">
                        {money(
                          addon.priceCentavos
                        )}{" "}
                        each
                      </span>
                    </div>

                    {/* IPAD TAP CONTROLS */}

                    <div className="addon-quantity-controls">
                      <button
                        type="button"
                        className="addon-qty-btn"
                        disabled={
                          busy || quantity === 0
                        }
                        aria-label={`Remove one ${addon.name}`}
                        onClick={() =>
                          updateAddonQuantity(
                            addon.id,
                            -1
                          )
                        }
                      >
                        −
                      </button>

                      <span className="addon-qty-value">
                        {quantity}
                      </span>

                      <button
                        type="button"
                        className="addon-qty-btn"
                        disabled={
                          busy || quantity >= 99
                        }
                        aria-label={`Add one ${addon.name}`}
                        onClick={() =>
                          updateAddonQuantity(
                            addon.id,
                            1
                          )
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* MODAL FOOTER */}

            <footer className="addon-modal-footer">
              <div className="addon-modal-total">
                <span>Cup total</span>

                <strong>
                  {money(editingCupTotal)}
                </strong>
              </div>

              <div className="addon-modal-actions">
                <button
                  type="button"
                  className="btn btn-outline-light"
                  onClick={closeAddonModal}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="btn btn-estylo"
                  disabled={busy}
                  onClick={saveAddonChanges}
                >
                  Save add-ons
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
