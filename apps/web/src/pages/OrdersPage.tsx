import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, money } from "../api/client";
import { Order, Status } from "../types";
import { useAutoRefresh } from "../hooks/useAutoRefresh";

type PaymentMethod = { id: string; name: string; active: boolean };

const groups: { status: Status; label: string; color: string }[] = [
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
  NEW: "New", PREPARING: "Start preparing", READY: "Mark ready",
  COMPLETED: "Complete order", CANCELLED: "Cancel order",
};

export function OrdersPage() {
  const [revision, setRevision] = useState(0);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [selectedMethod, setSelectedMethod] = useState("");
  const [methodError, setMethodError] = useState("");
  useEffect(() => {
    api<PaymentMethod[]>("/payment-methods")
      .then(setMethods)
      .catch(e => setMethodError(e instanceof Error ? e.message : "Unable to load payment methods"));
  }, [revision]);
  function openPayment(order: Order) {
    setSelectedMethod("");
    setMethodError("");
    setPaymentOrder(order);
  }
  async function confirmPayment() {
    if (!paymentOrder || !selectedMethod || busy) return;
    setBusy(true);
    setMethodError("");
    try {
      await api("/orders/" + paymentOrder.id, {
        method: "PATCH",
        body: JSON.stringify({ payment: "PAID", paymentMethodId: selectedMethod }),
      });
      setPaymentOrder(null);
      setRevision(n => n + 1);
    } catch (e) {
      setMethodError(e instanceof Error ? e.message : "Payment could not be saved");
    } finally {
      setBusy(false);
    }
  }
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [activeTab, setActiveTab] = useState<Status>("NEW");
  const { data: orders, error, loading, updatedAt } = useAutoRefresh<Order[]>("/queue/staff", [], revision);

  async function update(order: Order, patch: object) {
    if (busy) return;
    setBusy(true);
    setActionError("");
    try {
      await api("/orders/" + order.id, { method: "PATCH", body: JSON.stringify(patch) });
      setRevision((old) => old + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Unable to update order.");
    } finally {
      setBusy(false);
    }
  }

  async function voidOrder(order: Order) {
    if (busy || order.status === "CANCELLED") return;
    const warning = order.payment === "PAID"
      ? "This removes the transaction from sales reports but does NOT refund the customer.\n\n" : "";
    if (!window.confirm(`Void transaction ${order.id.slice(0, 8)} for ${money(order.totalCentavos)}?\n\n` +
      warning + "This action cannot be undone.")) return;
    setBusy(true);
    setActionError("");
    try {
      await api("/orders/" + order.id + "/void", { method: "POST" });
      setRevision((old) => old + 1);

    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Unable to void transaction.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-title">
        <div><h1>Cashier &amp; Barista Orders</h1><p>Orders update automatically every 3 seconds.</p></div>
        <Link to="/queue" target="_blank" rel="noopener noreferrer" className="btn btn-estylo">Open public display</Link>
      </div>
      {paymentOrder && (
        <div className="modal d-block" role="dialog" aria-modal="true" aria-labelledby="payment-modal-title"
          style={{ background: "rgba(0,0,0,.65)", zIndex: 2000 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content" style={{ borderRadius: 16 }}>
              <div className="modal-header">
                <h2 className="modal-title fs-5" id="payment-modal-title">Confirm Payment</h2>
                <button type="button" className="btn-close" disabled={busy} aria-label="Close"
                  onClick={() => setPaymentOrder(null)} />
              </div>
              <div className="modal-body">
                <p className="mb-1"><strong>{paymentOrder.customer}</strong>
                  {paymentOrder.queueNumber != null && ` · Queue #${String(paymentOrder.queueNumber).padStart(3,"0")}`}
                </p>
                <p className="fs-4 fw-bold">{money(paymentOrder.totalCentavos)}</p>
                <label className="form-label fw-semibold" htmlFor="payment-method">Mode of Payment</label>
                <select id="payment-method" className="form-select" value={selectedMethod}
                  onChange={e => setSelectedMethod(e.target.value)} disabled={busy}>
                  <option value="">Select payment method</option>
                  {methods.filter(m => m.active).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                {!methods.some(m => m.active) && <p className="text-danger small mt-2">No active payment methods. Contact an administrator.</p>}
                {methodError && <div role="alert" className="alert alert-danger mt-3">{methodError}</div>}
                <p className="text-muted small mt-3 mb-0">Payment confirmation cannot be reversed here.</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" disabled={busy}
                  onClick={() => setPaymentOrder(null)}>Cancel</button>
                <button type="button" className="btn btn-estylo" disabled={busy || !selectedMethod}
                  onClick={confirmPayment}>{busy ? "Saving..." : "Confirm Payment"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {(error || actionError) && <div role="alert" className="alert alert-danger">{actionError || error}</div>}
      <p className="small text-secondary">
        {loading ? "Loading orders…" : updatedAt ? `Last updated: ${updatedAt.toLocaleTimeString()}` : "Waiting for connection…"}
      </p>
      <div
        role="tablist"
        aria-label="Order status"
        className="d-flex gap-2 mb-3 pb-2"
        style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}
      >
        {groups.map((group) => {
          const count = orders.filter((order) => order.status === group.status).length;
          const selected = activeTab === group.status;
          return (
            <button
              key={group.status}
              id={`tab-${group.status}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`panel-${group.status}`}
              className={`btn ${selected ? "btn-estylo" : "btn-outline-secondary"}`}
              style={{
                flexShrink: 0,
                minHeight: 48,
                whiteSpace: "nowrap",
                borderColor: selected ? undefined : group.color,
              }}
              onClick={() => setActiveTab(group.status)}
            >
              {group.label} <span className="badge text-bg-secondary ms-1">{count}</span>
            </button>
          );
        })}
      </div>
      {groups.filter((group) => group.status === activeTab).map((group) => {
        const rows = orders.filter((order) => order.status === group.status);
        return (
          <section
            key={group.status}
            id={`panel-${group.status}`}
            role="tabpanel"
            aria-labelledby={`tab-${group.status}`}
            className="card-estylo mb-3"
          >
            <h2 className="h5 mb-3" style={{ color: group.color }}>{group.label}</h2>
            {(group.status === "COMPLETED" || group.status === "CANCELLED") && (
              <p className="small text-secondary">From the latest 50 completed/cancelled orders.</p>
            )}
            {!rows.length ? (
              <p className="empty mt-3">No orders in this section.</p>
            ) : (
              <div className="order-grid mt-3">
                  {rows.map((order) => {
                    const cups = order.items.flatMap((item) => Array.from(
                      { length: item.quantity }, (_, index) => ({ key: `${item.id}-${index}`, item })));
                    return (
                      <article className="card-estylo" key={order.id}>
                        <small>{order.id.slice(0, 8)} · {new Date(order.createdAt).toLocaleString()}</small>
                        <h3 className="mt-2">
                          {order.queueNumber != null && <span className="text-warning">
                            Queue #{String(order.queueNumber).padStart(3, "0")}<br />
                          </span>}
                          {order.customer}
                        </h3>
                        <span className={"badge " + (order.payment === "PAID" ? "text-bg-success" : "text-bg-warning")}>
                          {order.payment}
                        </span>
                        {order.payment === "PAID" && order.paymentMethodName && (
                          <small className="d-block mt-2">Paid via: {order.paymentMethodName}</small>
                        )}
                        <p className="mt-2">
                          {order.fulfillment} · {order.source.replace("_", " ")}
                          {order.phone && <><br />{order.phone}</>}
                          {order.address && <><br />{order.address}</>}
                        </p>
                        {cups.map(({ key, item }, index) => {
                          const addOnTotal = (item.addons || []).reduce(
                            (sum, addon) => sum + addon.quantity * addon.unitPriceCentavos, 0);
                          const cupTotal = (item.freeDrink ? 0 : item.unitPriceCentavos) + addOnTotal;
                          return (
                            <div key={key} className="mb-3 pb-2 border-bottom">
                              <strong>Cup {index + 1} — {item.name}</strong>
                              {item.freeDrink && <span className="badge text-bg-success ms-2">FREE DRINK</span>}
                              <small className="d-block">
                                Base: {item.freeDrink ? <><s>{money(item.unitPriceCentavos)}</s> FREE</> : money(item.unitPriceCentavos)}
                              </small>
                              {item.addons?.map((addon) => <small className="d-block" key={addon.id}>
                                + {addon.name}: {addon.quantity} × {money(addon.unitPriceCentavos)}
                              </small>)}
                              <small className="d-block fw-bold mt-1">Cup total: {money(cupTotal)}</small>
                            </div>
                          );
                        })}
                        <strong className="d-block mt-3">Total: {money(order.totalCentavos)}</strong>
                        <div className="d-flex gap-2 flex-wrap mt-3">
                          {order.payment === "UNPAID" && order.status !== "CANCELLED" &&
                            <button disabled={busy} className="btn btn-estylo"
                              onClick={() => openPayment(order)}>Mark Paid</button>}
                          {order.status !== "CANCELLED" &&
                            <button type="button" className="btn btn-danger" disabled={busy}
                              onClick={() => voidOrder(order)}>Void Transaction</button>}
                          {nextSteps[order.status].map((status) =>
                            <button key={status} className="btn btn-outline-secondary"
                              disabled={busy || (status === "COMPLETED" && order.payment !== "PAID") ||
                                (status === "CANCELLED" && order.payment === "PAID")}
                              onClick={() => update(order, { status })}>{actionLabels[status]}</button>)}
                        </div>
                      </article>
                    );
                  })}
                </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
