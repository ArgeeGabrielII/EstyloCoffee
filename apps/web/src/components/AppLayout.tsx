import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
const links = [
  ["/dashboard", "Dashboard", "bi-grid-1x2-fill", true],
  ["/cashier", "Cashier", "bi-calculator", false],
  ["/orders", "Orders", "bi-receipt", false],
  ["/reports", "Reports", "bi-bar-chart-fill", true],
  ["/maintenance/products", "Drinks", "bi-cup-hot", true],
  ["/maintenance/users", "Users", "bi-people-fill", true],
  ["/maintenance/audit", "Audit Log", "bi-clock-history", true],
] as const;
export function AppLayout() {
  const { user, logout } = useAuth(),
    nav = useNavigate();
  const [open, setOpen] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (open ? "mobile-open" : "")}>
        <div className="brand">
          <img src="/estylo-logo.png" alt="Estylo Coffee" />
          <div>
            <b>ESTYLO</b>
            <small>COFFEE</small>
          </div>
        </div>
        <nav>
          {links
            .filter((l) => !l[3] || user?.role === "ADMIN")
            .map(([to, label, icon]) => (
              <NavLink
                title={label}
                aria-label={label}
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  "side-link " + (isActive ? "active" : "")
                }
              >
                <i className={"bi " + icon} />
                <span>{label}</span>
              </NavLink>
            ))}
        </nav>
        <button
          className="logout"
          onClick={() =>
            logout()
              .then(() => nav("/login"))
              .catch((e) => setError(e.message))
          }
        >
          Sign out
        </button>
      </aside>
      <main className="content">
        <header className="topbar">
          <button
            className="btn mobile-toggle"
            aria-label="Toggle navigation"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <i className="bi bi-list" />
          </button>
          <div>
            <strong>{user?.displayName}</strong>
            <small>{user?.role}</small>
          </div>
        </header>
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
