import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, money } from "../api/client";
import type { Report } from "../types";
import "./DashboardPage.css";

type CoffeeSale = {
  date: string;
  productId: string;
  name: string;
  quantity: number;
  freeCups?: number;
  coffeeSalesCentavos?: number;
  addonSalesCentavos?: number;
  salesCentavos: number;
};
type CupsReport = { sales: CoffeeSale[] };
type Snapshot = { report: Report; sales: CoffeeSale[] };
type Trend = { current: number; previous: number };

function phDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const get = (part: string) => parts.find((x) => x.type === part)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function bounds(day: string) {
  const start = new Date(`${day}T00:00:00+08:00`);
  return { from: start.toISOString(), to: new Date(start.getTime() + 86400000 - 1).toISOString() };
}
function change(t: Trend) {
  if (t.previous === 0) return t.current === 0 ? "No change" : "New today";
  const value = ((t.current - t.previous) / t.previous) * 100;
  return `${value > 0 ? "↑" : value < 0 ? "↓" : "→"} ${Math.abs(value).toFixed(1)}% vs yesterday`;
}
function trendClass(t: Trend) {
  return t.current > t.previous ? "positive" : t.current < t.previous ? "negative" : "neutral";
}
function Icon({ name }: { name: string }) {
  return <span className={`bi bi-${name}`} aria-hidden="true" />;
}
function MetricCard({ label, value, icon, trend, detail }: {
  label: string; value: string; icon: string; trend?: Trend; detail?: string;
}) {
  return (
    <article className="ed-metric">
      <div className="ed-metric-head">
        <div className="ed-icon"><Icon name={icon} /></div>
        <span className="ed-metric-name">{label}</span>
        <span className="ed-dots" aria-hidden="true"><Icon name="three-dots-vertical" /></span>
      </div>
      <div className="ed-metric-value">{value}</div>
      <div className="ed-metric-foot">
        {trend ? <span className={trendClass(trend)}>{change(trend)}</span> : <span>{detail ?? "Today"}</span>}
      </div>
    </article>
  );
}

