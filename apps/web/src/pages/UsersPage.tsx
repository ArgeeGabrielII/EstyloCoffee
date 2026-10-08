
import { FormEvent, useEffect, useState } from "react";
import { api, User } from "../api/client";
import { useAuth } from "../auth/AuthContext";

type TeamUser = User & {
  active: boolean;
};

export function UsersPage() {
  const { user } = useAuth();

  const [rows, setRows] = useState<TeamUser[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<
    "ADMIN" | "CASHIER" | "GUEST"
  >("CASHIER");
  const [copiedId, setCopiedId] = useState("");

  async function load() {
    const users = await api<TeamUser[]>("/users");
    setRows(users);
  }

  useEffect(() => {
    load().catch((e) =>
      setError(
        e instanceof Error ? e.message : "Unable to load users"
      )
    );
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const form = e.currentTarget;
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const values = Object.fromEntries(new FormData(form));

      await api("/users", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          role,
        }),
      });

      form.reset();
      setRole("CASHIER");

      await load();

      setMessage(
        "User created successfully. You can copy the Account ID below."
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to create user"
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggle(u: TeamUser) {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      await api("/users/" + u.id, {
        method: "PATCH",
        body: JSON.stringify({
          active: !u.active,
        }),
      });

      await load();

      setMessage(
        `${u.displayName} was ${
          u.active ? "disabled" : "enabled"
        }.`
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to update user"
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyAccountId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setMessage("Account ID copied to clipboard.");
      setError("");
    } catch {
      setError(
        "Could not copy automatically. Please select and copy the Account ID."
      );
    }
  }

  const guestAccounts = rows.filter(
    (u) => u.role === "GUEST"
  );

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Users</h1>
          <p>Manage staff and system accounts</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="alert alert-success" role="status">
          {message}
        </div>
      )}

      {/* CREATE USER */}
      <form
        className="card-estylo mb-4"
        onSubmit={submit}
      >
        <h4 className="mb-3">Create User</h4>

        <div className="row g-3">
          <div className="col-md-4">
            <label htmlFor="username">
              Username
            </label>

            <input
              id="username"
              name="username"
              className="form-control"
              type="text"
              minLength={3}
              maxLength={80}
              required
              autoComplete="off"
              placeholder="e.g. onsite_guest"
            />
          </div>

          <div className="col-md-4">
            <label htmlFor="displayName">
              Display Name
            </label>

            <input
              id="displayName"
              name="displayName"
              className="form-control"
              type="text"
              maxLength={100}
              required
              placeholder="e.g. Onsite Guest Orders"
            />
          </div>

          <div className="col-md-4">
            <label htmlFor="password">
              Password
            </label>

            <input
              id="password"
              name="password"
              className="form-control"
              type="password"
              minLength={12}
              maxLength={200}
              required
              autoComplete="new-password"
              placeholder="Minimum 12 characters"
            />

            {role === "GUEST" && (
              <small className="text-muted">
                Required by the current database schema,
                but cannot be used for login.
              </small>
            )}
          </div>

          <div className="col-md-4">
            <label htmlFor="role">
              User Role
            </label>

            <select
              id="role"
              name="role"
              className="form-select"
              value={role}
              onChange={(e) =>
                setRole(
                  e.target.value as
                    "ADMIN" | "CASHIER" | "GUEST"
                )
              }
            >
              <option value="CASHIER">
                CASHIER
              </option>

              <option value="ADMIN">
                ADMIN
              </option>

              <option value="GUEST">
                GUEST — Onsite Orders
              </option>
            </select>
          </div>
        </div>

        {role === "GUEST" && (
          <div className="alert alert-info mt-3 mb-0">
            <strong>Guest System Account</strong>

            <p className="mb-0 mt-2">
              This role is for recording orders placed
              through the public Onsite Ordering page.
              It does not allow access to the cashier,
              dashboard, reports, or maintenance pages.
              After creating this account, copy its
              Account ID into your backend .env file.
            </p>
          </div>
        )}

        <button
          type="submit"
          className="btn btn-estylo mt-3"
          disabled={busy}
        >
          {busy ? "Creating..." : "Create User"}
        </button>
      </form>

      {/* GUEST ACCOUNT SUMMARY */}
      <div className="card-estylo mb-4">
        <h4>Onsite Guest Account</h4>

        <p className="text-muted">
          Use an active GUEST account for
          ONSITE_ACTOR_USER_ID.
        </p>

        {guestAccounts.length === 0 ? (
          <p>
            No Guest account exists yet.
            Create one using the form above.
          </p>
        ) : (
          <div className="d-flex flex-column gap-3">
            {guestAccounts.map((u) => (
              <div
                key={u.id}
                className="p-3 rounded"
                style={{
                  background: "rgba(128,128,128,0.08)",
                  border: "1px solid rgba(128,128,128,0.2)",
                }}
              >
                <div className="d-flex justify-content-between flex-wrap gap-2 mb-2">
                  <strong>{u.displayName}</strong>

                  <span
                    className={
                      u.active
                        ? "badge bg-success"
                        : "badge bg-secondary"
                    }
                  >
                    {u.active ? "ACTIVE" : "DISABLED"}
                  </span>
                </div>

                <label className="form-label">
                  Account ID
                </label>

                <input
                  className="form-control mb-2"
                  readOnly
                  value={u.id}
                  aria-label={`Account ID for ${u.displayName}`}
                  onFocus={(e) => e.target.select()}
                />

                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => copyAccountId(u.id)}
                >
                  {copiedId === u.id
                    ? "Account ID Copied"
                    : "Copy Account ID"}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3">
          <small className="text-muted">
            Backend configuration:
          </small>

          <pre
            className="p-3 rounded mt-2"
            style={{
              background: "#222",
              color: "#f5d78b",
              overflowX: "auto",
            }}
          >
            {'ONSITE_ACTOR_USER_ID="YOUR_GUEST_ACCOUNT_UUID"'}
          </pre>
        </div>
      </div>

      {/* USERS TABLE */}
      <div className="card-estylo table-wrap">
        <h4 className="mb-3">User Accounts</h4>

        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Role</th>
                <th>Account ID</th>
                <th>Access</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>{u.displayName}</td>

                  <td>{u.username}</td>

                  <td>
                    <span
                      className={
                        u.role === "ADMIN"
                          ? "badge bg-dark"
                          : u.role === "CASHIER"
                            ? "badge bg-primary"
                            : "badge bg-secondary"
                      }
                    >
                      {u.role}
                    </span>
                  </td>

                  <td>
                    <code
                      style={{
                        overflowWrap: "anywhere",
                        fontSize: "0.8rem",
                      }}
                    >
                      {u.id}
                    </code>

                    <div className="mt-1">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => copyAccountId(u.id)}
                      >
                        {copiedId === u.id
                          ? "Copied"
                          : "Copy ID"}
                      </button>
                    </div>
                  </td>

                  <td>
                    <button
                      type="button"
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

        {rows.length === 0 && (
          <p className="text-muted">
            No users found.
          </p>
        )}
      </div>
    </div>
  );
}
