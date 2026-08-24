import type { CustomerInfo } from "react-native-purchases";

type PurchaseLikeError = {
  userCancelled?: boolean;
  code?: string | number;
  message?: string;
  userInfo?: { readableErrorCode?: string; rc_backend_error_code?: number };
};

export function isPurchaseUserCancelled(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  return Boolean((err as PurchaseLikeError).userCancelled);
}

/** Store says the user already owns this subscription (common during an active trial). */
export function isPurchaseAlreadyOwnedError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as PurchaseLikeError;
  const code = String(e.code ?? e.userInfo?.readableErrorCode ?? "").toUpperCase();
  if (
    code.includes("PRODUCT_ALREADY_PURCHASED") ||
    code.includes("ALREADY_PURCHASED") ||
    code.includes("ALREADY_OWNED") ||
    code === "6"
  ) {
    return true;
  }
  const msg = String(e.message ?? "").toLowerCase();
  return (
    msg.includes("already") &&
    (msg.includes("subscrib") ||
      msg.includes("purchase") ||
      msg.includes("active") ||
      msg.includes("owned"))
  );
}

export function purchaseErrorMessage(err: unknown, fallback: string): string {
  let raw = "";
  if (err instanceof Error && err.message.trim()) raw = err.message.trim();
  else if (err && typeof err === "object" && "message" in err) {
    raw = String((err as { message?: unknown }).message ?? "").trim();
  }
  if (!raw) return fallback;

  const lower = raw.toLowerCase();
  if (lower.includes("not configured for billing through google play")) {
    return "This build was not installed from Google Play, so subscriptions cannot start. Install Get Praying from the Play testing track, then try again.";
  }
  if (
    lower.includes("arguments provided are invalid") ||
    lower.includes("one or more of the arguments")
  ) {
    return "Google Play rejected this subscription product. Install from the Play testing track and confirm the monthly plan is active.";
  }
  return raw;
}

export function describeEntitlementAfterPurchase(info: CustomerInfo | null | undefined): {
  isTrial: boolean;
  isPaid: boolean;
} {
  const ent = info?.entitlements?.active?.premium ?? null;
  if (!ent) return { isTrial: false, isPaid: false };
  const period = String(ent.periodType ?? "").toUpperCase();
  const isTrial = period === "TRIAL" || period === "INTRO";
  return { isTrial, isPaid: !isTrial };
}
