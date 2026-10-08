import { createContext, useContext, useEffect, useState } from "react";
import { api, User } from "../api/client";
type AuthValue = {
  user: User | null;
  loading: boolean;
  login: (u: string, p: string) => Promise<User>;
  logout: () => Promise<void>;
};
const Ctx = createContext<AuthValue | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api<User>("/auth/me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);
  const login = async (username: string, password: string) => {
    const r = await api<{ user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setUser(r.user);
    return r.user;
  };
  const logout = async () => {
    await api("/auth/logout", { method: "POST" });
    setUser(null);
  };
  return (
    <Ctx.Provider value={{ user, loading, login, logout }}>
      {children}
    </Ctx.Provider>
  );
}
export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AuthProvider missing");
  return v;
}
