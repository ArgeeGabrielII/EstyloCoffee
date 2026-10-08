import { useCallback, useEffect, useState } from "react";
import { api, money } from "../api/client";
import { Order, Status } from "../types";

const steps: Record<Status, Status[]> = {
  NEW: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function OrdersPage() {
  const [rows, setRows] = useState<Order[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState("ALL");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const d = await api<{ rows: Order[]; total: number }>(
      "/orders?page=" + page,
    );

    setRows(d.rows);
    setTotal(d.total);
  }, [page]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  async function update(o: Order, patch: object) {
    setBusy(true);
    setError("");

    try {
      await api("/orders/" + o.id, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });

      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Orders</h1>
          <p>Pickup, delivery and preparation</p>
        </div>

        <button
          className="btn btn-estylo"
          disabled={busy}
          onClick={() =>
            load().catch((e) => setError(e.message))
          }
        >
          Refresh
        </button>
      </div>

      {error && (
        <div role="alert" className="alert alert-danger">
          {error}
        </div>
      )}

      <label htmlFor="filter">Filter this page</label>
      <select
        id="filter"
        className="form-select mb-3"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      >
        <option>ALL</option>
        {Object.keys(steps).map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>

      <div className="order-grid">
        {rows
          .filter((o) => filter === "ALL" || o.status === filter)
          .map((o) => (
            <article className="card-estylo" key={o.id}>
              <small>
                {o.id.slice(0, 8)} ·{" "}
                {new Date(o.createdAt).toLocaleString()}
              </small>

              <h3 className="mt-2">{o.customer}</h3>

              <span className="badge text-bg-secondary">
                {o.status}
              </span>{" "}
              <span
                className={
                  "badge " +
                  (o.payment === "PAID"
                    ? "text-bg-success"
                    : "text-bg-warning")
                }
              >
                {o.payment}
              </span>

              <p className="mt-2">
                {o.fulfillment} · {o.source.replace("_", " ")}
                <br />
                {o.phone}
                <br />
                {o.address}
              </p>

              {o.items.map((i) => (
                <div key={i.id}>
                  {i.quantity} × {i.name} —{" "}
                  {money(i.unitPriceCentavos)} each

                  {i.addons?.map((a) => (
                    <small className="d-block" key={a.id}>
                      + {a.quantity} × {a.name} (
                      {money(a.unitPriceCentavos)} each, per cup)
                    </small>
                  ))}
                </div>
              ))}

              <strong className="d-block mt-3">
                {money(o.totalCentavos)}
              </strong>

              <div className="d-flex gap-2 flex-wrap mt-3">
                {o.payment === "UNPAID" &&
                  o.status !== "CANCELLED" && (
                    <button
                      disabled={busy}
                      className="btn btn-estylo"
                      onClick={() =>
                        update(o, { payment: "PAID" })
                      }
                    >
                      Mark paid
                    </button>
                  )}

                {steps[o.status].map((s) => (
                  <button
                    className="btn btn-outline-secondary"
                    disabled={
                      busy ||
                      (s === "COMPLETED" &&
                        o.payment !== "PAID") ||
                      (s === "CANCELLED" &&
                        o.payment === "PAID")
                    }
                    key={s}
                    onClick={() => update(o, { status: s })}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </article>
          ))}
      </div>

      {!rows.length && (
        <p className="empty">No orders yet.</p>
      )}

      <div className="d-flex gap-3 align-items-center mt-4">
        <button
          className="btn btn-outline-secondary"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>

        <span>
          Page {page} · {total} orders
        </span>

        <button
          className="btn btn-outline-secondary"
          disabled={page * 50 >= total}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}