import type { User } from "@workspace/api-client-react";

/** DB tier written by the RevenueCat webhook — authoritative for server-side Boost. */
export function isServerPaidPremium(subscription: string | null | undefined): boolean {
  return String(subscription ?? "").toLowerCase() === "premium";
}

/** Whether the API will auto-boost / honor Boost on post create (matches `userIsPayingSubscriber`). */
export function isServerBoostEligible(user: Pick<User, "role" | "subscription"> | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return isServerPaidPremium(user.subscription);
}
