import { FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { StoreHoursState } from "../types";

const ph = (value: string) => new Date(value).toLocaleString("en-PH", {
  timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short",
});
export function StoreHoursPage() {
  const [state, setState] = useState<StoreHoursState | null>(null);
  const [openingTime, setOpeningTime] = useState("00:00");
  const [closingTime, setClosingTime] = useState("23:00");
  const [bufferMinutes, setBufferMinutes] = useState(60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const initialized = useRef(false);
  useEffect(() => {
    let mounted = true;
    async function refresh() {
      try {
        const current = await api<StoreHoursState>("/store-hours/current");
        if (!mounted) return;
        setState(current);
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
            : "The dashboard and today's order board are aligned to the business date shown above. Store hours do not by themselves block new orders."}
        </p>
        <div className="d-flex flex-wrap gap-2 mt-2">
          <Link to="/dashboard" className="btn btn-outline-secondary">Review Dashboard</Link>
          <Link to="/orders" className="btn btn-outline-secondary">Review Orders</Link>
          <Link to="/reports" className="btn btn-outline-secondary">Review Reports</Link>
        </div>
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
          <label htmlFor="store-closes" className="form-label">Closing time (PH)</label>
          <input id="store-closes" type="time" required className="form-control" value={closingTime}
            onChange={e => setClosingTime(e.target.value)} />
        </div>
        <div className="col-md-4">
          <label htmlFor="review-buffer" className="form-label">End-of-day review buffer (minutes)</label>
          <input id="review-buffer" type="number" min={0} max={360} step={1} required className="form-control"
            value={bufferMinutes} onChange={e => setBufferMinutes(Number(e.target.value))} />
          <div className="form-text">Default: 60 minutes. Allowed: 0–360 minutes.</div>
        </div>
      </div>
      <div className="alert alert-info my-3">
        <strong>Automatic rollover — no data deletion.</strong>
        The live dashboard, today's order tabs and today's report selection move to the next business date
        after <strong>Closing time + Review buffer</strong>. All transactions and historical reports remain stored.
        Open unfinished orders remain visible under Previous Business Days. Queue numbers restart at the cutoff.
      </div>
      <p className="text-secondary small">The automatic rollover changes visual reporting and queue numbering; it does not close the POS or reject orders outside opening hours.</p>
      <p className="text-secondary small">This setting uses one daily schedule, not separate hours by weekday. Changes apply to newly created orders and the live display; previously saved orders keep their original business dates. The review buffer must finish before the next day's opening.</p>
      <button type="submit" className="btn btn-estylo" disabled={busy || !openingTime || !closingTime}>
        {busy ? "Saving…" : "Save Store Hours"}
      </button>
    </form>
  </div>;
}
