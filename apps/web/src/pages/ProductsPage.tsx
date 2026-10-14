
import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";
import { Product, Addon } from "../types";

function MaintenanceRow({
  row,
  kind,
  onSave,
}: {
  row: Product | Addon;
  kind: string;
  onSave: () => Promise<void>;
}) {
  const [name, setName] = useState(row.name);
  const [price, setPrice] = useState(
    row.priceCentavos == null
      ? ""
      : String(row.priceCentavos / 100),
  );
  const [active, setActive] = useState(row.active);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");

    try {
      if (
        !name.trim() ||
        (price !== "" &&
          (!Number.isFinite(Number(price)) ||
            Number(price) <= 0 ||
            Number(price) > 10000)) ||
        (kind === "addons" && price === "")
      ) {
        throw Error("Name and valid price required");
      }

      await api("/" + kind + "/" + row.id, {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          priceCentavos:
            price === ""
              ? null
              : Math.round(Number(price) * 100),
          active,
        }),
      });

      await onSave();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Save failed",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <td>
        <input
          aria-label={row.name + " name"}
          className="form-control"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </td>
      <td>
        <input
          aria-label={row.name + " price"}
          className="form-control"
          type="number"
          step=".01"
          min=".01"
          max="10000"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </td>
      <td>
        <input
          aria-label={row.name + " available"}
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
      </td>
      <td>
        <button
          type="button"
          className="btn btn-estylo"
          disabled={busy}
          onClick={save}
        >
          {busy ? "Saving..." : "Save"}
        </button>
        {error && (
          <div role="alert" className="text-danger">
            {error}
          </div>
        )}
      </td>
    </tr>
  );
}

export function ProductsPage() {
  const [tab, setTab] = useState("products");
  const [drinks, setDrinks] = useState<Product[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [newActive, setNewActive] = useState(true);

  async function load() {
    const [p, a] = await Promise.all([
      api<Product[]>("/products"),
      api<Addon[]>("/addons"),
    ]);

    setDrinks(p);
    setAddons(a);
  }

  useEffect(() => {
    load().catch((e) =>
      setError(
        e instanceof Error
          ? e.message
          : "Failed to load menu",
      ),
    );
  }, []);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const form = e.currentTarget;
    const d = Object.fromEntries(new FormData(form));

    const name = String(d.name ?? "").trim();
    const price = Number(d.price);
    const isDrink = tab === "products";

    setError("");
    setSuccess("");

    if (!name || name.length > 100) {
      setError("Please enter a valid name.");
      return;
    }

    if (
      !Number.isFinite(price) ||
      price <= 0 ||
      price > 10000 ||
      !Number.isInteger(Math.round(price * 100))
    ) {
      setError(
        "Enter a valid price between ₱0.01 and ₱10,000.",
      );
      return;
    }

    setBusy(true);

    try {
      await api(isDrink ? "/products" : "/addons", {
        method: "POST",
        body: JSON.stringify({
          name,
          priceCentavos: Math.round(price * 100),
          active: isDrink ? newActive : true,
        }),
      });

      await load();

      form.reset();
      setNewActive(true);

      setSuccess(
        isDrink
          ? `Drink "${name}" added successfully.`
          : `Add-on "${name}" added successfully.`,
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Failed to add item",
      );
    } finally {
      setBusy(false);
    }
  }

  const rows = tab === "products" ? drinks : addons;

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Menu maintenance</h1>
          <p>
            Saved orders retain their original drink
            and add-on prices.
          </p>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Menu maintenance"
        className="d-flex gap-2 mb-4"
      >
        {[
          ["products", "Drinks Maintenance"],
          ["addons", "Add-On Maintenance"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={
              "btn " +
              (tab === key
                ? "btn-estylo"
                : "btn-outline-secondary")
            }
            onClick={() => {
              setTab(key);
              setError("");
              setSuccess("");
              setNewActive(true);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          className="alert alert-danger"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="alert alert-success"
        >
          {success}
        </div>
      )}

      {/* Create Drink / Add-on */}
      <form
        key={tab}
        className="card-estylo mb-4"
        onSubmit={create}
      >
        <h2 className="h5 mb-3">
          {tab === "products"
            ? "Add New Drink"
            : "Add New Add-On"}
        </h2>

        <div className="d-flex gap-3 flex-wrap align-items-end">
          <label>
            Name
            <input
              name="name"
              className="form-control"
              required
              maxLength={100}
              placeholder={
                tab === "products"
                  ? "e.g. Matcha Latte"
                  : "e.g. Extra coffee shot"
              }
            />
          </label>

          <label>
            Price (PHP)
            <input
              name="price"
              className="form-control"
              type="number"
              min=".01"
              max="10000"
              step=".01"
              required
              placeholder="0.00"
            />
          </label>

          {tab === "products" && (
            <label className="d-flex align-items-center gap-2 pb-2">
              <input
                type="checkbox"
                checked={newActive}
                onChange={(e) =>
                  setNewActive(e.target.checked)
                }
              />
              Available
            </label>
          )}

          <button
            type="submit"
            disabled={busy}
            className="btn btn-estylo"
          >
            {busy
              ? "Adding..."
              : tab === "products"
                ? "Add Drink"
                : "Add Add-On"}
          </button>
        </div>
      </form>

      {/* Active / Inactive entries */}
      {[true, false].map((available) => (
        <section
          key={String(available)}
          className="card-estylo mb-4"
          role="tabpanel"
        >
          <h2 className="h5">
            {available ? "Active" : "Inactive"}{" "}
            {tab === "products" ? "drinks" : "add-ons"}
          </h2>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Price (PHP)</th>
                  <th>Available</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {rows
                  .filter((r) => r.active === available)
                  .map((row) => (
                    <MaintenanceRow
                      key={
                        tab +
                        row.id +
                        row.priceCentavos +
                        row.name +
                        row.active
                      }
                      row={row}
                      kind={tab}
                      onSave={load}
                    />
                  ))}
              </tbody>
            </table>

            {!rows.some(
              (r) => r.active === available,
            ) && (
              <p className="empty">
                No{" "}
                {available ? "active" : "inactive"}{" "}
                entries.
              </p>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
