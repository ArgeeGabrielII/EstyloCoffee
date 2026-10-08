import { useAutoRefresh } from "../hooks/useAutoRefresh";

type QueueStatus = "NEW" | "PREPARING" | "READY";

type PublicOrder = {
  id: string;
  customer: string;
  status: QueueStatus;
};

const labels: Record<QueueStatus, string> = {
  NEW: "In queue",
  PREPARING: "Preparing",
  READY: "Ready",
};

const colors: Record<QueueStatus, string> = {
  NEW: "text-bg-secondary",
  PREPARING: "text-bg-warning",
  READY: "text-bg-success",
};

export function PublicQueuePage() {
  const { data, error, loading } =
    useAutoRefresh<PublicOrder[]>("/queue/public");

  const rows = data || [];

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#111",
        color: "#fff",
        padding: "clamp(16px, 4vw, 48px)",
      }}
    >
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <header className="text-center mb-4">
          <img
            src="/estylo-logo.png"
            alt="Estylo Coffee"
            style={{
              width: 90,
              height: 90,
              objectFit: "contain",
            }}
          />
          <h1 className="mt-3">Order queue</h1>
          <p style={{ color: "#d7bd76" }}>
            Your coffee is on its way.
          </p>
        </header>

        {error && (
          <div role="alert" className="alert alert-warning">
            Queue updates are temporarily unavailable.
            Automatically reconnecting.
          </div>
        )}

        {loading ? (
          <p className="text-center">Loading queue…</p>
        ) : !rows.length ? (
          <p className="text-center">
            No orders currently in the queue.
          </p>
        ) : (
          <div
            style={{
              border: "1px solid #444",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <table
              style={{
                width: "100%",
                tableLayout: "fixed",
                borderCollapse: "collapse",
                fontSize: "clamp(18px, 2.5vw, 30px)",
              }}
            >
              <thead>
                <tr style={{ background: "#262626" }}>
                  <th style={{ padding: 16, width: "60%" }}>
                    Name
                  </th>
                  <th style={{ padding: 16 }}>Status</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((order) => (
                  <tr
                    key={order.id}
                    style={{ borderTop: "1px solid #444" }}
                  >
                    <td
                      style={{
                        padding: 16,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {order.customer}
                    </td>
                    <td style={{ padding: 16 }}>
                      <span
                        className={`badge ${colors[order.status]}`}
                        style={{ whiteSpace: "normal" }}
                      >
                        {labels[order.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}