
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

type Product = {
  id: string;
  name: string;
};

type Sale = {
  date: string;
  productId: string;
  name: string;
  quantity: number;
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
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
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
  const today = todayPH();

  return [
    today.year,
    String(today.month).padStart(2, "0"),
    String(today.day).padStart(2, "0"),
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
  const today = todayPH();

  const [mode, setMode] = useState<Mode>("daily");
  const [year, setYear] = useState(today.year);
  const [month, setMonth] = useState(today.month);

  // The daily breakdown has its own independent date.
  const [breakdownDate, setBreakdownDate] = useState(datePH);

  const [report, setReport] =
    useState<BreakdownReport | null>(null);

  const [breakdownReport, setBreakdownReport] =
    useState<BreakdownReport | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [breakdownLoading, setBreakdownLoading] =
    useState(true);

  const [breakdownError, setBreakdownError] = useState("");

  // --------------------------------------------------
  // Fetch Daily/Monthly Chart Data
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

        const result = await api<BreakdownReport>(
          `/reports/cups?${params.toString()}`
        );

        if (active) {
          setReport(result);
        }
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
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [mode, year, month]);

  // --------------------------------------------------
  // Fetch Data for Selected Breakdown Date
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

        const result = await api<BreakdownReport>(
          `/reports/cups?${params.toString()}`
        );

        if (active) {
          setBreakdownReport(result);
        }
      } catch (e) {
        if (active) {
          setBreakdownReport(null);
          setBreakdownError(
            e instanceof Error
              ? e.message
              : "Unable to load daily sales"
          );
        }
      } finally {
        if (active) {
          setBreakdownLoading(false);
        }
      }
    }

    void loadBreakdown();

    return () => {
      active = false;
    };
  }, [breakdownDate]);

  // --------------------------------------------------
  // Selected-Day Coffee Sales
  // --------------------------------------------------

  const breakdownSales = useMemo(
    () =>
      (breakdownReport?.sales ?? []).filter(
        (sale) => sale.date === breakdownDate
      ),
    [breakdownReport, breakdownDate]
  );

  const breakdownProductTotals = useMemo(() => {
    const map = new Map<
      string,
      { cups: number; cents: number }
    >();

    for (const sale of breakdownSales) {
      const current = map.get(sale.productId) ?? {
        cups: 0,
        cents: 0,
      };

      current.cups += sale.quantity;
      current.cents += sale.salesCentavos;

      map.set(sale.productId, current);
    }

    return map;
  }, [breakdownSales]);

  const breakdownCups = breakdownSales.reduce(
    (sum, sale) => sum + sale.quantity,
    0
  );

  const breakdownCentavos = breakdownSales.reduce(
    (sum, sale) => sum + sale.salesCentavos,
    0
  );

  const breakdownProducts = breakdownReport?.products ?? [];

  const breakdownBestSeller = [...breakdownProducts].sort(
    (a, b) =>
      (breakdownProductTotals.get(b.id)?.cups ?? 0) -
      (breakdownProductTotals.get(a.id)?.cups ?? 0)
  )[0];

  const breakdownHighestRevenue = [
    ...breakdownProducts,
  ].sort(
    (a, b) =>
      (breakdownProductTotals.get(b.id)?.cents ?? 0) -
      (breakdownProductTotals.get(a.id)?.cents ?? 0)
  )[0];

  // --------------------------------------------------
  // Selected-Day Add-on Sales
  // --------------------------------------------------

  const dailyAddonSales = useMemo(
    () =>
      (breakdownReport?.addonSales ?? []).filter(
        (addon) => addon.date === breakdownDate
      ),
    [breakdownReport, breakdownDate]
  );

  // Add-ons grouped by the coffee they were sold with.
  const addonsByCoffee = useMemo(() => {
    const map = new Map<string, AddonSale[]>();

    for (const addon of dailyAddonSales) {
      const rows = map.get(addon.productId) ?? [];
      rows.push(addon);
      map.set(addon.productId, rows);
    }

    return map;
  }, [dailyAddonSales]);

  // Add-ons aggregated across all coffee variants.
  const addonTotals = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        quantity: number;
        cents: number;
      }
    >();

    for (const addon of dailyAddonSales) {
      const current = map.get(addon.addonId) ?? {
        name: addon.name,
        quantity: 0,
        cents: 0,
      };

      current.quantity += addon.quantity;
      current.cents += addon.salesCentavos;

      map.set(addon.addonId, current);
    }

    return Array.from(map.entries())
      .map(([id, value]) => ({
        id,
        ...value,
      }))
      .sort(
        (a, b) =>
          b.quantity - a.quantity ||
          a.name.localeCompare(b.name)
      );
  }, [dailyAddonSales]);

  const addonQuantity = addonTotals.reduce(
    (sum, addon) => sum + addon.quantity,
    0
  );

  const addonRevenue = addonTotals.reduce(
    (sum, addon) => sum + addon.cents,
    0
  );

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
        key: [
          year,
          String(month).padStart(2, "0"),
          String(day).padStart(2, "0"),
        ].join("-"),
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
    (sum, row) => sum + row.quantity,
    0
  );

  const totalSales = sales.reduce(
    (sum, row) => sum + row.salesCentavos,
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
  // Chart Data
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

    const next = new Date(
      year,
      month - 1 + delta,
      1
    );

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
            <p className="muted mb-0">
              {description}
            </p>
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
                minWidth:
                  mode === "daily" ? 980 : 600,
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
  // Page
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

      {/* Report period controls */}

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
                  <option
                    key={name}
                    value={index + 1}
                  >
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
              const current = todayPH();
              setYear(current.year);
              setMonth(current.month);
            }}
          >
            Current Period
          </button>
        </div>
      </div>

      {error && (
        <div
          className="alert alert-danger"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Sales summary */}

      <div className="metric-grid mb-4">
        {[
          [
            "Total Cups Sold",
            totalCups.toLocaleString(),
          ],
          ["Total Sales", money(totalSales)],
          ["Average Cups", avgCups.toFixed(1)],
          [
            "Average Sales",
            money(Math.round(avgSales)),
          ],
        ].map(([label, value]) => (
          <div
            className="card-estylo"
            key={label}
          >
            <div className="metric-label">
              {label}
            </div>
            <div className="metric-value">
              {value}
            </div>
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

      {/* Coffee Sales Breakdown */}

      <div className="card-estylo mb-4">
        <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
          <div>
            <h4 className="mb-1">
              Coffee Sales Breakdown
            </h4>
            <p className="muted mb-0">
              Coffee and add-on sales for one selected day
              (Philippine Time)
            </p>
          </div>

          <div>
            <label
              className="form-label fw-semibold"
              htmlFor="breakdown-date"
            >
              Sales date
            </label>

            <div className="d-flex flex-wrap gap-2">
              <input
                id="breakdown-date"
                type="date"
                className="form-control"
                value={breakdownDate}
                onChange={(e) =>
                  setBreakdownDate(e.target.value)
                }
              />

              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() =>
                  setBreakdownDate(datePH())
                }
              >
                Today
              </button>
            </div>
          </div>
        </div>

        {breakdownError && (
          <div
            className="alert alert-danger"
            role="alert"
          >
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
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>Coffee / Add-on</th>
                    <th className="text-end">
                      Cups / Qty
                    </th>
                    <th className="text-end">
                      Sales
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {breakdownProducts.map((product) => {
                    const totals =
                      breakdownProductTotals.get(
                        product.id
                      );

                    const coffeeAddons =
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
                            {totals?.cups ?? 0}
                          </td>

                          <td className="text-end">
                            {money(totals?.cents ?? 0)}
                          </td>
                        </tr>

                        {coffeeAddons.map((addon) => (
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
                    <td>Total</td>

                    <td className="text-end">
                      {breakdownCups} cups
                    </td>

                    <td className="text-end">
                      {money(breakdownCentavos)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <p className="muted">
              Coffee sales include paid add-ons.
              The indented add-on rows are included
              in their parent coffee totals.
            </p>

            <div className="mt-3">
              <p>
                <strong>
                  Best-selling coffee:
                </strong>{" "}
                {breakdownBestSeller &&
                (breakdownProductTotals.get(
                  breakdownBestSeller.id
                )?.cups ?? 0) > 0
                  ? breakdownBestSeller.name
                  : "No sales yet"}
              </p>

              <p className="mb-0">
                <strong>
                  Highest revenue coffee:
                </strong>{" "}
                {breakdownHighestRevenue &&
                (breakdownProductTotals.get(
                  breakdownHighestRevenue.id
                )?.cents ?? 0) > 0
                  ? breakdownHighestRevenue.name
                  : "No sales yet"}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Add-on Sales Breakdown */}

      <div className="card-estylo mb-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div>
            <h4 className="mb-1">
              Add-on Sales Breakdown
            </h4>

            <p className="muted mb-0">
              Sales for {breakdownDate} (Philippine Time)
            </p>
          </div>

          <strong>
            {addonQuantity} add-ons ·{" "}
            {money(addonRevenue)}
          </strong>
        </div>

        {breakdownLoading ? (
          <p>Loading add-on sales...</p>
        ) : breakdownError ? (
          <div
            className="alert alert-danger"
            role="alert"
          >
            {breakdownError}
          </div>
        ) : !breakdownReport ? (
          <p className="empty">
            Add-on sales are unavailable.
          </p>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th>Add-on</th>
                  <th className="text-end">
                    Quantity Sold
                  </th>
                  <th className="text-end">
                    Sales
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
                    {addonQuantity}
                  </td>

                  <td className="text-end">
                    {money(addonRevenue)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <p className="muted mb-0">
          Add-on revenue is already included in
          coffee sales. Do not add these totals
          together.
        </p>
      </div>

      <p className="muted">
        Reports include paid, non-cancelled orders.
        Sales use recorded order-item prices and
        add-on prices. Free Drinks have zero base-drink
        revenue, but their paid add-ons are included.
        Dates without sales, including future dates,
        show zero values.
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
