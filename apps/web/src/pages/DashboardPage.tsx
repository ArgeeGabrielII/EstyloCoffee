import { useEffect, useState } from "react";
import { api, money } from "../api/client";
import type { Report } from "../types";

type MarketingMetrics = {
  asOf: string;
  todaySalesCentavos: number;
  yesterdayComparableCentavos: number;
  growthPercent: number | null;
  todayOrders: number;
  peakHour: number | null;
  peakOrderCount: number;
  comparison: string;
  hourBasis: string;
};

function todayStartPH() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T00:00:00+08:00`;
}

function hourLabel(hour: number | null) {
  if (hour === null) return "No sales yet";
  const format = (h: number) =>
    `${String(h % 12 || 12)} ${h < 12 ? "AM" : "PM"}`;
  return `${format(hour)} – ${format((hour + 1) % 24)}`;
}

export function DashboardPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [marketing, setMarketing] = useState<MarketingMetrics | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const from = new Date(todayStartPH()).toISOString();
        const [summary, metrics] = await Promise.all([
          api<Report>(`/reports?from=${encodeURIComponent(from)}`),
          api<MarketingMetrics>("/reports/marketing-dashboard"),
        ]);
        if (active) {
          setReport(summary);
          setMarketing(metrics);
          setError("");
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Unable to load dashboard");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const growth = marketing?.growthPercent;
  const growthText = growth === null || growth === undefined
    ? "No baseline"
    : `${growth > 0 ? "+" : ""}${growth.toFixed(1)}%`;
  const growthColor = growth === null || growth === undefined
    ? "#9e764e"
    : growth >= 0 ? "#23794c" : "#b42318";

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Dashboard</h1>
          <p>Today at Estylo Coffee · Philippine Time</p>
        </div>
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {loading && !report && <p role="status">Loading dashboard…</p>}

      <div className="metric-grid mb-4">
        <div className="card-estylo">
          <div className="metric-label">Orders</div>
          <div className="metric-value">{report?.count ?? "—"}</div>
          <small className="text-secondary">All orders created today</small>
        </div>
        <div className="card-estylo">
          <div className="metric-label">Paid Sales</div>
          <div className="metric-value">{report ? money(report.paidCentavos) : "—"}</div>
          <small className="text-secondary">Paid, non-cancelled orders</small>
        </div>
        <div className="card-estylo">
          <div className="metric-label">Paid Orders</div>
          <div className="metric-value">{report?.paidCount ?? "—"}</div>
          <small className="text-secondary">Transactions with confirmed payment</small>
        </div>
        <div className="card-estylo">
          <div className="metric-label">In Progress</div>
          <div className="metric-value">{report?.open ?? "—"}</div>
          <small className="text-secondary">New, preparing and ready</small>
        </div>
        <div className="card-estylo">
          <div className="metric-label">
            <i className="bi bi-graph-up-arrow me-2" aria-hidden="true" />
            Sales Growth
          </div>
          <div className="metric-value" style={{ color: growthColor }}>
            {marketing ? growthText : "—"}
          </div>
          <small className="d-block text-secondary">
            Today vs. yesterday at the same time
          </small>
          {marketing && (
            <small className="d-block text-secondary mt-2">
              {money(marketing.todaySalesCentavos)} vs. {money(marketing.yesterdayComparableCentavos)}
            </small>
          )}
        </div>
        <div className="card-estylo">
          <div className="metric-label">
            <i className="bi bi-clock-history me-2" aria-hidden="true" />
            Peak Sales Hour
          </div>
          <div className="metric-value" style={{ fontSize: "clamp(1.2rem, 2vw, 1.6rem)" }}>
            {marketing ? hourLabel(marketing.peakHour) : "—"}
          </div>
          <small className="text-secondary">
            {marketing ? `${marketing.peakOrderCount} paid order${marketing.peakOrderCount === 1 ? "" : "s"} during this hour today` : "Most paid orders in a one-hour slot"}
          </small>
        </div>
      </div>

      <div className="card-estylo">
        <h5>Order Status Breakdown</h5>
        {report?.statuses.length
          ? report.statuses.map(s => (
            <div key={s.status} className="report-row">
              <span>{s.status.replace("_", " ")}</span>
              <strong>{s._count}</strong>
            </div>
          ))
          : <p className="text-secondary mb-0">No orders today.</p>}
      </div>
      <p className="small text-secondary mt-3">
        Sales Growth uses paid, non-cancelled orders created during matching elapsed
        periods. Peak Sales Hour is based on paid-order count by creation hour, not
        the hour payment was received. Metrics refresh every minute.
      </p>
    </div>
  );
}
