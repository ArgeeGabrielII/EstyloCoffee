import { Navigate } from "react-router-dom";
import { Role } from "../api/client";
import { useAuth } from "./AuthContext";
export function ProtectedRoute({
  roles,
  children,
}: {
  roles: Role[];
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  if (loading) return <div className="screen-center">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/cashier" replace />;
  return <>{children}</>;
}
