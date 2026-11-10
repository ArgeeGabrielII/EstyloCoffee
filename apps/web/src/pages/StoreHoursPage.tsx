import { FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, money } from "../api/client";
import type { StoreHoursState } from "../types";

const ph = (value: string) => new Date(value).toLocaleString("en-PH", {
  timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short",
});
// The store schedule repeats daily. Dates selected here are for display only,
// not an effective-date rule or a historical order edit.
function previewSchedule(businessDate: string, opening: string, closing: string, buffer: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(opening) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(closing) ||
      !Number.isInteger(buffer) || buffer < 0 || buffer > 360) return null;
  const clockMinutes = (value: string) => {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  };
  const opens = clockMinutes(opening);
  const closes = clockMinutes(closing);
  const closesNextDay = closes <= opens;
  const duration = (closes - opens + 1440) % 1440 || 1440;
  if (duration + buffer > 1440) return null;
  const dayStart = Date.parse(businessDate + "T00:00:00+08:00");
  if (!Number.isFinite(dayStart) ||
      new Date(dayStart + 8 * 60 * 60 * 1000).toISOString().slice(0, 10) !== businessDate) return null;
  const at = (offsetMinutes: number) => new Date(dayStart + offsetMinutes * 60000).toISOString();
  const closeMinute = closes + (closesNextDay ? 1440 : 0);
  return {
    opensAt: at(opens),
    closesAt: at(closeMinute),
    rolloverAt: at(closeMinute + buffer),
    closesNextDay,
  };
}

