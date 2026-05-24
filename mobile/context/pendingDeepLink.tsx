import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  deepLinkToHref,
  parseDeepLinkUrl,
  type ParsedDeepLink,
} from "@/lib/parseDeepLink";

const STORAGE_KEY = "@getpraying/pending_deeplink";

interface PendingDeepLinkContextValue {
  pendingDeepLink: ParsedDeepLink | null;
  /** Capture from a URL; persists until consumed. */
  captureFromUrl: (url: string | null | undefined) => void;
  /** Returns the Expo Router href and clears the pending link. */
  consumePendingHref: () => string | null;
  clearPending: () => void;
}

const PendingDeepLinkContext = createContext<PendingDeepLinkContextValue | null>(null);

async function loadStored(): Promise<ParsedDeepLink | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parseDeepLinkUrl(raw) ?? null;
  } catch {
    return null;
  }
}

async function persistUrl(url: string | null): Promise<void> {
  try {
    if (url) await AsyncStorage.setItem(STORAGE_KEY, url);
    else await AsyncStorage.removeItem(STORAGE_KEY);
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
      value={{ pendingDeepLink, captureFromUrl, consumePendingHref, clearPending }}
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
