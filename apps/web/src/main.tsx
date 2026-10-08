import React from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./styles.css";

import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { AppLayout } from "./components/AppLayout";
import { LoginPage } from "./pages/LoginPage";
import { CashierPage } from "./pages/CashierPage";
import { OrdersPage } from "./pages/OrdersPage";
import { PublicQueuePage } from "./pages/PublicQueuePage";
import { ProductsPage } from "./pages/ProductsPage";
import { UsersPage } from "./pages/UsersPage";
import { ReportsPage } from "./pages/ReportsPage";
import { AuditPage } from "./pages/AuditPage";

function Home() {
  const { user } = useAuth();

  return (
    <Navigate
      to={
        user
          ? user.role === "ADMIN"
            ? "/dashboard"
            : "/cashier"
          : "/login"
      }
      replace
    />
  );
}

function Admin({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute roles={["ADMIN"]}>
      {children}
    </ProtectedRoute>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/queue" element={<PublicQueuePage />} />

          <Route
            element={
              <ProtectedRoute roles={["ADMIN", "CASHIER"]}>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route
              path="/dashboard"
              element={
                <Admin>
                  <ReportsPage dashboard />
                </Admin>
              }
            />

            <Route path="/orders" element={<OrdersPage />} />

            <Route
              path="/reports"
              element={
                <Admin>
                  <ReportsPage />
                </Admin>
              }
            />

            <Route
              path="/maintenance/products"
              element={
                <Admin>
                  <ProductsPage />
                </Admin>
              }
            />

            <Route
              path="/maintenance/users"
              element={
                <Admin>
                  <UsersPage />
                </Admin>
              }
            />

            <Route
              path="/maintenance/audit"
              element={
                <Admin>
                  <AuditPage />
                </Admin>
              }
            />
          </Route>

          <Route
            path="/cashier"
            element={
              <ProtectedRoute roles={["ADMIN", "CASHIER"]}>
                <CashierPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Home />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);