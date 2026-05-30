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
  if (err instanceof Error && err.message.trim()) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const msg = String((err as { message?: unknown }).message ?? "").trim();
    if (msg) return msg;
  }
  return fallback;
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
