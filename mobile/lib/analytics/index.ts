import { requestAttIfNeeded } from "./att";
import {
  enableFirebaseCollection,
  firebaseLogAppOpen,
  firebaseLogPurchase,
  firebaseLogSignUp,
  firebaseSetUserId,
} from "./firebase";
import {
  metaLogAppOpen,
  metaLogPurchase,
  metaLogSignUp,
  metaSetUserId,
  setMetaAdvertiserTrackingEnabled,
} from "./meta";

export type { PurchaseParams } from "./types";

let initPromise: Promise<void> | null = null;

function safeAsync(label: string, fn: () => void | Promise<void>): void {
  void Promise.resolve()
    .then(fn)
    .catch((e) => {
      if (__DEV__) console.warn(`[analytics] ${label} failed:`, e);
    });
}

/** ATT + Meta advertiser flag + Firebase collection. Idempotent. */
export function initAnalytics(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const attGranted = await requestAttIfNeeded();
      try {
        setMetaAdvertiserTrackingEnabled(attGranted);
      } catch {
        /* native module unavailable (e.g. Expo Go) */
      }
      try {
        await enableFirebaseCollection();
      } catch {
        /* native module unavailable */
      }
    })().catch(() => {
      initPromise = null;
    });
  }
  return initPromise;
}

export function logAppOpen(): void {
  safeAsync("logAppOpen", async () => {
    try {
      metaLogAppOpen();
    } catch {
      /* ignore */
    }
    try {
      await firebaseLogAppOpen();
    } catch {
      /* ignore */
    }
  });
}

export function logSignUp(method: string): void {
  safeAsync("logSignUp", async () => {
    try {
      metaLogSignUp(method);
    } catch {
      /* ignore */
    }
    try {
      await firebaseLogSignUp(method);
    } catch {
      /* ignore */
    }
  });
}

export function logPurchase(params: { productId: string; value: number; currency: string }): void {
  safeAsync("logPurchase", async () => {
    try {
      metaLogPurchase(params);
    } catch {
      /* ignore */
    }
    try {
      await firebaseLogPurchase(params);
    } catch {
      /* ignore */
    }
  });
}

export function setUserId(id: string): void {
  if (!id) return;
  safeAsync("setUserId", async () => {
    try {
      metaSetUserId(id);
    } catch {
      /* ignore */
    }
    try {
      await firebaseSetUserId(id);
    } catch {
      /* ignore */
    }
  });
}
