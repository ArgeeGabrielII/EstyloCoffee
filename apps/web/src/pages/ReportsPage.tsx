
import { Fragment, useEffect, useMemo, useState } from "react";
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
type SalesView = "coffee" | "addons" | "combined";

type Product = {
  id: string;
  name: string;
};

type Sale = {
  date: string;
  productId: string;
  name: string;
  quantity: number;
  freeCups: number;
  coffeeSalesCentavos: number;
  addonSalesCentavos: number;
  salesCentavos: number;
};

type AddonSale = {
  date: string;
  productId: string;
  addonId: string;
  name: string;
  quantity: number;
  salesCentavos: number;
};

type BreakdownReport = {
  products: Product[];
  sales: Sale[];
  addonSales: AddonSale[];
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
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
  };
}

function datePH() {
  const t = todayPH();

  return [
    t.year,
    String(t.month).padStart(2, "0"),
    String(t.day).padStart(2, "0"),
  ].join("-");
}

function colorFor(id: string) {
  let hash = 0;

  for (const char of id) {
    hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0;
  }

  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 65%, 52%)`;
}

// --------------------------------------------------
// Dashboard
// --------------------------------------------------

function Dashboard() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const from = new Date(`${datePH()}T00:00:00+08:00`);

    api<Report>(
      `/reports?from=${encodeURIComponent(from.toISOString())}`
    )
      .then(setReport)
      .catch((e) => {
        setError(
          e instanceof Error ? e.message : "Unable to load"
        );
      });
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
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
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

        {report?.statuses.map((status) => (
          <div key={status.status} className="report-row">
            <span>{status.status}</span>
            <strong>{status._count}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

// --------------------------------------------------
// Sales Reports
// --------------------------------------------------

function SalesReports() {
  const initial = todayPH();

  const [mode, setMode] = useState<Mode>("daily");
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);

  const [salesView, setSalesView] =
    useState<SalesView>("combined");

  const [breakdownDate, setBreakdownDate] =
    useState(datePH);

  const [report, setReport] =
    useState<BreakdownReport | null>(null);

  const [breakdownReport, setBreakdownReport] =
    useState<BreakdownReport | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [breakdownLoading, setBreakdownLoading] =
    useState(true);

  const [breakdownError, setBreakdownError] =
    useState("");

  // --------------------------------------------------
  // Load Daily / Monthly Charts
  // --------------------------------------------------

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

        const data = await api<BreakdownReport>(
          `/reports/cups?${params.toString()}`
        );

        if (active) setReport(data);
      } catch (e) {
        if (active) {
          setReport(null);
          setError(
            e instanceof Error
              ? e.message
              : "Unable to load reports"
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

  // --------------------------------------------------
  // Load Selected Date Breakdown
  // --------------------------------------------------

  useEffect(() => {
    let active = true;

    const match =
      /^(\d{4})-(\d{2})-(\d{2})$/.exec(breakdownDate);

    if (!match) {
      setBreakdownReport(null);
      setBreakdownLoading(false);
      return;
    }

    async function loadBreakdown() {
      setBreakdownLoading(true);
      setBreakdownError("");

      try {
        const params = new URLSearchParams({
          year: match![1],
          month: String(Number(match![2])),
        });

        const data = await api<BreakdownReport>(
          `/reports/cups?${params.toString()}`
        );

        if (active) setBreakdownReport(data);
      } catch (e) {
        if (active) {
          setBreakdownReport(null);
          setBreakdownError(
            e instanceof Error
              ? e.message
              : "Unable to load daily breakdown"
          );
        }
      } finally {
        if (active) setBreakdownLoading(false);
      }
    }

    void loadBreakdown();

    return () => {
      active = false;
    };
  }, [breakdownDate]);

  // --------------------------------------------------
  // Selected Date Calculations
  // --------------------------------------------------

  const dailySales = useMemo(
    () =>
      (breakdownReport?.sales ?? []).filter(
        (sale) => sale.date === breakdownDate
      ),
    [breakdownReport, breakdownDate]
  );

  const dailyAddonSales = useMemo(
    () =>
      (breakdownReport?.addonSales ?? []).filter(
        (addon) => addon.date === breakdownDate
      ),
    [breakdownReport, breakdownDate]
  );

  const coffeeTotals = useMemo(() => {
    const map = new Map<string, Sale>();

    for (const sale of dailySales) {
      const existing = map.get(sale.productId);

      if (existing) {
        existing.quantity += sale.quantity;
        existing.freeCups += sale.freeCups;
        existing.coffeeSalesCentavos +=
          sale.coffeeSalesCentavos;
        existing.addonSalesCentavos +=
          sale.addonSalesCentavos;
        existing.salesCentavos += sale.salesCentavos;
      } else {
        map.set(sale.productId, { ...sale });
      }
    }

    return map;
  }, [dailySales]);

  const addonsByCoffee = useMemo(() => {
    const map = new Map<string, AddonSale[]>();

    for (const addon of dailyAddonSales) {
      const rows = map.get(addon.productId) ?? [];
      rows.push(addon);
      map.set(addon.productId, rows);
    }

    return map;
  }, [dailyAddonSales]);

  const addonTotals = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        quantity: number;
        cents: number;
      }
    >();

    for (const addon of dailyAddonSales) {
      const existing = map.get(addon.addonId);

      if (existing) {
        existing.quantity += addon.quantity;
        existing.cents += addon.salesCentavos;
      } else {
        map.set(addon.addonId, {
          id: addon.addonId,
          name: addon.name,
          quantity: addon.quantity,
          cents: addon.salesCentavos,
        });
      }
    }

    return [...map.values()].sort(
      (a, b) =>
        b.quantity - a.quantity ||
        a.name.localeCompare(b.name)
    );
  }, [dailyAddonSales]);

  const breakdownProducts = breakdownReport?.products ?? [];

  const totalCoffeeCups = dailySales.reduce(
    (sum, sale) => sum + sale.quantity,
    0
  );

  const totalFreeCups = dailySales.reduce(
    (sum, sale) => sum + sale.freeCups,
    0
  );

  const totalPaidCups =
    totalCoffeeCups - totalFreeCups;

  const totalCoffeeRevenue = dailySales.reduce(
    (sum, sale) => sum + sale.coffeeSalesCentavos,
    0
  );

  const totalAddonQuantity = addonTotals.reduce(
    (sum, addon) => sum + addon.quantity,
    0
  );

  const totalAddonRevenue = addonTotals.reduce(
    (sum, addon) => sum + addon.cents,
    0
  );

  const totalCombinedRevenue =
    totalCoffeeRevenue + totalAddonRevenue;

  const bestSeller = [...breakdownProducts].sort(
    (a, b) =>
      (coffeeTotals.get(b.id)?.quantity ?? 0) -
      (coffeeTotals.get(a.id)?.quantity ?? 0)
  )[0];

  const highestRevenue = [...breakdownProducts].sort(
    (a, b) =>
      (coffeeTotals.get(b.id)?.salesCentavos ?? 0) -
      (coffeeTotals.get(a.id)?.salesCentavos ?? 0)
  )[0];

  // --------------------------------------------------
  // Chart Periods
  // --------------------------------------------------

  const periods = useMemo(() => {
    if (mode === "monthly") {
      return MONTHS.map((name, index) => ({
        key: `${year}-${String(index + 1).padStart(2, "0")}`,
        label: name.slice(0, 3),
        fullName: name,
      }));
    }

    const days = new Date(year, month, 0).getDate();

    return Array.from({ length: days }, (_, index) => {
      const day = index + 1;

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
    const map = new Map<
      string,
      { cups: number; pesos: number }
    >();

    for (const sale of sales) {
      const key = `${sale.date}|${sale.productId}`;

      const previous = map.get(key) ?? {
        cups: 0,
        pesos: 0,
      };

      previous.cups += sale.quantity;
      previous.pesos += sale.salesCentavos / 100;

      map.set(key, previous);
    }

    return map;
  }, [sales]);

  const totalCups = sales.reduce(
    (sum, sale) => sum + sale.quantity,
    0
  );

  const totalSales = sales.reduce(
    (sum, sale) => sum + sale.salesCentavos,
    0
  );

  const now = todayPH();

  const elapsedPeriods =
    mode === "monthly"
      ? year < now.year
        ? 12
        : year === now.year
          ? now.month
          : 0
      : year < now.year ||
          (year === now.year && month < now.month)
        ? periods.length
        : year === now.year && month === now.month
          ? now.day
          : 0;

  const avgCups = elapsedPeriods
    ? totalCups / elapsedPeriods
    : 0;

  const avgSales = elapsedPeriods
    ? totalSales / elapsedPeriods
    : 0;

  // --------------------------------------------------
  // Chart Configuration
  // --------------------------------------------------

  function chartData(metric: "cups" | "pesos") {
    return {
      labels: periods.map((period) => period.label),

      datasets: products.map((product) => ({
        label: product.name,
        data: periods.map(
          (period) =>
            aggregated.get(
              `${period.key}|${product.id}`
            )?.[metric] ?? 0
        ),
        backgroundColor: colorFor(product.id),
        borderWidth: 0,
        stack: "coffee",
        maxBarThickness: 42,
      })),
    };
  }

  function chartOptions(
    metric: "cups" | "pesos"
  ): ChartOptions<"bar"> {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          filter: (item) =>
            Number(item.parsed.y) > 0,

          callbacks: {
            title: (items) =>
              periods[items[0]?.dataIndex]?.fullName ?? "",

            label: (item) => {
              const n = Number(item.parsed.y ?? 0);

              return `${item.dataset.label}: ${
                metric === "cups"
                  ? `${n} cups`
                  : money(Math.round(n * 100))
              }`;
            },

            footer: (items) => {
              const total = items.reduce(
                (sum, item) =>
                  sum + Number(item.parsed.y ?? 0),
                0
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
          grid: {
            display: false,
          },
          ticks: {
            autoSkip: false,
            maxRotation: 0,
          },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            precision:
              metric === "cups" ? 0 : undefined,
            stepSize:
              metric === "cups" ? 1 : undefined,
            callback: (value) =>
              metric === "pesos"
                ? `₱${Number(value).toLocaleString()}`
                : String(value),
          },
          title: {
            display: true,
            text:
              metric === "cups"
                ? "Cups Sold"
                : "Sales (PHP)",
          },
        },
      },
    };
  }

  function navigate(delta: number) {
    if (mode === "monthly") {
      setYear((current) => current + delta);
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
          <p className="text-center py-5">
            Loading chart...
          </p>
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

  // --------------------------------------------------
  // Main Page
  // --------------------------------------------------

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Reports</h1>
          <p>
            Coffee and add-on sales analytics ·
            Philippine Time
          </p>
        </div>
      </div>

      {/* Daily / Monthly Report Controls */}

      <div className="card-estylo mb-4">
        <div className="d-flex flex-wrap align-items-end gap-3">
          <div>
            <label className="form-label fw-semibold">
              Report Period
            </label>

            <div className="btn-group d-flex">
              <button
                type="button"
                className={`btn ${
                  mode === "daily"
                    ? "btn-dark"
                    : "btn-outline-secondary"
                }`}
                onClick={() => setMode("daily")}
              >
                Daily
              </button>

              <button
                type="button"
                className={`btn ${
                  mode === "monthly"
                    ? "btn-dark"
                    : "btn-outline-secondary"
                }`}
                onClick={() => setMode("monthly")}
              >
                Monthly
              </button>
            </div>
          </div>

          {mode === "daily" && (
            <div>
              <label className="form-label fw-semibold">
                Month
              </label>

              <select
                className="form-select"
                value={month}
                onChange={(e) =>
                  setMonth(Number(e.target.value))
                }
              >
                {MONTHS.map((name, index) => (
                  <option key={name} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="form-label fw-semibold">
              Year
            </label>

            <input
              className="form-control"
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) =>
                setYear(Number(e.target.value))
              }
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
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {/* Daily / Monthly Metrics */}

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
        "Number of cups served per coffee variant",
        "cups",
        `${totalCups.toLocaleString()} cups`
      )}

      {renderChart(
        "Sales Report",
        "Coffee and add-on revenue per coffee variant",
        "pesos",
        money(totalSales)
      )}

      {/* Sales Breakdown */}

      <div className="card-estylo mb-4">
        <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
          <div>
            <h4 className="mb-1">Sales Breakdown</h4>
            <p className="muted mb-0">
              Select a category and sales date
              (Philippine Time)
            </p>
          </div>

          <div>
            <label
              className="form-label fw-semibold"
              htmlFor="breakdown-date"
            >
              Sales Date
            </label>

            {/* No wrapping: Today stays beside date */}
            <div
              className="d-flex align-items-center gap-2"
              style={{
                flexWrap: "nowrap",
                width: "max-content",
                maxWidth: "100%",
              }}
            >
              <input
                id="breakdown-date"
                type="date"
                className="form-control"
                style={{
                  width: 165,
                  minWidth: 0,
                  flexShrink: 1,
                }}
                value={breakdownDate}
                onChange={(e) =>
                  setBreakdownDate(e.target.value)
                }
              />

              <button
                type="button"
                className="btn btn-outline-secondary flex-shrink-0"
                onClick={() =>
                  setBreakdownDate(datePH())
                }
              >
                Today
              </button>
            </div>
          </div>
        </div>

        {/* Three Sales Views */}

        <div
          className="d-flex flex-wrap gap-2 mb-3"
          role="group"
          aria-label="Sales breakdown view"
        >
          {([
            ["coffee", "Coffee Sales Only"],
            ["addons", "Add-On Sales Only"],
            ["combined", "Coffee / Add-On Sales"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={salesView === value}
              className={`btn ${
                salesView === value
                  ? "btn-dark"
                  : "btn-outline-secondary"
              }`}
              onClick={() => setSalesView(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {breakdownError && (
          <div className="alert alert-danger" role="alert">
            {breakdownError}
          </div>
        )}

        {breakdownLoading ? (
          <p>Loading daily sales...</p>
        ) : !breakdownReport ? (
          <p className="empty">
            Daily sales are unavailable.
          </p>
        ) : (
          <>
            {/* Free Cups Summary */}

            <div className="metric-grid mb-4">
              {[
                ["Total Cups Served", totalCoffeeCups],
                ["Paid Cups", totalPaidCups],
                ["Free Cups Served", totalFreeCups],
              ].map(([label, value]) => (
                <div className="card-estylo" key={label}>
                  <div className="metric-label">
                    {label}
                  </div>
                  <div className="metric-value">
                    {value.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            {/* Coffee Sales Only */}

            {salesView === "coffee" && (
              <>
                <div className="table-responsive">
                  <table className="table align-middle">
                    <thead>
                      <tr>
                        <th>Coffee</th>
                        <th className="text-end">
                          Cups Served
                        </th>
                        <th className="text-end">
                          Free Cups
                        </th>
                        <th className="text-end">
                          Coffee Sales
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {breakdownProducts.map((product) => {
                        const row =
                          coffeeTotals.get(product.id);

                        return (
                          <tr key={product.id}>
                            <td>{product.name}</td>
                            <td className="text-end">
                              {row?.quantity ?? 0}
                            </td>
                            <td className="text-end">
                              {row?.freeCups ?? 0}
                            </td>
                            <td className="text-end">
                              {money(
                                row?.coffeeSalesCentavos ?? 0
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>

                    <tfoot>
                      <tr className="fw-bold">
                        <td>Total</td>
                        <td className="text-end">
                          {totalCoffeeCups}
                        </td>
                        <td className="text-end">
                          {totalFreeCups}
                        </td>
                        <td className="text-end">
                          {money(totalCoffeeRevenue)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <p className="muted mb-0">
                  Base coffee revenue only. Add-ons
                  are excluded. Free cups count toward
                  cups served but have no base revenue.
                </p>
              </>
            )}

            {/* Add-On Sales Only */}

            {salesView === "addons" && (
              <>
                <div className="table-responsive">
                  <table className="table align-middle">
                    <thead>
                      <tr>
                        <th>Add-on</th>
                        <th className="text-end">
                          Quantity Sold
                        </th>
                        <th className="text-end">
                          Add-on Sales
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {addonTotals.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="text-center text-muted"
                          >
                            No add-ons sold on this date.
                          </td>
                        </tr>
                      ) : (
                        addonTotals.map((addon) => (
                          <tr key={addon.id}>
                            <td>{addon.name}</td>
                            <td className="text-end">
                              {addon.quantity}
                            </td>
                            <td className="text-end">
                              {money(addon.cents)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>

                    <tfoot>
                      <tr className="fw-bold">
                        <td>Total</td>
                        <td className="text-end">
                          {totalAddonQuantity}
                        </td>
                        <td className="text-end">
                          {money(totalAddonRevenue)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <p className="muted mb-0">
                  Add-on revenue includes extras
                  purchased with Free Drinks.
                </p>
              </>
            )}

            {/* Combined Coffee / Add-On Sales */}

            {salesView === "combined" && (
              <>
                <div className="table-responsive">
                  <table className="table align-middle">
                    <thead>
                      <tr>
                        <th>Coffee / Add-on</th>
                        <th className="text-end">
                          Cups / Qty
                        </th>
                        <th className="text-end">
                          Free Cups
                        </th>
                        <th className="text-end">
                          Sales
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {breakdownProducts.map((product) => {
                        const row =
                          coffeeTotals.get(product.id);

                        const addons =
                          addonsByCoffee.get(product.id) ?? [];

                        return (
                          <Fragment key={product.id}>
                            <tr>
                              <td>
                                <span
                                  style={{
                                    display: "inline-block",
                                    width: 12,
                                    height: 12,
                                    marginRight: 8,
                                    borderRadius: 3,
                                    background: colorFor(
                                      product.id
                                    ),
                                  }}
                                />
                                {product.name}
                              </td>

                              <td className="text-end">
                                {row?.quantity ?? 0}
                              </td>

                              <td className="text-end">
                                {row?.freeCups ?? 0}
                              </td>

                              <td className="text-end">
                                {money(
                                  row?.coffeeSalesCentavos ?? 0
                                )}
                              </td>
                            </tr>

                            {addons.map((addon) => (
                              <tr
                                key={`${product.id}-${addon.addonId}`}
                                className="text-muted"
                              >
                                <td className="ps-4">
                                  ↳ {addon.name}{" "}
                                  <small>(add-on)</small>
                                </td>

                                <td className="text-end">
                                  {addon.quantity}
                                </td>

                                <td className="text-end">
                                  —
                                </td>

                                <td className="text-end">
                                  {money(
                                    addon.salesCentavos
                                  )}
                                </td>
                              </tr>
                            ))}
                          </Fragment>
                        );
                      })}
                    </tbody>

                    <tfoot>
                      <tr className="fw-bold">
                        <td>Total Coffee + Add-ons</td>
                        <td className="text-end">
                          {totalCoffeeCups} cups ·{" "}
                          {totalAddonQuantity} add-ons
                        </td>
                        <td className="text-end">
                          {totalFreeCups}
                        </td>
                        <td className="text-end">
                          {money(totalCombinedRevenue)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <p className="muted mb-0">
                  Coffee rows show base coffee revenue.
                  Indented add-on rows show extra revenue.
                  Combined totals count each amount once.
                </p>
              </>
            )}

            {salesView !== "addons" && (
              <div className="mt-3">
                <p>
                  <strong>Best-selling coffee:</strong>{" "}
                  {bestSeller &&
                  (coffeeTotals.get(bestSeller.id)?.quantity ?? 0) > 0
                    ? bestSeller.name
                    : "No sales yet"}
                </p>

                <p className="mb-0">
                  <strong>
                    Highest revenue coffee:
                  </strong>{" "}
                  {highestRevenue &&
                  (coffeeTotals.get(highestRevenue.id)?.salesCentavos ?? 0) > 0
                    ? highestRevenue.name
                    : "No sales yet"}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <p className="muted">
        Reports include paid, non-cancelled orders.
        Free Drinks count toward cups served but
        contribute zero base coffee revenue.
        Their paid add-ons are included in add-on
        and combined sales. All dates use Philippine Time.
      </p>
    </div>
  );
}

export function ReportsPage({
  dashboard = false,
}: {
  dashboard?: boolean;
}) {
  return dashboard
    ? <Dashboard />
    : <SalesReports />;
}
