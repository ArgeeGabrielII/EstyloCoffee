import { useState } from "react";
import { Link } from "react-router-dom";
import { api, money } from "../api/client";
import { Order, Status } from "../types";
import { useAutoRefresh } from "../hooks/useAutoRefresh";

const groups: {
  status: Status;
  label: string;
  color: string;
}[] = [
  { status: "NEW", label: "New orders", color: "#f0c75e" },
  { status: "PREPARING", label: "Preparing", color: "#79b8ff" },
  { status: "READY", label: "Ready for pickup", color: "#73d49b" },
  { status: "COMPLETED", label: "Completed", color: "#aaaaaa" },
  { status: "CANCELLED", label: "Cancelled", color: "#ef8f8f" },
];

const nextSteps: Record<Status, Status[]> = {
  NEW: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

const actionLabels: Record<Status, string> = {
  NEW: "New",
  PREPARING: "Start preparing",
  READY: "Mark ready",
  COMPLETED: "Complete order",
  CANCELLED: "Cancel order",
};

export function OrdersPage() {
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const [expanded, setExpanded] = useState<Record<Status, boolean>>({
    NEW: true,
    PREPARING: true,
    READY: true,
    COMPLETED: false,
    CANCELLED: false,
  });

  const {
    data: orders,
    error,
    loading,
    updatedAt,
  } = useAutoRefresh<Order[]>("/queue/staff", [], revision);

  async function update(order: Order, patch: object) {
    if (busy) return;

    setBusy(true);
    setActionError("");

    try {
      await api("/orders/" + order.id, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });

      setRevision((old) => old + 1);
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : "Unable to update order.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Cashier & Barista Orders</h1>
          <p>Orders update automatically every 3 seconds.</p>
        </div>

        <Link
          to="/queue"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-estylo"
        >
          Open public display
        </Link>
      </div>

      {(error || actionError) && (
        <div role="alert" className="alert alert-danger">
          {actionError || error}
        </div>
      )}

      <p className="small text-secondary">
        {loading
          ? "Loading orders…"
          : updatedAt
            ? `Last updated: ${updatedAt.toLocaleTimeString()}`
            : "Waiting for connection…"}
      </p>

      {groups.map((group) => {
        const rows = orders.filter(
          (order) => order.status === group.status,
        );

        const isExpanded = expanded[group.status];
        const panelId = `orders-${group.status}`;

        return (
          <section key={group.status} className="card-estylo mb-3">
            <h2 className="h5 mb-0">
              <button
                type="button"
                aria-expanded={isExpanded}
                aria-controls={panelId}
                className="btn w-100 d-flex justify-content-between align-items-center text-start"
                style={{ color: group.color, minHeight: 48 }}
                onClick={() =>
                  setExpanded((old) => ({
                    ...old,
                    [group.status]: !old[group.status],
                  }))
                }
              >
                <span>
                  {group.label}{" "}
                  <span className="badge text-bg-secondary ms-2">
                    {rows.length}
                  </span>
                </span>
                <span aria-hidden="true">
                  {isExpanded ? "▾" : "▸"}
                </span>
              </button>
            </h2>

            <div id={panelId} hidden={!isExpanded}>
              {(group.status === "COMPLETED" ||
                group.status === "CANCELLED") && (
                <p className="small text-secondary mt-3">
                  From the latest 50 completed/cancelled orders.
                </p>
              )}

              {!rows.length ? (
                <p className="empty mt-3">No orders in this section.</p>
              ) : (
                <div className="order-grid mt-3">
                  {rows.map((order) => {
                    const cups = order.items.flatMap((item) =>
                      Array.from(
                        { length: item.quantity },
                        (_, index) => ({
                          key: `${item.id}-${index}`,
                          item,
                        }),
                      ),
                    );

                    return (
                      <article className="card-estylo" key={order.id}>
                        <small>
                          {order.id.slice(0, 8)} ·{" "}
                          {new Date(order.createdAt).toLocaleString()}
                        </small>

                        <h3 className="mt-2">{order.customer}</h3>

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
                          {order.fulfillment} ·{" "}
                          {order.source.replace("_", " ")}
                          {order.phone && (
                            <>
                              <br />
                              {order.phone}
                            </>
                          )}
                          {order.address && (
                            <>
                              <br />
                              {order.address}
                            </>
                          )}
                        </p>

                        {cups.map(({ key, item }, index) => {
                          const cupTotal =
                            item.unitPriceCentavos +
                            (item.addons || []).reduce(
                              (sum, addon) =>
                                sum +
                                addon.quantity *
                                  addon.unitPriceCentavos,
                              0,
                            );

                          return (
                            <div
                              key={key}
                              className="mb-3 pb-2 border-bottom"
                            >
                              <strong>
                                Cup {index + 1} — {item.name}
                              </strong>

                              <small className="d-block">
                                Base: {money(item.unitPriceCentavos)}
                              </small>

                              {item.addons?.map((addon) => (
                                <small
                                  className="d-block"
                                  key={addon.id}
                                >
                                  + {addon.name}: {addon.quantity} ×{" "}
                                  {money(addon.unitPriceCentavos)}
                                </small>
                              ))}

                              <small className="d-block fw-bold mt-1">
                                Cup total: {money(cupTotal)}
                              </small>
                            </div>
                          );
                        })}

                        <strong className="d-block mt-3">
                          Total: {money(order.totalCentavos)}
                        </strong>

                        <div className="d-flex gap-2 flex-wrap mt-3">
                          {order.payment === "UNPAID" &&
                            order.status !== "CANCELLED" && (
                              <button
                                disabled={busy}
                                className="btn btn-estylo"
                                onClick={() =>
                                  update(order, { payment: "PAID" })
                                }
                              >
                                Mark paid
                              </button>
                            )}

                          {nextSteps[order.status].map((status) => (
                            <button
                              key={status}
                              className="btn btn-outline-secondary"
                              disabled={
                                busy ||
                                (status === "COMPLETED" &&
                                  order.payment !== "PAID") ||
                                (status === "CANCELLED" &&
                                  order.payment === "PAID")
                              }
                              onClick={() =>
                                update(order, { status })
                              }
                            >
                              {actionLabels[status]}
                            </button>
                          ))}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}