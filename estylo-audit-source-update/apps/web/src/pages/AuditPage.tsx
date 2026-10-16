import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";

type Audit = {
  id: string;
  event: string;
  entityId: string;
  userId: string;
  username: string;
  displayName: string;
  createdAt: string;
};
type Result = { rows: Audit[]; total: number; page: number; pageSize: number; pages: number };

export function AuditPage() {
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    api<Result>(`/audit?page=${page}&search=${encodeURIComponent(search)}`)
      .then((data) => { if (alive) setResult(data); })
      .catch((e: Error) => { if (alive) { setError(e.message); setResult(null); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [page, search]);

  function submit(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchText.trim());
  }

  const pages = result?.pages ?? 1;
  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Audit log</h1>
          <p>30 records per page · Search all fields · * or % for any characters, ? or _ for one character</p>
        </div>
      </div>
      <form className="d-flex gap-2 mb-3 flex-wrap" onSubmit={submit}>
        <input
          className="form-control"
          style={{ flex: "1 1 240px" }}
          aria-label="Search all audit log fields"
          placeholder="Search time, actor, event, reference, IDs…"
          maxLength={150}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <button className="btn btn-estylo" type="submit">Search</button>
        <button className="btn btn-outline-secondary" type="button" onClick={() => { setSearchText(""); setSearch(""); setPage(1); }}>Clear</button>
      </form>
      {error && <div role="alert" className="alert alert-danger">{error}</div>}
      <p className="small text-secondary" role="status">
        {loading ? "Loading…" : `${result?.total ?? 0} matching audit records`}
      </p>
      <div className="card-estylo table-wrap">
        <table className="table">
          <thead><tr><th>Time</th><th>Actor</th><th>Username</th><th>Event</th><th>Reference</th><th>User ID</th><th>Log ID</th></tr></thead>
          <tbody>
            {(result?.rows ?? []).map((a) => (
              <tr key={a.id}>
                <td>{new Date(a.createdAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</td>
                <td>{a.displayName}</td><td>{a.username}</td><td>{a.event}</td>
                <td className="text-break">{a.entityId}</td>
                <td className="text-break">{a.userId}</td><td className="text-break">{a.id}</td>
              </tr>
            ))}
            {!loading && !result?.rows.length && <tr><td colSpan={7}>No matching audit logs.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mt-3">
        <span>Page {page} of {pages}</span>
        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-outline-secondary" disabled={loading || page <= 1} onClick={() => setPage(1)}>First</button>
          <button className="btn btn-outline-secondary" disabled={loading || page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <button className="btn btn-outline-secondary" disabled={loading || page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
          <button className="btn btn-outline-secondary" disabled={loading || page >= pages} onClick={() => setPage(pages)}>Last</button>
        </div>
      </div>
    </div>
  );
}
