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

  async function update(order: Order, patch: object) {
    setBusy(true);
    setError("");

    try {
      await api("/orders/" + order.id, {
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
          onClick={() => load().catch((e) => setError(e.message))}
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
        {Object.keys(steps).map((status) => (
          <option key={status}>{status}</option>
        ))}
      </select>

      <div className="order-grid">
        {rows
          .filter((order) => filter === "ALL" || order.status === filter)
          .map((order) => {
            const cups = order.items.flatMap((item) =>
              Array.from({ length: item.quantity }, (_, index) => ({
                key: `${item.id}-${index}`,
                item,
              })),
            );

            return (
              <article className="card-estylo" key={order.id}>
                <small>
                  {order.id.slice(0, 8)} ·{" "}
                  {new Date(order.createdAt).toLocaleString()}
                </small>

                <h3 className="mt-2">{order.customer}</h3>

                <span className="badge text-bg-secondary">
                  {order.status}
                </span>{" "}
                <span
                  className={
                    "badge " +
                    (order.payment === "PAID"
                      ? "text-bg-success"
                      : "text-bg-warning")
                  }
                >
                  {order.payment}
                </span>

                <p className="mt-2">
                  {order.fulfillment} · {order.source.replace("_", " ")}
                  <br />
                  {order.phone}
                  <br />
                  {order.address}
                </p>

                {cups.map(({ key, item }, index) => {
                  const cupTotal =
                    item.unitPriceCentavos +
                    (item.addons || []).reduce(
                      (sum, addon) =>
                        sum + addon.quantity * addon.unitPriceCentavos,
                      0,
                    );

                  return (
                    <div key={key} className="mb-3 pb-2 border-bottom">
                      <strong>
                        Cup {index + 1} — {item.name}
                      </strong>
                      <small className="d-block">
                        Base price: {money(item.unitPriceCentavos)}
                      </small>

                      {item.addons?.map((addon) => (
                        <small className="d-block" key={addon.id}>
                          + {addon.name}: {addon.quantity}{" "}
                          × {money(addon.unitPriceCentavos)}
                        </small>
                      ))}

                      <small className="d-block fw-bold mt-1">
                        Cup total: {money(cupTotal)}
                      </small>
                    </div>
                  );
                })}

                <strong className="d-block mt-3">
                  Order total: {money(order.totalCentavos)}
                </strong>

                <div className="d-flex gap-2 flex-wrap mt-3">
                  {order.payment === "UNPAID" &&
                    order.status !== "CANCELLED" && (
                      <button
                        disabled={busy}
                        className="btn btn-estylo"
                        onClick={() => update(order, { payment: "PAID" })}
                      >
                        Mark paid
                      </button>
                    )}

                  {steps[order.status].map((status) => (
                    <button
                      className="btn btn-outline-secondary"
                      disabled={
                        busy ||
                        (status === "COMPLETED" &&
                          order.payment !== "PAID") ||
                        (status === "CANCELLED" &&
                          order.payment === "PAID")
                      }
                      key={status}
                      onClick={() => update(order, { status })}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </article>
            );
          })}
      </div>

      {!rows.length && <p className="empty">No orders yet.</p>}

      <div className="d-flex gap-3 align-items-center mt-4">
        <button
          className="btn btn-outline-secondary"
          disabled={busy || page <= 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>
        <span>
          Page {page} · {total} orders
        </span>
        <button
          className="btn btn-outline-secondary"
          disabled={busy || page * 50 >= total}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}