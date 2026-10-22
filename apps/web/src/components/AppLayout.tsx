import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
const operations = [
  ["/dashboard", "Dashboard", "bi-grid-1x2-fill", true],
  ["/cashier", "Cashier", "bi-calculator", false],
  ["/orders", "Orders", "bi-receipt", false],
  ["/reports", "Reports", "bi-bar-chart-fill", true],
] as const;
const maintenance = [
  ["/maintenance/products", "Drinks & Add-ons", "bi-cup-hot"],
  ["/maintenance/payment-methods", "Payment Methods", "bi-credit-card"],
  ["/maintenance/users", "Users", "bi-people-fill"],
  ["/maintenance/audit", "Audit Log", "bi-clock-history"],
] as const;
export function AppLayout() {
  const { user, logout } = useAuth(), nav = useNavigate();
  const location = useLocation();
  const [maintenanceOpen, setMaintenanceOpen] = useState(
    location.pathname.startsWith("/maintenance")
  );
  const [open, setOpen] = useState(false), [error, setError] = useState("");
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (open ? "mobile-open" : "")}>
        <div className="brand"><img src="/estylo-logo.png" alt="Estylo Coffee" /><div><b>ESTYLO</b><small>COFFEE</small></div></div>
        <nav>
          {operations.filter(l => !l[3] || user?.role === "ADMIN").map(([to, label, icon]) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)}
              className={({ isActive }) => "side-link " + (isActive ? "active" : "")}>
              <i className={"bi " + icon} /><span>{label}</span>
            </NavLink>
          ))}
          {user?.role === "ADMIN" && <>
            <button type="button" className="side-link w-100 text-start"
              aria-expanded={maintenanceOpen}
              onClick={() => setMaintenanceOpen(value => !value)}
              style={{ background: "transparent", border: 0 }}>
              <i className="bi bi-gear-fill" /><span>Maintenance</span>
              <i className={"bi ms-auto " + (maintenanceOpen ? "bi-chevron-up" : "bi-chevron-down")} />
            </button>
            {(maintenanceOpen || location.pathname.startsWith("/maintenance")) && (
              <div style={{ paddingLeft: 16 }}>
                {maintenance.map(([to, label, icon]) => (
                  <NavLink key={to} to={to} onClick={() => setOpen(false)}
                    className={({ isActive }) => "side-link " + (isActive ? "active" : "")}>
                    <i className={"bi " + icon} /><span>{label}</span>
                  </NavLink>
                ))}
              </div>
            )}
          </>}
        </nav>
        <button className="logout" onClick={() => logout().then(() => nav("/login")).catch(e => setError(e.message))}>Sign out</button>
      </aside>
      <main className="content">
        <header className="topbar"><button className="btn mobile-toggle" aria-label="Toggle navigation" aria-expanded={open} onClick={() => setOpen(!open)}><i className="bi bi-list" /></button><div><strong>{user?.displayName}</strong><small>{user?.role}</small></div></header>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        <Outlet />
      </main>
    </div>
  );
}
