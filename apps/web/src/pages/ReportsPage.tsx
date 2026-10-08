import { useEffect, useState } from "react";
import { api, money } from "../api/client";
import { Report } from "../types";
export function ReportsPage({ dashboard = false }: { dashboard?: boolean }) {
  const [report, setReport] = useState<Report | null>(null),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [error, setError] = useState("");
  async function load() {
    let query = "";
    if (dashboard) {
      const f = new Date();
      f.setHours(0, 0, 0, 0);
      query = "?from=" + encodeURIComponent(f.toISOString());
    } else if (from && to)
      query =
        "?from=" +
        encodeURIComponent(new Date(from + "T00:00:00+08:00").toISOString()) +
        "&to=" +
        encodeURIComponent(new Date(to + "T23:59:59.999+08:00").toISOString());
    try {
      setError("");
      setReport(await api<Report>("/reports" + query));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }
  useEffect(() => {
    void load();
  }, [dashboard]);
  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>{dashboard ? "Dashboard" : "Reports"}</h1>
          <p>
            {dashboard
              ? "Today at Estylo Coffee"
              : "Last 30 days by default · custom dates use Philippine time"}
          </p>
        </div>
      </div>
      {error && (
        <div role="alert" className="alert alert-danger">
          {error}
        </div>
      )}
      {!dashboard && (
        <form
          className="card-estylo mb-4 d-flex gap-3 align-items-end flex-wrap"
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          <label>
            From
            <input
              type="date"
              className="form-control"
              required
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            To
            <input
              type="date"
              className="form-control"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <button className="btn btn-estylo">Apply range</button>
        </form>
      )}
      <div className="metric-grid mb-4">
        {[
          ["Orders", report?.count || 0],
          ["Paid sales", money(report?.paidCentavos || 0)],
          ["Paid orders", report?.paidCount || 0],
          ["In progress", report?.open || 0],
        ].map(([label, value]) => (
          <div className="card-estylo" key={label}>
            <div className="metric-label">{label}</div>
            <div className="metric-value">{value}</div>
          </div>
        ))}
      </div>
      <div className="card-estylo">
        <h5>Order status breakdown</h5>
        {report?.statuses.map((s) => (
          <div className="report-row" key={s.status}>
            <span>{s.status}</span>
            <strong>{s._count}</strong>
          </div>
        ))}
        {!report?.count && <p className="empty">No orders in this range.</p>}
      </div>
      <p className="muted mt-3">
        Manual payment records, grouped by order creation date. This is an
        operational report.
      </p>
    </div>
  );
}
