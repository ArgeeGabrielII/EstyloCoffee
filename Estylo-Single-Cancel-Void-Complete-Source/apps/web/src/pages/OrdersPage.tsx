import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, money } from "../api/client";
import { Order, Status } from "../types";
import { useAutoRefresh } from "../hooks/useAutoRefresh";

type PaymentMethod = { id: string; name: string; active: boolean };
const groups: { status: Status; label: string; color: string }[] = [
  { status: "NEW", label: "New Orders", color: "#f0c75e" },
  { status: "PREPARING", label: "Preparing", color: "#79b8ff" },
  { status: "READY", label: "Ready for Pickup", color: "#73d49b" },
  { status: "COMPLETED", label: "Completed", color: "#aaaaaa" },
  { status: "CANCELLED", label: "Cancelled", color: "#ef8f8f" },
];
const nextSteps: Record<Status, Status[]> = {
  NEW: ["PREPARING"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};
const actionLabels: Record<Status, string> = {
  NEW: "New", PREPARING: "Start Preparing", READY: "Ready for PickUp",
  COMPLETED: "Complete Order", CANCELLED: "Cancel Order",
};

function PaymentIcon({ name }: { name: string }) {
  const n = name.toLowerCase();
  const icon = n.includes("cash") ? "bi-cash-stack" : n.includes("bank") ? "bi-bank" : "bi-phone";
  return <i className={`bi ${icon}`} style={{ fontSize: 29 }} aria-hidden="true" />;
}

export function OrdersPage() {
  const [revision, setRevision] = useState(0);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [cancelRequest, setCancelRequest] = useState<Order | null>(null);
  const [selectedMethod, setSelectedMethod] = useState("");
  const [methodError, setMethodError] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [activeTab, setActiveTab] = useState<Status>("NEW");
  const { data: orders, error, loading, updatedAt } = useAutoRefresh<Order[]>("/queue/staff", [], revision);
  const detailOrder = detailId ? orders.find(o => o.id === detailId) ?? null : null;

  useEffect(() => {
    api<PaymentMethod[]>("/payment-methods").then(setMethods)
      .catch(e => setMethodError(e instanceof Error ? e.message : "Unable to load payment methods"));
  }, [revision]);
  useEffect(() => {
    if (!detailId && !paymentOrder && !cancelRequest) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        if (cancelRequest) setCancelRequest(null);
        else if (paymentOrder) setPaymentOrder(null);
        else setDetailId(null);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [detailId, paymentOrder, cancelRequest, busy]);

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
        method: "PATCH", body: JSON.stringify({ payment: "PAID", paymentMethodId: selectedMethod }),
      });
      setPaymentOrder(null);
      setRevision(n => n + 1);
    } catch (e) {
      setMethodError(e instanceof Error ? e.message : "Payment could not be saved");
    } finally { setBusy(false); }
  }
  async function update(order: Order, patch: { status?: Status; payment?: "PAID" | "UNPAID" }) {
    if (busy) return;
    setBusy(true);
    setActionError("");
    try {
      await api("/orders/" + order.id, { method: "PATCH", body: JSON.stringify(patch) });
      setRevision(n => n + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Unable to update order.");
    } finally { setBusy(false); }
  }
  function requestCancellation(order: Order) {
    if (busy || order.status !== "NEW") return;
    setActionError("");
    setCancelRequest(order);
  }
  async function confirmCancellation() {
    if (!cancelRequest || busy) return;
    const order = cancelRequest;
    if (order.status !== "NEW") {
      setActionError("Only new orders can be cancelled or voided.");
      setCancelRequest(null);
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      // Paid orders use the void endpoint; unpaid orders use the normal cancel transition.
      // The API enforces NEW-only cancellation/voiding independently of this UI.
      if (order.payment === "PAID") {
        await api("/orders/" + order.id + "/void", { method: "POST" });
      } else {
        await api("/orders/" + order.id, {
          method: "PATCH", body: JSON.stringify({ status: "CANCELLED" }),
        });
      }
      setCancelRequest(null);
      setDetailId(null);
      setRevision(n => n + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Unable to cancel order.");
    } finally { setBusy(false); }
  }
  function actions(order: Order) {
    return <div className="d-flex flex-wrap gap-2 mt-3">
      {order.payment === "UNPAID" && order.status !== "CANCELLED" &&
        <button type="button" disabled={busy} className="btn btn-estylo fw-bold" style={{ minHeight: 48 }}
          onClick={() => openPayment(order)}>Confirm Payment</button>}
      {nextSteps[order.status].map(status =>
        <button type="button" key={status} className="btn btn-outline-secondary fw-semibold"
          style={{ minHeight: 48 }}
          disabled={busy || (status === "COMPLETED" && order.payment !== "PAID") ||
            (status === "CANCELLED" && order.payment === "PAID")}
          onClick={() => update(order, { status })}>{actionLabels[status]}</button>)}
      {order.status === "NEW" &&
        <button type="button" className="btn btn-danger fw-semibold" style={{ minHeight: 48 }}
          disabled={busy} onClick={() => requestCancellation(order)}>{order.payment === "PAID" ? "Void Transaction" : "Cancel Order"}</button>}
    </div>;
  }
  function orderDetails(order: Order) {
    let cupNumber = 0;
    return <>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <div className="text-secondary small">{order.id.slice(0, 8)} · {new Date(order.createdAt).toLocaleString()}</div>
          {order.queueNumber != null && <div className="fw-bold text-warning" style={{ fontSize: "clamp(2.25rem, 5vw, 3.25rem)", lineHeight: 1.1, letterSpacing: "-.025em" }}>Queue #{String(order.queueNumber).padStart(3, "0")}</div>}
          <h3 className="h5 mt-2 mb-1">{order.customer}</h3>
        </div>
        <div className="text-end">
          <span className={`badge fs-6 ${order.payment === "PAID" ? "text-bg-success" : "text-bg-warning"}`}>{order.payment}</span>
          <div className="small mt-1">{order.status.replaceAll("_", " ")}</div>
        </div>
      </div>
      <div className="mb-3">{order.fulfillment} · {order.source.replaceAll("_", " ")}
        {order.phone && <div>Phone: {order.phone}</div>}
        {order.address && <div>Address: {order.address}</div>}
        {order.payment === "PAID" && order.paymentMethodName && <div>Paid via: {order.paymentMethodName}</div>}
      </div>
      <div className="border-top pt-3">
        {order.items.flatMap(item => Array.from({ length: item.quantity }, (_, index) => {
          const num = ++cupNumber;
          const addOnTotal = (item.addons || []).reduce((sum, addon) => sum + addon.quantity * addon.unitPriceCentavos, 0);
          const cupTotal = (item.freeDrink ? 0 : item.unitPriceCentavos) + addOnTotal;
          return <div key={`${item.id}-${index}`} className="pb-3 mb-3 border-bottom">
            <strong>Cup {num} — {item.name}</strong>
            {item.freeDrink && <span className="badge text-bg-success ms-2">FREE DRINK</span>}
            <div className="small">Base: {item.freeDrink ? <><s>{money(item.unitPriceCentavos)}</s> FREE</> : money(item.unitPriceCentavos)}</div>
            {item.addons?.map(addon => <div className="small" key={addon.id}>+ {addon.name}: {addon.quantity} × {money(addon.unitPriceCentavos)}</div>)}
            <div className="fw-semibold small mt-1">Cup total: {money(cupTotal)}</div>
          </div>;
        }))}
      </div>
      <div className="d-flex justify-content-between align-items-center fs-4 fw-bold">
        <span>Total</span><span>{money(order.totalCentavos)}</span>
      </div>
    </>;
  }

  return <div className="page">
    <div className="page-title">
      <div><h1>Cashier &amp; Barista Orders</h1><p>Orders update automatically every 3 seconds.</p></div>
      <Link to="/queue" target="_blank" rel="noopener noreferrer" className="btn btn-estylo">Open public display</Link>
    </div>
    {(error || actionError) && <div role="alert" className="alert alert-danger">{actionError || error}</div>}
    <p className="small text-secondary">{loading ? "Loading orders…" : updatedAt ? `Last updated: ${updatedAt.toLocaleTimeString()}` : "Waiting for connection…"}</p>
    <div role="tablist" aria-label="Order status" className="d-flex gap-2 mb-3 pb-2"
      style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      {groups.map(group => {
        const count = orders.filter(order => order.status === group.status).length;
        const selected = activeTab === group.status;
        return <button key={group.status} id={`tab-${group.status}`} type="button" role="tab"
          aria-selected={selected} aria-controls={`panel-${group.status}`}
          className={`btn ${selected ? "btn-estylo" : "btn-outline-secondary"}`}
          style={{ flexShrink: 0, minHeight: 60, padding: "12px 20px", fontSize: "1.1rem", fontWeight: 750,
            whiteSpace: "nowrap", borderWidth: 2, borderColor: selected ? undefined : group.color }}
          onClick={() => setActiveTab(group.status)}>
          {group.label} <span className="badge text-bg-secondary ms-2" style={{ fontSize: ".95rem" }}>{count}</span>
        </button>;
      })}
    </div>
    {groups.filter(group => group.status === activeTab).map(group => {
      const rows = orders.filter(order => order.status === group.status);
      return <section key={group.status} id={`panel-${group.status}`} role="tabpanel"
        aria-labelledby={`tab-${group.status}`} className="card-estylo mb-3">
        <h2 className="h5 mb-3" style={{ color: group.color }}>{group.label}</h2>
        {(group.status === "COMPLETED" || group.status === "CANCELLED") &&
          <p className="small text-secondary">From the latest 50 completed/cancelled orders.</p>}
        {!rows.length ? <p className="empty mt-3">No orders in this section.</p> :
          <div className="order-grid mt-3">{rows.map(order =>
            <article key={order.id} className="card-estylo" role="button" tabIndex={0}
              aria-label={`View details for ${order.customer}, ${money(order.totalCentavos)}`}
              onClick={() => setDetailId(order.id)}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDetailId(order.id); } }}
              style={{ position: "relative", overflow: "hidden", cursor: "pointer", minHeight: 210 }}>
              {order.payment === "UNPAID" && <span aria-hidden="true" style={{
                position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%) rotate(-27deg)",
                fontSize: "clamp(3rem, 6vw, 5rem)", fontWeight: 900, letterSpacing: ".12em",
                color: "#b88a35", opacity: .15, pointerEvents: "none", whiteSpace: "nowrap", zIndex: 0,
              }}>UNPAID</span>}
              <div style={{ position: "relative", zIndex: 1 }}>
                <small>{new Date(order.createdAt).toLocaleString()}</small>
                {order.queueNumber != null && <div className="fw-bold text-warning mt-2" style={{ fontSize: "clamp(2rem, 4vw, 2.75rem)", lineHeight: 1.1, letterSpacing: "-.025em" }}>Queue #{String(order.queueNumber).padStart(3, "0")}</div>}
                <h3 className="h5 mt-2 mb-2">{order.customer}</h3>
                <span className={`badge ${order.payment === "PAID" ? "text-bg-success" : "text-bg-warning"}`}>{order.payment}</span>
                <p className="mt-2 mb-1">{order.items.reduce((n, item) => n + item.quantity, 0)} cup(s) · {order.fulfillment}</p>
                <strong className="d-block mt-2 fs-5">{money(order.totalCentavos)}</strong>
                <div className="mt-3 fw-semibold" style={{ color: "#b88a35" }}>Tap to view details <i className="bi bi-chevron-right" /></div>
              </div>
            </article>
          )}</div>}
      </section>;
    })}

    {detailId && detailOrder && <div className="modal d-block" role="dialog" aria-modal="true"
      aria-labelledby="order-detail-title" style={{ background: "rgba(0,0,0,.7)", zIndex: 1900 }}
      onClick={e => { if (e.target === e.currentTarget && !busy) setDetailId(null); }}>
      <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
        <div className="modal-content" style={{ borderRadius: 16, maxHeight: "92dvh" }}>
          <div className="modal-header">
            <h2 className="modal-title h4" id="order-detail-title">Order Details</h2>
            <button className="btn-close" type="button" aria-label="Close" disabled={busy} onClick={() => setDetailId(null)} />
          </div>
          <div className="modal-body" style={{ fontSize: "1.05rem" }}>
            {actionError && <div className="alert alert-danger" role="alert">{actionError}</div>}
            {orderDetails(detailOrder)}
            {actions(detailOrder)}
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-outline-secondary"
            style={{ minHeight: 48 }} disabled={busy} onClick={() => setDetailId(null)}>Close</button></div>
        </div>
      </div>
    </div>}

    {cancelRequest && <div className="modal d-block" role="dialog" aria-modal="true"
      aria-labelledby="cancel-confirm-title" style={{ background: "rgba(0,0,0,.78)", zIndex: 2100 }}
      onClick={e => { if (e.target === e.currentTarget && !busy) setCancelRequest(null); }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content" style={{ borderRadius: 16 }}>
          <div className="modal-header">
            <h2 className="modal-title h4" id="cancel-confirm-title">
              {cancelRequest.payment === "PAID" ? "Confirm Void Transaction" : "Confirm Cancel Order"}
            </h2>
            <button type="button" className="btn-close" aria-label="Close" disabled={busy}
              onClick={() => setCancelRequest(null)} />
          </div>
          <div className="modal-body">
            {cancelRequest.queueNumber != null && <div className="fw-bold text-warning"
              style={{ fontSize: "clamp(2.25rem, 5vw, 3.25rem)", lineHeight: 1.1 }}>
              Queue #{String(cancelRequest.queueNumber).padStart(3, "0")}
            </div>}
            <p className="fs-5 fw-semibold mt-2 mb-1">{cancelRequest.customer}</p>
            <p className="fs-3 fw-bold mb-3">{money(cancelRequest.totalCentavos)}</p>
            <div className="alert alert-warning" role="alert">
              Are you sure you want to {cancelRequest.payment === "PAID" ? "void this transaction" : "cancel this order"}?
              <strong className="d-block mt-1">This action cannot be undone.</strong>
            </div>
            {cancelRequest.payment === "PAID" && <div className="alert alert-danger" role="alert">
              This action does not refund the customer. Handle any refund separately.
            </div>}
            {actionError && <div className="alert alert-danger" role="alert">{actionError}</div>}
          </div>
          <div className="modal-footer d-flex gap-2">
            <button type="button" className="btn btn-outline-secondary fw-semibold" style={{ minHeight: 52 }}
              disabled={busy} onClick={() => setCancelRequest(null)}>Keep Order</button>
            <button type="button" className="btn btn-danger fw-bold" style={{ minHeight: 52 }}
              disabled={busy} onClick={confirmCancellation}>
              {busy ? "Processing…" : cancelRequest.payment === "PAID" ? "Yes, Void Transaction" : "Yes, Cancel Order"}
            </button>
          </div>
        </div>
      </div>
    </div>}

    {paymentOrder && <div className="modal d-block" role="dialog" aria-modal="true"
      aria-labelledby="payment-modal-title" style={{ background: "rgba(0,0,0,.78)", zIndex: 2000 }}
      onClick={e => { if (e.target === e.currentTarget && !busy) setPaymentOrder(null); }}>
      <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
        <div className="modal-content" style={{ borderRadius: 16 }}>
          <div className="modal-header">
            <h2 className="modal-title h4" id="payment-modal-title">Confirm Payment</h2>
            <button type="button" className="btn-close" disabled={busy} aria-label="Close" onClick={() => setPaymentOrder(null)} />
          </div>
          <div className="modal-body">
            {paymentOrder.queueNumber != null && <div className="fw-bold text-warning" style={{ fontSize: "clamp(2.25rem, 5vw, 3.25rem)", lineHeight: 1.1 }}>Queue #{String(paymentOrder.queueNumber).padStart(3, "0")}</div>}
            <p className="mt-2 mb-1 fs-5 fw-semibold">{paymentOrder.customer}</p>
            <p className="fs-2 fw-bold">{money(paymentOrder.totalCentavos)}</p>
            <p className="fw-bold mb-2">Tap a payment method</p>
            <div className="row g-3" role="group" aria-label="Payment methods">
              {methods.filter(m => m.active).map(method => {
                const selected = selectedMethod === method.id;
                return <div className="col-6 col-md-4" key={method.id}>
                  <button type="button" disabled={busy} aria-pressed={selected}
                    className="btn w-100 d-flex flex-column align-items-center justify-content-center gap-2"
                    style={{ minHeight: 128, padding: 14, borderRadius: 14, border: `3px solid ${selected ? "#b88a35" : "#d5cfc2"}`,
                      background: selected ? "#f7edcf" : "#fff", color: "#292419", fontWeight: 750, fontSize: "1.05rem" }}
                    onClick={() => setSelectedMethod(method.id)}>
                    <PaymentIcon name={method.name} />
                    <span>{method.name}</span>
                    {selected && <span className="small"><i className="bi bi-check-circle-fill" /> Selected</span>}
                  </button>
                </div>;
              })}
            </div>
            {!methods.some(m => m.active) && <p className="text-danger mt-3">No active payment methods. Contact an administrator.</p>}
            {methodError && <div role="alert" className="alert alert-danger mt-3">{methodError}</div>}
            <p className="text-secondary small mt-3 mb-0">Payment confirmation cannot be reversed here.</p>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" style={{ minHeight: 48 }} disabled={busy}
              onClick={() => setPaymentOrder(null)}>Back</button>
            <button type="button" className="btn btn-estylo fw-bold" style={{ minHeight: 48 }}
              disabled={busy || !selectedMethod} onClick={confirmPayment}>{busy ? "Saving…" : "Confirm Payment"}</button>
          </div>
        </div>
      </div>
    </div>}
  </div>;
}
