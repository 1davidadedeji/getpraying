import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { User } from "@workspace/api-client-react";
import { SubscriptionPromptSheet } from "@/components/SubscriptionPromptSheet";
import { useAuth } from "@/context/auth";
import { useRevenueCat } from "@/context/revenuecat";
import { apiFetch } from "@/lib/api";
import { isSubscribed } from "@/lib/subscriptionAccess";
import { cancelPremiumPlayAfterSubscribe } from "@/lib/premiumUnlockSession";
import { openPremiumPaywall } from "@/lib/openPremiumPaywall";
import {
  subscriptionPromptPriority,
  type SubscriptionPromptVariant,
} from "@/lib/subscriptionPromptCopy";

type ShowOpts = {
  daysSinceJoined?: number;
};

type SubscriptionPromptContextValue = {
  showSubscriptionPrompt: (variant: SubscriptionPromptVariant, opts?: ShowOpts) => void;
};

const SubscriptionPromptContext = createContext<SubscriptionPromptContextValue | null>(null);

let imperativeShow: ((variant: SubscriptionPromptVariant, opts?: ShowOpts) => void) | null = null;

/** Imperative entry — same pattern as showAppAlert. */
export function showSubscriptionPrompt(
  variant: SubscriptionPromptVariant,
  opts?: ShowOpts,
): void {
  if (!imperativeShow) {
    console.warn("[SubscriptionPrompt] Host not mounted —", variant);
    return;
  }
  imperativeShow(variant, opts);
}

async function recordRecurringDismiss(token: string): Promise<void> {
  await apiFetch("/auth/subscription-prompt-dismissed", { method: "POST", token });
}

function SubscriptionPromptCoordinator() {
  const { user, token, loading, refreshUser } = useAuth();
  const rc = useRevenueCat();
  const [visible, setVisible] = useState(false);
  const [variant, setVariant] = useState<SubscriptionPromptVariant>("recurring");
  const [daysSinceJoined, setDaysSinceJoined] = useState<number | undefined>();
  const activeVariantRef = useRef<SubscriptionPromptVariant | null>(null);
  const recurringShownThisSessionRef = useRef(false);
  const recurringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openPrompt = useCallback((next: SubscriptionPromptVariant, opts?: ShowOpts) => {
    const current = activeVariantRef.current;
    if (current != null && subscriptionPromptPriority(next) > subscriptionPromptPriority(current)) {
      return;
    }
    activeVariantRef.current = next;
    setVariant(next);
    setDaysSinceJoined(opts?.daysSinceJoined);
    setVisible(true);
  }, []);

  useEffect(() => {
    imperativeShow = openPrompt;
    return () => {
      imperativeShow = null;
    };
  }, [openPrompt]);

  const closePrompt = useCallback(() => {
    setVisible(false);
    activeVariantRef.current = null;
  }, []);

  const onNotNow = useCallback(() => {
    const closing = activeVariantRef.current;
    if (closing === "premiumContent") {
      cancelPremiumPlayAfterSubscribe();
    }
    closePrompt();
    if (closing === "recurring" && token && user) {
      void recordRecurringDismiss(token)
        .then(() => {
          refreshUser({ ...user, recurringPromptDue: false } as User);
        })
        .catch(() => {});
    }
  }, [closePrompt, refreshUser, token, user]);

  const onSubscribe = useCallback(() => {
    const closing = activeVariantRef.current;
    closePrompt();
    requestAnimationFrame(() => {
      openPremiumPaywall(closing === "premiumContent" ? "premiumContent" : "generic");
    });
  }, [closePrompt]);

  useEffect(() => {
    if (recurringTimerRef.current) {
      clearTimeout(recurringTimerRef.current);
      recurringTimerRef.current = null;
    }
    if (loading || !user?.isEmailVerified || !rc.isReady) return;
    if (isSubscribed(user, rc)) return;
    if (!user.recurringPromptDue) return;
    if (recurringShownThisSessionRef.current) return;
    if (visible) return;

    recurringTimerRef.current = setTimeout(() => {
      if (recurringShownThisSessionRef.current) return;
      if (isSubscribed(user, rc)) return;
      if (!user.recurringPromptDue) return;
      recurringShownThisSessionRef.current = true;
      openPrompt("recurring", { daysSinceJoined: user.daysSinceJoined ?? undefined });
    }, 900);

    return () => {
      if (recurringTimerRef.current) {
        clearTimeout(recurringTimerRef.current);
        recurringTimerRef.current = null;
      }
    };
  }, [loading, user, rc.isReady, rc.enabled, rc.customerInfo, rc.isEntitled, visible, openPrompt]);

  return (
    <SubscriptionPromptSheet
      visible={visible}
      variant={variant}
      daysSinceJoined={daysSinceJoined}
      onSubscribe={onSubscribe}
      onNotNow={onNotNow}
    />
  );
}

export function SubscriptionPromptProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo(
    () => ({
      showSubscriptionPrompt,
    }),
    [],
  );

  return (
    <SubscriptionPromptContext.Provider value={value}>
      {children}
      <SubscriptionPromptCoordinator />
    </SubscriptionPromptContext.Provider>
  );
}

export function useSubscriptionPrompts(): SubscriptionPromptContextValue {
  const ctx = useContext(SubscriptionPromptContext);
  if (!ctx) throw new Error("useSubscriptionPrompts must be used within SubscriptionPromptProvider");
  return ctx;
}
