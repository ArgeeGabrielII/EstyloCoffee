import { useEffect, useState } from "react";
import { api } from "../api/client";
type Audit = {
  id: string;
  event: string;
  entityId: string;
  createdAt: string;
  user: { displayName: string };
};
export function AuditPage() {
  const [rows, setRows] = useState<Audit[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    api<Audit[]>("/audit")
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Audit log</h1>
          <p>Latest 200 actions</p>
        </div>
      </div>
      {error && (
        <div role="alert" className="alert alert-danger">
          {error}
        </div>
      )}
      <div className="card-estylo table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Actor</th>
              <th>Event</th>
              <th>Reference</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>{new Date(a.createdAt).toLocaleString()}</td>
                <td>{a.user.displayName}</td>
                <td>{a.event}</td>
                <td>{a.entityId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
