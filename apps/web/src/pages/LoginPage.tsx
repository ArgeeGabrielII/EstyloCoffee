import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
export function LoginPage() {
  const { login, user, loading } = useAuth(),
    nav = useNavigate();
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (user)
    return <Navigate to={user.role === "ADMIN" ? "/dashboard" : "/cashier"} />;
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const u = await login(username, password);
      nav(u.role === "ADMIN" ? "/dashboard" : "/cashier");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <img
          className="login-logo"
          src="/estylo-logo.png"
          alt="Estylo Coffee"
        />
        <h1>ESTYLO COFFEE</h1>
        <p>Good coffee. Better days.</p>
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}
        <label htmlFor="username" className="form-label">
          Username
        </label>
        <input
          id="username"
          className="form-control mb-3"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
        />
        <label htmlFor="password" className="form-label">
          Password
        </label>
        <input
          id="password"
          className="form-control mb-4"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <button
          className="btn btn-estylo w-100 py-3"
          disabled={busy || loading}
        >
          {busy ? "SIGNING IN…" : "SIGN IN"}
        </button>
      </form>
    </div>
  );
}