export function DashboardPage() {
  const [today, setToday] = useState(phDate);
  const [current, setCurrent] = useState<Snapshot | null>(null);
  const [previous, setPrevious] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setToday(phDate());
    setRefreshKey((n) => n + 1);
  }, []);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const yesterday = phDate(new Date(new Date(`${today}T12:00:00+08:00`).getTime() - 86400000));
        const todayBounds = bounds(today);
        const yesterdayBounds = bounds(yesterday);
        const params = (d: { from: string; to: string }) =>
          `/reports?from=${encodeURIComponent(d.from)}&to=${encodeURIComponent(d.to)}`;
        const months = [...new Set([today.slice(0, 7), yesterday.slice(0, 7)])];
        const [todayReport, yesterdayReport, ...cups] = await Promise.all([
          api<Report>(params(todayBounds)),
          api<Report>(params(yesterdayBounds)),
          ...months.map((m) => {
            const [year, month] = m.split("-");
            return api<CupsReport>(`/reports/cups?year=${year}&month=${Number(month)}`);
          }),
        ]);
        const allSales = cups.flatMap((r) => r.sales);
        if (alive) {
          setCurrent({ report: todayReport, sales: allSales.filter((s) => s.date === today) });
          setPrevious({ report: yesterdayReport, sales: allSales.filter((s) => s.date === yesterday) });
        }
      } catch (e) {
        if (alive) {
          setCurrent(null);
          setPrevious(null);
          setError(e instanceof Error ? e.message : "Could not load dashboard");
        }
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => { alive = false; };
  }, [today, refreshKey]);

  const summary = useMemo(() => {
    const sales = current?.sales ?? [];
    const prior = previous?.sales ?? [];
    const sum = (rows: CoffeeSale[], field: "quantity" | "freeCups") =>
      rows.reduce((n, row) => n + (row[field] ?? 0), 0);
    const currentPaid = current?.report.paidCount ?? 0;
    const previousPaid = previous?.report.paidCount ?? 0;
    const currentRevenue = current?.report.paidCentavos ?? 0;
    const previousRevenue = previous?.report.paidCentavos ?? 0;
    const top = [...sales].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));
    return {
      sales: { current: currentRevenue, previous: previousRevenue },
      orders: { current: current?.report.count ?? 0, previous: previous?.report.count ?? 0 },
      cups: { current: sum(sales, "quantity"), previous: sum(prior, "quantity") },
      aov: { current: currentPaid ? currentRevenue / currentPaid : 0, previous: previousPaid ? previousRevenue / previousPaid : 0 },
      free: sum(sales, "freeCups"),
      paid: currentPaid,
      open: current?.report.open ?? 0,
      top,
      statuses: current?.report.statuses ?? [],
    };
  }, [current, previous]);

  const dateLabel = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila", weekday: "long", month: "long", day: "numeric", year: "numeric",
  }).format(new Date(`${today}T12:00:00+08:00`));
  const maxCups = Math.max(1, ...summary.top.map((s) => s.quantity));
  const totalStatus = summary.statuses.reduce((n, s) => n + s._count, 0);

  return (
    <main className="ed-page">
      <header className="ed-header">
        <div>
          <div className="ed-eyebrow">ESTYLO COFFEE / OVERVIEW</div>
          <h1>Store Dashboard</h1>
          <p>Here’s what’s happening with your coffee shop today.</p>
          <div className="ed-date"><Icon name="calendar3" /> {dateLabel} · Philippine Time</div>
        </div>
        <div className="ed-actions">
          <button className="ed-refresh" type="button" onClick={refresh} disabled={loading}>
            <Icon name="arrow-clockwise" /> Refresh
          </button>
          <Link to="/reports" className="ed-report-link">View Reports <Icon name="arrow-up-right" /></Link>
        </div>
      </header>

      {error && <div className="alert alert-danger" role="alert">{error} <button type="button" onClick={refresh} className="btn btn-sm btn-outline-danger ms-2">Retry</button></div>}
      {loading && <p className="ed-loading" role="status">Loading live store metrics…</p>}

      <section className="ed-metrics" aria-label="Today’s performance">
        <MetricCard label="Total Sales" icon="currency-exchange" value={loading ? "—" : money(summary.sales.current)} trend={loading ? undefined : summary.sales} />
        <MetricCard label="Orders" icon="bag-check" value={loading ? "—" : summary.orders.current.toLocaleString()} trend={loading ? undefined : summary.orders} />
        <MetricCard label="Cups Served" icon="cup-hot" value={loading ? "—" : summary.cups.current.toLocaleString()} trend={loading ? undefined : summary.cups} />
        <MetricCard label="Avg. Order Value" icon="basket2" value={loading ? "—" : money(Math.round(summary.aov.current))} trend={loading ? undefined : summary.aov} />
      </section>

      <section className="ed-lower-metrics" aria-label="Operational highlights">
        <div className="ed-small-stat"><span className="ed-small-icon"><Icon name="gift" /></span><div><span>Free Cups Served</span><strong>{loading ? "—" : summary.free.toLocaleString()}</strong></div></div>
        <div className="ed-small-stat"><span className="ed-small-icon"><Icon name="check-circle" /></span><div><span>Paid Orders</span><strong>{loading ? "—" : summary.paid.toLocaleString()}</strong></div></div>
        <div className="ed-small-stat"><span className="ed-small-icon"><Icon name="hourglass-split" /></span><div><span>Active Orders</span><strong>{loading ? "—" : summary.open.toLocaleString()}</strong></div></div>
      </section>

      <section className="ed-panels">
        <article className="ed-panel">
          <div className="ed-panel-title"><div><h2>Top Coffee Today</h2><p>Most-served drinks, including free cups</p></div><Link to="/reports">Details <Icon name="arrow-right" /></Link></div>
          {summary.top.filter((s) => s.quantity > 0).length === 0 ? <div className="ed-empty">No cups recorded for today yet.</div> :
            <div className="ed-top-list">{summary.top.filter((s) => s.quantity > 0).slice(0, 6).map((s, i) => (
              <div className="ed-top-item" key={s.productId}>
                <span className="ed-rank">{String(i + 1).padStart(2, "0")}</span>
                <div className="ed-top-name"><div><strong>{s.name}</strong><span>{s.quantity} cups{s.freeCups ? ` · ${s.freeCups} free` : ""}</span></div><div className="ed-progress"><span style={{ width: `${(s.quantity / maxCups) * 100}%` }} /></div></div>
                <strong className="ed-top-sales">{money(s.salesCentavos)}</strong>
              </div>
            ))}</div>}
        </article>
        <article className="ed-panel">
          <div className="ed-panel-title"><div><h2>Order Status</h2><p>Today’s order activity</p></div><Link to="/orders">Manage <Icon name="arrow-right" /></Link></div>
          {totalStatus === 0 ? <div className="ed-empty">No orders recorded for today yet.</div> : <>
            <div className="ed-status-bar" aria-label="Order status distribution">{summary.statuses.filter((s) => s._count > 0).map((s) => <span key={s.status} className={`ed-status-${s.status.toLowerCase()}`} style={{ width: `${(s._count / totalStatus) * 100}%` }} />)}</div>
            <div className="ed-status-list">{summary.statuses.map((s) => <div key={s.status}><span><i className={`ed-status-dot ed-status-${s.status.toLowerCase()}`} />{s.status.replaceAll("_", " ")}</span><strong>{s._count}</strong></div>)}</div>
          </>}
        </article>
      </section>
      <p className="ed-footnote">Revenue includes paid, non-cancelled orders. Cup totals count paid and free drinks from paid, non-cancelled orders. Comparisons use the previous calendar day in Philippine Time. Average order value uses paid orders.</p>
    </main>
  );
}
