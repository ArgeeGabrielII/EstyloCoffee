
import { useEffect, useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  type ChartOptions,
} from "chart.js";
import { api, money } from "../api/client";
import type { Report } from "../types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
);

type Mode = "daily" | "monthly";
type Product = { id: string; name: string };

type Sale = {
  date: string;
  productId: string;
  name: string;
  quantity: number;
  salesCentavos: number;
};

type BreakdownReport = {
  products: Product[];
  sales: Sale[];
};

const MONTHS = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
];

function todayPH() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
  };
}

function colorFor(id: string) {
  let hash = 0;

  for (const char of id) {
    hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0;
  }

  const hue = ((hash % 360) + 360) % 360;

  return `hsl(${hue}, 65%, 52%)`;
}

function Dashboard() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const today = todayPH();
    const date = `${today.year}-${String(today.month).padStart(2, "0")}-${String(today.day).padStart(2, "0")}`;

    const from = new Date(`${date}T00:00:00+08:00`);

    api<Report>(`/reports?from=${encodeURIComponent(from.toISOString())}`)
      .then(setReport)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Unable to load")
      );
  }, []);

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Dashboard</h1>
          <p>Today at Estylo Coffee</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger">{error}</div>
      )}

      <div className="metric-grid mb-4">
        {[
          ["Orders", report?.count ?? 0],
          ["Paid Sales", money(report?.paidCentavos ?? 0)],
          ["Paid Orders", report?.paidCount ?? 0],
          ["In Progress", report?.open ?? 0],
        ].map(([label, value]) => (
          <div className="card-estylo" key={label}>
            <div className="metric-label">{label}</div>
            <div className="metric-value">{value}</div>
          </div>
        ))}
      </div>

      <div className="card-estylo">
        <h5>Order Status Breakdown</h5>
        {report?.statuses.map((s) => (
          <div key={s.status} className="report-row">
            <span>{s.status}</span>
            <strong>{s._count}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function SalesReports() {
  const today = todayPH();

  const [mode, setMode] = useState<Mode>("daily");
  const [year, setYear] = useState(today.year);
  const [month, setMonth] = useState(today.month);
  const [report, setReport] = useState<BreakdownReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          year: String(year),
        });

        if (mode === "daily") {
          params.set("month", String(month));
        }

        const result = await api<BreakdownReport>(
          `/reports/cups?${params.toString()}`
        );

        if (active) setReport(result);
      } catch (e) {
        if (active) {
          setReport(null);
          setError(
            e instanceof Error ? e.message : "Unable to load reports"
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [mode, year, month]);

  const periods = useMemo(() => {
    if (mode === "monthly") {
      return MONTHS.map((name, index) => ({
        key: `${year}-${String(index + 1).padStart(2, "0")}`,
        label: name.slice(0, 3),
        fullName: name,
      }));
    }

    const days = new Date(year, month, 0).getDate();

    return Array.from({ length: days }, (_, i) => {
      const day = i + 1;

      return {
        key: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        label: String(day),
        fullName: `${MONTHS[month - 1]} ${day}`,
      };
    });
  }, [mode, year, month]);

  const products = report?.products ?? [];
  const sales = report?.sales ?? [];

  const aggregated = useMemo(() => {
    const map = new Map<string, { cups: number; pesos: number }>();

    for (const sale of sales) {
      const key = `${sale.date}|${sale.productId}`;
      const previous = map.get(key) ?? { cups: 0, pesos: 0 };

      previous.cups += sale.quantity;
      previous.pesos += sale.salesCentavos / 100;

      map.set(key, previous);
    }

    return map;
  }, [sales]);

  const totalCups = sales.reduce(
    (sum, row) => sum + row.quantity, 0
  );

  const totalSales = sales.reduce(
    (sum, row) => sum + row.salesCentavos, 0
  );

  const now = todayPH();

  const elapsedPeriods =
    mode === "monthly"
      ? year < now.year ? 12 : year === now.year ? now.month : 0
      : year < now.year || (year === now.year && month < now.month)
        ? periods.length
        : year === now.year && month === now.month
          ? now.day
          : 0;

  const avgCups = elapsedPeriods ? totalCups / elapsedPeriods : 0;
  const avgSales = elapsedPeriods ? totalSales / elapsedPeriods : 0;

  const productTotals = useMemo(() => {
    const map = new Map<string, { cups: number; cents: number }>();

    for (const sale of sales) {
      const entry = map.get(sale.productId) ?? { cups: 0, cents: 0 };
      entry.cups += sale.quantity;
      entry.cents += sale.salesCentavos;
      map.set(sale.productId, entry);
    }

    return map;
  }, [sales]);

  const bestSeller = [...products].sort(
    (a, b) =>
      (productTotals.get(b.id)?.cups ?? 0) -
      (productTotals.get(a.id)?.cups ?? 0)
  )[0];

  const highestRevenue = [...products].sort(
    (a, b) =>
      (productTotals.get(b.id)?.cents ?? 0) -
      (productTotals.get(a.id)?.cents ?? 0)
  )[0];

  function chartData(metric: "cups" | "pesos") {
    return {
      labels: periods.map((p) => p.label),
      datasets: products.map((product) => ({
        label: product.name,
        data: periods.map(
          (period) =>
            aggregated.get(`${period.key}|${product.id}`)?.[metric] ?? 0
        ),
        backgroundColor: colorFor(product.id),
        borderWidth: 0,
        stack: "coffee",
        maxBarThickness: 42,
      })),
    };
  }

  function chartOptions(metric: "cups" | "pesos"): ChartOptions<"bar"> {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          filter: (item) => Number(item.parsed.y) > 0,
          callbacks: {
            title: (items) =>
              periods[items[0]?.dataIndex]?.fullName ?? "",
            label: (item) => {
              const n = Number(item.parsed.y ?? 0);
              return `${item.dataset.label}: ${
                metric === "cups" ? `${n} cups` : money(Math.round(n * 100))
              }`;
            },
            footer: (items) => {
              const total = items.reduce(
                (sum, item) => sum + Number(item.parsed.y ?? 0), 0
              );
              return `Total: ${
                metric === "cups"
                  ? `${total} cups`
                  : money(Math.round(total * 100))
              }`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { autoSkip: false, maxRotation: 0 },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            precision: metric === "cups" ? 0 : undefined,
            stepSize: metric === "cups" ? 1 : undefined,
            callback: (value) =>
              metric === "pesos" ? `₱${Number(value).toLocaleString()}` : String(value),
          },
          title: {
            display: true,
            text: metric === "cups" ? "Cups Sold" : "Sales (PHP)",
          },
        },
      },
    };
  }

  function navigate(delta: number) {
    if (mode === "monthly") {
      setYear((y) => y + delta);
      return;
    }

    const next = new Date(year, month - 1 + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1);
  }

  function renderChart(
    title: string,
    description: string,
    metric: "cups" | "pesos",
    total: string
  ) {
    return (
      <div className="card-estylo mb-4">
        <div className="d-flex justify-content-between flex-wrap gap-2 mb-3">
          <div>
            <h4>{title}</h4>
            <p className="muted mb-0">{description}</p>
          </div>
          <strong>{total}</strong>
        </div>

        {loading ? (
          <p className="text-center py-5">Loading chart...</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div
              style={{
                minWidth: mode === "daily" ? 980 : 600,
                height: 420,
              }}
            >
              <Bar
                data={chartData(metric)}
                options={chartOptions(metric)}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Reports</h1>
          <p>Coffee sales analytics · Philippine Time</p>
        </div>
      </div>

      <div className="card-estylo mb-4">
        <div className="d-flex flex-wrap align-items-end gap-3">
          <div>
            <label className="form-label fw-semibold">
              Report Period
            </label>
            <div className="btn-group d-flex">
              <button
                type="button"
                className={`btn ${mode === "daily" ? "btn-dark" : "btn-outline-secondary"}`}
                onClick={() => setMode("daily")}
              >
                Daily
              </button>
              <button
                type="button"
                className={`btn ${mode === "monthly" ? "btn-dark" : "btn-outline-secondary"}`}
                onClick={() => setMode("monthly")}
              >
                Monthly
              </button>
            </div>
          </div>

          {mode === "daily" && (
            <div>
              <label className="form-label fw-semibold">Month</label>
              <select
                className="form-select"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {MONTHS.map((name, i) => (
                  <option key={name} value={i + 1}>{name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="form-label fw-semibold">Year</label>
            <input
              className="form-control"
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              style={{ width: 120 }}
            />
          </div>

          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => navigate(-1)}
          >
            Previous
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => navigate(1)}
          >
            Next
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => {
              const t = todayPH();
              setYear(t.year);
              setMonth(t.month);
            }}
          >
            Current Period
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">{error}</div>
      )}

      <div className="metric-grid mb-4">
        {[
          ["Total Cups Sold", totalCups.toLocaleString()],
          ["Total Sales", money(totalSales)],
          ["Average Cups", avgCups.toFixed(1)],
          ["Average Sales", money(Math.round(avgSales))],
        ].map(([label, value]) => (
          <div className="card-estylo" key={label}>
            <div className="metric-label">{label}</div>
            <div className="metric-value">{value}</div>
          </div>
        ))}
      </div>

      {renderChart(
        "Cups Sold Report",
        "Number of cups sold per coffee variant",
        "cups",
        `${totalCups.toLocaleString()} cups`
      )}

      {renderChart(
        "Sales Report",
        "Revenue per coffee variant, including selected add-ons",
        "pesos",
        money(totalSales)
      )}

      <div className="card-estylo mb-4">
        <h4 className="mb-3">Coffee Sales Breakdown</h4>

        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th>Coffee</th>
                <th className="text-end">Cups Sold</th>
                <th className="text-end">Sales</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const totals = productTotals.get(product.id);

                return (
                  <tr key={product.id}>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          width: 12,
                          height: 12,
                          marginRight: 8,
                          borderRadius: 3,
                          background: colorFor(product.id),
                        }}
                      />
                      {product.name}
                    </td>
                    <td className="text-end">
                      {totals?.cups ?? 0}
                    </td>
                    <td className="text-end">
                      {money(totals?.cents ?? 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="fw-bold">
                <td>Total</td>
                <td className="text-end">{totalCups}</td>
                <td className="text-end">{money(totalSales)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-3">
          <p>
            <strong>Best-selling coffee:</strong>{" "}
            {bestSeller && (productTotals.get(bestSeller.id)?.cups ?? 0) > 0
              ? bestSeller.name
              : "No sales yet"}
          </p>
          <p className="mb-0">
            <strong>Highest revenue coffee:</strong>{" "}
            {highestRevenue &&
            (productTotals.get(highestRevenue.id)?.cents ?? 0) > 0
              ? highestRevenue.name
              : "No sales yet"}
          </p>
        </div>
      </div>

      <p className="muted">
        Reports include paid, non-cancelled orders. Sales are calculated
        from recorded order-item prices and add-ons. Dates without sales,
        including future dates, appear with zero values.
      </p>
    </div>
  );
}

export function ReportsPage({
  dashboard = false,
}: {
  dashboard?: boolean;
}) {
  return dashboard ? <Dashboard /> : <SalesReports />;
}
