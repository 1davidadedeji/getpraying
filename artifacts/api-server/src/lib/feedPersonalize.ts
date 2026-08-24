/**
 * Home feed "For You" is rule-based ranking (own / relationships / category affinity),
 * not a separate ML model. `personalize=false` is chronological Latest within the
 * logged-in or logged-out tier rules.
 */
export function shouldPersonalizeFeed(input: {
  isSignedIn: boolean;
  queryValue: string | undefined;
}): boolean {
  if (!input.isSignedIn) return false;
  if (input.queryValue === "false") return false;
  return true;
}
