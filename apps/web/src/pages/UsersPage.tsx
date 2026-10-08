import { FormEvent, useEffect, useState } from "react";
import { api, User } from "../api/client";
import { useAuth } from "../auth/AuthContext";
type TeamUser = User & { active: boolean };
export function UsersPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<TeamUser[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setRows(await api<TeamUser[]>("/users"));
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError("");
    try {
      await api("/users", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      form.reset();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
  async function toggle(u: TeamUser) {
    setBusy(true);
    try {
      await api("/users/" + u.id, {
        method: "PATCH",
        body: JSON.stringify({ active: !u.active }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page">
      <div className="page-title">
        <h1>Users</h1>
      </div>
      {error && (
        <div role="alert" className="alert alert-danger">
          {error}
        </div>
      )}
      <form className="card-estylo mb-4" onSubmit={submit}>
        <div className="row g-3">
          {[
            ["username", "Username", "text"],
            ["displayName", "Display name", "text"],
            ["password", "Password (12+ characters)", "password"],
          ].map(([name, label, type]) => (
            <div className="col-md-4" key={name}>
              <label htmlFor={name}>{label}</label>
              <input
                id={name}
                className="form-control"
                name={name}
                type={type}
                minLength={
                  name === "password" ? 12 : name === "username" ? 3 : 1
                }
                required
                autoComplete={name === "password" ? "new-password" : "off"}
              />
            </div>
          ))}
          <div className="col-md-4">
            <label htmlFor="role">Role</label>
            <select id="role" className="form-select" name="role">
              <option>CASHIER</option>
              <option>ADMIN</option>
            </select>
          </div>
        </div>
        <button className="btn btn-estylo mt-3" disabled={busy}>
          Create user
        </button>
      </form>
      <div className="card-estylo table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Role</th>
              <th>Access</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>{u.displayName}</td>
                <td>{u.username}</td>
                <td>{u.role}</td>
                <td>
                  <button
                    className="btn btn-outline-secondary"
                    disabled={busy || u.id === user?.id}
                    onClick={() => toggle(u)}
                  >
                    {u.active ? "Disable" : "Enable"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