type Reconciliation = {
  businessDate: string;
  phase: string;
  locked: boolean;
  lockReason: string;
  orderCount: number;
  paidOrderCount: number;
  salesCentavos: number;
  unpaidOrderCount: number;
  unfinishedCount: number;
  snapshot: { finalizedAt: string; finalizedBy: string } | null;
};
export function StoreHoursPage() {
  const [state, setState] = useState<StoreHoursState | null>(null);
  const [openingTime, setOpeningTime] = useState("00:00");
  const [closingTime, setClosingTime] = useState("23:00");
  const [bufferMinutes, setBufferMinutes] = useState(60);
  const [previewDate, setPreviewDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const initialized = useRef(false);
  const dateToPreview = previewDate || state?.businessDate || "";
  const preview = previewSchedule(dateToPreview, openingTime, closingTime, bufferMinutes);
  useEffect(() => {
    let mounted = true;
    async function refresh() {
      try {
        const current = await api<StoreHoursState>("/store-hours/current");
        if (!mounted) return;
        setState(current);
        try {
          const summary = await api<Reconciliation>(`/store-hours/reconciliation?date=${current.businessDate}`);
          if (mounted) setReconciliation(summary);
        } catch (e) {
          if (mounted) setError(e instanceof Error ? e.message : "Could not load reconciliation");
        }
        if (!initialized.current) {
          setOpeningTime(current.openingTime);
          setClosingTime(current.closingTime);
          setBufferMinutes(current.bufferMinutes);
          initialized.current = true;
        }
      } catch (e) { if (mounted) setError(e instanceof Error ? e.message : "Could not load store hours"); }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, []);
  async function finalize(event: FormEvent) {
    event.preventDefault();
    if (!reconciliation || confirmation !== "FINALIZE" || finalizing) return;
    setFinalizing(true); setError(""); setMessage("");
    try {
      await api("/store-hours/finalize", {
        method: "POST",
        body: JSON.stringify({
          businessDate: reconciliation.businessDate,
          confirmation: "FINALIZE",
        }),
      });
      setReconciliation(await api<Reconciliation>(
        `/store-hours/reconciliation?date=${reconciliation.businessDate}`,
      ));
      setConfirmation("");
      setMessage("Business-day financial records finalized and locked. An audit entry was recorded.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not finalize business day");
    } finally { setFinalizing(false); }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const current = await api<StoreHoursState>("/store-hours", {
        method: "PUT", body: JSON.stringify({ openingTime, closingTime, bufferMinutes }),
      });
      setState(current);
      setMessage("Store hours saved. New orders use the new business-day schedule; past orders stay assigned to their original business dates.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save store hours"); }
    finally { setBusy(false); }
  }
  return <div className="page">
    <div className="page-title">
      <div><h1>Store Hours</h1><p>Daily operating hours and automatic business-day rollover · Asia/Manila</p></div>
    </div>
    {error && <div className="alert alert-danger" role="alert">{error}</div>}
    {message && <div className="alert alert-success" role="status">{message}</div>}
    <div className="card-estylo mb-4">
      <h2 className="h5">Live business-day status</h2>
      {!state ? <p>Loading operational schedule…</p> : <>
        <div className="d-flex flex-wrap gap-3 align-items-center mt-3">
          <div><div className="text-secondary small">Active business date</div><strong className="fs-4">{state.businessDate}</strong></div>
          <div><div className="text-secondary small">Closing time</div><strong>{ph(state.closingAt)}</strong></div>
          <div><div className="text-secondary small">Dashboard/Orders rollover</div><strong>{ph(state.rolloverAt)}</strong></div>
          <span className={`badge ${state.phase === "REVIEW" ? "text-bg-warning" : "text-bg-secondary"}`}>
            {state.phase === "REVIEW" ? "End-of-day review window" : state.phase === "OPEN" ? "Store open" : "Store closed"}
          </span>
        </div>
        <p className="mt-3 mb-2">
          {state.phase === "REVIEW"
            ? "Store closing time has passed. The dashboard and today's order board still show the closing business day so the administrator can reconcile sales and payments."
            : "The dashboard and today's order board are aligned to the business date shown above. New orders are blocked outside operating hours."}
        </p>
        <div className="d-flex flex-wrap gap-2 mt-2">
          <Link to="/dashboard" className="btn btn-outline-secondary">Review Dashboard</Link>
          <Link to="/orders" className="btn btn-outline-secondary">Review Orders</Link>
          <Link to="/reports" className="btn btn-outline-secondary">Review Reports</Link>
        </div>
      </>}
    </div>
    <div className="card-estylo mb-4">
      <h2 className="h5">End-of-day reconciliation</h2>
      {!reconciliation ? <p>Loading payment and order summary…</p> : <>
        <div className="d-flex flex-wrap gap-3 mb-3">
          <div><small className="d-block text-secondary">Orders</small><strong>{reconciliation.orderCount}</strong></div>
          <div><small className="d-block text-secondary">Paid orders</small><strong>{reconciliation.paidOrderCount}</strong></div>
          <div><small className="d-block text-secondary">Paid sales</small><strong>{money(reconciliation.salesCentavos)}</strong></div>
          <div><small className="d-block text-secondary">Unpaid</small><strong>{reconciliation.unpaidOrderCount}</strong></div>
          <div><small className="d-block text-secondary">Unfinished</small><strong>{reconciliation.unfinishedCount}</strong></div>
        </div>
        {reconciliation.locked ? (
          <div className="alert alert-secondary" role="status">
            <strong>Financial records locked.</strong> {reconciliation.lockReason === "MANUALLY_FINALIZED"
              ? `Manually finalized on ${reconciliation.snapshot ? ph(reconciliation.snapshot.finalizedAt) : "a prior date"}.`
              : "The scheduled rollover cutoff has passed."}
            {" "}Payment changes and voids on this business date are blocked.
          </div>
        ) : reconciliation.phase === "REVIEW" ? (
          <>
            <p>Verify payments, status and totals before finalizing. Payment and void operations remain available until finalization or the scheduled cutoff.</p>
            {reconciliation.unpaidOrderCount > 0 || reconciliation.unfinishedCount > 0 ? (
              <div className="alert alert-warning">
                Resolve unpaid and unfinished orders before manual finalization. The scheduled cutoff will still lock the day, with unresolved orders flagged for follow-up.
              </div>
            ) : <form onSubmit={finalize}>
              <label className="form-label" htmlFor="finalize-confirm">Type FINALIZE to lock this day's financial records</label>
              <div className="d-flex gap-2 flex-wrap">
                <input id="finalize-confirm" value={confirmation} onChange={e => setConfirmation(e.target.value)}
                  className="form-control" style={{ maxWidth: 250 }} autoComplete="off" />
                <button type="submit" className="btn btn-danger" disabled={finalizing || confirmation !== "FINALIZE"}>
                  {finalizing ? "Finalizing…" : `Finalize ${reconciliation.businessDate}`}
                </button>
              </div>
              <small className="text-secondary">This is irreversible in the normal workflow. Only administrators can finalize.</small>
            </form>}
          </>
        ) : <p>Manual finalization becomes available during the end-of-day review buffer (after closing, before rollover).</p>}
      </>}
    </div>
    <form className="card-estylo" onSubmit={save}>
      <h2 className="h5">Daily schedule</h2>
      <p className="text-secondary">Configure the opening and closing time for each day. Overnight operation is supported.</p>
      <div className="row g-3">
        <div className="col-md-4">
          <label htmlFor="store-opens" className="form-label">Opening time (PH)</label>
          <input id="store-opens" type="time" required className="form-control" value={openingTime}
            onChange={e => setOpeningTime(e.target.value)} />
        </div>
        <div className="col-md-4">
          <label htmlFor="store-closes" className="form-label">Closing time (PH) {preview?.closesNextDay ? "(next calendar day)" : "(same calendar day)"}</label>
          <input id="store-closes" type="time" required className="form-control" value={closingTime}
            onChange={e => setClosingTime(e.target.value)} />
          <div className="form-text">A time earlier than or equal to opening means the next day.</div>
        </div>
        <div className="col-md-4">
          <label htmlFor="review-buffer" className="form-label">End-of-day review buffer (minutes)</label>
          <input id="review-buffer" type="number" min={0} max={360} step={1} required className="form-control"
            value={bufferMinutes} onChange={e => setBufferMinutes(Number(e.target.value))} />
          <div className="form-text">Default: 60 minutes. Allowed: 0–360 minutes.</div>
        </div>
      </div>
      <div className="border rounded p-3 my-3" aria-label="Operating-hours date preview">
        <h3 className="h6 fw-bold mb-2">Preview opening, closing, and reconciliation dates</h3>
        <p className="small text-secondary mb-3">
          This is a recurring daily schedule. Choose a business date to see its exact
          times and calendar dates. <strong>The preview date does not schedule
          future activation or modify saved order dates.</strong>
        </p>
        <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
          <div>
            <label htmlFor="store-preview-date" className="form-label">Preview business date</label>
            <input id="store-preview-date" type="date" className="form-control"
              value={dateToPreview} onChange={e => setPreviewDate(e.target.value)} />
          </div>
          {state && <button type="button" className="btn btn-outline-secondary"
            onClick={() => setPreviewDate(state.businessDate)}>Use current business date</button>}
        </div>
        {preview ? <div className="d-flex flex-wrap gap-4" aria-live="polite">
          <div><small className="d-block text-secondary">Opens</small><strong>{ph(preview.opensAt)}</strong></div>
          <div><small className="d-block text-secondary">Closes {preview.closesNextDay ? "(next day)" : ""}</small>
            <strong>{ph(preview.closesAt)}</strong></div>
          <div><small className="d-block text-secondary">Reconciliation ends / display rollover</small>
            <strong>{ph(preview.rolloverAt)}</strong></div>
        </div> : <p className="text-danger small mb-0" role="status">
          Enter valid times, a valid business date, and a review buffer that ends before the next opening.
        </p>}
      </div>
      <div className="alert alert-info my-3">
        <strong>Automatic rollover — no data deletion.</strong>
        The live dashboard, today's order tabs and today's report selection move to the next business date
        after <strong>Closing time + Review buffer</strong>. All transactions and historical reports remain stored.
        Open unfinished orders remain visible under Previous Business Days. Queue numbers restart at the cutoff.
      </div>
      <p className="text-secondary small">Cashier and onsite new orders are rejected outside opening hours. The review buffer allows checking payments and orders, not new orders. At rollover, financial changes to the prior day are automatically locked, even without manual finalization; unresolved orders require a separate auditable correction process.</p>
      <p className="text-secondary small">This setting uses one daily schedule, not separate hours by weekday. Changes apply to newly created orders and the live display; previously saved orders keep their original business dates. The review buffer must finish before the next day's opening.</p>
      <button type="submit" className="btn btn-estylo" disabled={busy || state?.phase === "REVIEW" || !openingTime || !closingTime}>
        {busy ? "Saving…" : "Save Store Hours"}
      </button>
    </form>
  </div>;
}
