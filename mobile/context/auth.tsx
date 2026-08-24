import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAuthTokenGetter, getMe } from "@workspace/api-client-react";
import { login as apiLogin, logout as apiLogout } from "@workspace/api-client-react";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { User } from "@workspace/api-client-react";
import {
  clearPushTokenOnServer,
  registerAndSyncPushToken,
  resetPushTokenSyncState,
} from "@/lib/syncExpoPushToken";
import { setPushDeliveryEnabled } from "@/lib/pushDeliveryGate";
import { syncDeviceTimezone } from "@/lib/syncDeviceTimezone";
import { apiFetch } from "@/lib/api";
import { logSignUp, setUserId } from "@/lib/analytics";

const TOKEN_KEY = "@getpraying/token";
const USER_KEY = "@getpraying/user";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, username: string, password: string, displayName?: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: (updated: User) => void;
  /** Re-fetch `/auth/me` so DB fields (e.g. `subscription`) stay in sync with webhooks. */
  refreshUserFromServer: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const syncedPushTokenJwtRef = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [storedToken] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (!storedToken) return;

        setAuthTokenGetter(() => storedToken);
        try {
          const fresh = await getMe();
          setToken(storedToken);
          setUser(fresh);
          setUserId(String(fresh.id));
          await AsyncStorage.setItem(USER_KEY, JSON.stringify(fresh));
        } catch {
          await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
          setToken(null);
          setUser(null);
        }
      } catch {
        await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]).catch(() => {});
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    setAuthTokenGetter(() => token);
  }, [token]);

  useEffect(() => {
    if (loading) return;

    if (!token || !user) {
      setPushDeliveryEnabled(false);
      syncedPushTokenJwtRef.current = null;
      return;
    }

    setPushDeliveryEnabled(true);
    void syncDeviceTimezone(token);
    if (syncedPushTokenJwtRef.current === token) return;
    void (async () => {
      let ok = await registerAndSyncPushToken(token);
      if (!ok) {
        await new Promise((r) => setTimeout(r, 4_000));
        ok = await registerAndSyncPushToken(token);
      }
      if (!ok) {
        await new Promise((r) => setTimeout(r, 30_000));
        ok = await registerAndSyncPushToken(token);
      }
      if (ok) syncedPushTokenJwtRef.current = token;
    })();
  }, [loading, token, user?.id]);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const res = await apiLogin({ email, password });
    const tok = res.token;
    const u = res.user;
    await AsyncStorage.multiSet([[TOKEN_KEY, tok], [USER_KEY, JSON.stringify(u)]]);
    setToken(tok);
    setUser(u);
    setUserId(String(u.id));
    return u;
  }, []);

  const register = useCallback(async (email: string, username: string, password: string, displayName?: string): Promise<User> => {
    const res = await apiFetch("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        username,
        password,
        displayName,
        acceptedTerms: true,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      token?: string;
      user?: User;
      error?: string;
    };
    if (!res.ok || !data.token || !data.user) {
      throw Object.assign(new Error(data.error ?? "Registration failed"), { error: data.error });
    }
    const tok = data.token;
    const u = data.user;
    await AsyncStorage.multiSet([[TOKEN_KEY, tok], [USER_KEY, JSON.stringify(u)]]);
    setToken(tok);
    setUser(u);
    logSignUp("email");
    setUserId(String(u.id));
    return u;
  }, []);

  const logout = useCallback(async () => {
    const tok = token;
    setPushDeliveryEnabled(false);
    resetPushTokenSyncState();
    try {
      await clearPushTokenOnServer(tok);
    } catch {
      /* ignore */
    }
    try {
      await apiLogout();
    } catch {
      /* ignore */
    }
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    setToken(null);
    setUser(null);
  }, [token]);

  const refreshUser = useCallback((updated: User) => {
    setUser(updated);
    AsyncStorage.setItem(USER_KEY, JSON.stringify(updated)).catch(() => {});
  }, []);

  const refreshUserFromServer = useCallback(async (): Promise<User | null> => {
    if (!token) return null;
    setAuthTokenGetter(() => token);
    try {
      const fresh = await getMe();
      setUser(fresh);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(fresh));
      return fresh;
    } catch {
      return null;
    }
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        refreshUser,
        refreshUserFromServer,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
