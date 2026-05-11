"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.getpraying.com";
const TOKEN_KEY = "gp_admin_token";

export interface AdminUser {
  id: number;
  username: string;
  displayName: string | null;
  email: string;
  role: "admin" | "moderator";
}

interface AuthState {
  user: AdminUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  user: null,
  token: null,
  loading: true,
  login: async () => "Not ready",
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const verifyToken = useCallback(async (t: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) return null;
      const data = await res.json() as AdminUser;
      if (!data?.id) return null;
      const role = data.role;
      if (role !== "admin" && role !== "moderator") return null;
      return data;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) { setLoading(false); return; }
    verifyToken(stored).then((u) => {
      if (u) { setUser(u); setToken(stored); }
      else localStorage.removeItem(TOKEN_KEY);
      setLoading(false);
    });
  }, [verifyToken]);

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json() as { token?: string; user?: AdminUser; error?: string };
      if (!res.ok) return data.error ?? "Login failed";
      if (!data.token || !data.user) return "Invalid response from server";
      const role = data.user.role;
      if (role !== "admin" && role !== "moderator") {
        return "Access denied. Admin or Moderator role required.";
      }
      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setUser(data.user);
      return null;
    } catch {
      return "Network error. Check your connection.";
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
