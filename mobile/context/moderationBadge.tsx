import { getGetNotificationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useAuth } from "@/context/auth";
import { apiFetch } from "@/lib/api";

/** Poll often so mods see pending count + notification list stay in sync after a colleague acts. */
const POLL_INTERVAL_MS = 12_000;

interface ModerationBadgeContextValue {
  pendingCount: number;
  refresh: () => void;
}

const ModerationBadgeContext = createContext<ModerationBadgeContextValue>({
  pendingCount: 0,
  refresh: () => {},
});

export function ModerationBadgeProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { user, token } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const isMod = user?.role === "admin" || user?.role === "moderator";
  const prevCountRef = useRef<number | null>(null);

  const fetchCount = useCallback(async () => {
    if (!token || !isMod) {
      prevCountRef.current = null;
      setPendingCount(0);
      return;
    }
    try {
      const res = await apiFetch("/admin/pending-count", { token });
      if (!res.ok) return;
      const data = await res.json();
      const next = typeof data.count === "number" ? data.count : 0;
      const prev = prevCountRef.current;
      if (prev !== null && prev !== next) {
        void queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
      }
      prevCountRef.current = next;
      setPendingCount(next);
    } catch {
      /* silent */
    }
  }, [token, isMod, queryClient]);

  useEffect(() => {
    if (!isMod) { setPendingCount(0); return; }
    fetchCount();
    const interval = setInterval(fetchCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isMod, fetchCount]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && isMod) fetchCount();
    });
    return () => sub.remove();
  }, [isMod, fetchCount]);

  return (
    <ModerationBadgeContext.Provider value={{ pendingCount, refresh: fetchCount }}>
      {children}
    </ModerationBadgeContext.Provider>
  );
}

export function useModerationBadge() {
  return useContext(ModerationBadgeContext);
}
