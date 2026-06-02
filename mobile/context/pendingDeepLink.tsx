import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { bumpDeferredNavigation } from "@/lib/deferredNavigation";
import {
  deepLinkToHref,
  parseDeepLinkUrl,
  type ParsedDeepLink,
} from "@/lib/parseDeepLink";

const STORAGE_KEY = "@getpraying/pending_deeplink_v2";
/** Deferred links older than this are discarded (avoids surprise navigation days later). */
const PENDING_TTL_MS = 30 * 60 * 1000;

type StoredPending = { url: string; capturedAt: number };

interface PendingDeepLinkContextValue {
  pendingDeepLink: ParsedDeepLink | null;
  /** False until AsyncStorage hydration finishes. */
  hydrated: boolean;
  /** Capture from a URL; persists until consumed. */
  captureFromUrl: (url: string | null | undefined) => void;
  /** Returns the Expo Router href and clears the pending link. */
  consumePendingHref: () => string | null;
  clearPending: () => void;
}

const PendingDeepLinkContext = createContext<PendingDeepLinkContextValue | null>(null);

function isFresh(capturedAt: number): boolean {
  return Date.now() - capturedAt <= PENDING_TTL_MS;
}

async function loadStored(): Promise<ParsedDeepLink | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPending;
    if (!parsed?.url || typeof parsed.capturedAt !== "number" || !isFresh(parsed.capturedAt)) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parseDeepLinkUrl(parsed.url) ?? null;
  } catch {
    return null;
  }
}

async function persistUrl(url: string | null): Promise<void> {
  try {
    if (url) {
      const payload: StoredPending = { url, capturedAt: Date.now() };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function PendingDeepLinkProvider({ children }: { children: React.ReactNode }) {
  const [pendingDeepLink, setPendingDeepLink] = useState<ParsedDeepLink | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const captureFromUrl = useCallback((url: string | null | undefined) => {
    const parsed = parseDeepLinkUrl(url);
    if (!parsed) return;
    setPendingDeepLink(parsed);
    void persistUrl(url ?? null);
    bumpDeferredNavigation();
  }, []);

  const clearPending = useCallback(() => {
    setPendingDeepLink(null);
    void persistUrl(null);
  }, []);

  const consumePendingHref = useCallback((): string | null => {
    if (!pendingDeepLink) return null;
    const href = deepLinkToHref(pendingDeepLink);
    setPendingDeepLink(null);
    void persistUrl(null);
    return href;
  }, [pendingDeepLink]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await AsyncStorage.removeItem("@getpraying/pending_deeplink").catch(() => {});
      const stored = await loadStored();
      if (!cancelled && stored) setPendingDeepLink(stored);
      if (!cancelled) setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    void Linking.getInitialURL().then((url) => {
      captureFromUrl(url);
    });

    const sub = Linking.addEventListener("url", ({ url }) => {
      captureFromUrl(url);
    });

    return () => sub.remove();
  }, [hydrated, captureFromUrl]);

  return (
    <PendingDeepLinkContext.Provider
      value={{ pendingDeepLink, hydrated, captureFromUrl, consumePendingHref, clearPending }}
    >
      {children}
    </PendingDeepLinkContext.Provider>
  );
}

export function usePendingDeepLink() {
  const ctx = useContext(PendingDeepLinkContext);
  if (!ctx) throw new Error("usePendingDeepLink must be used within PendingDeepLinkProvider");
  return ctx;
}
