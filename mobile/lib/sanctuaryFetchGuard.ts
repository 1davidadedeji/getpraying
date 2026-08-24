/** Drop stale sanctuary responses after logout or account switch. */
let fetchGeneration = 0;
let activeToken: string | null = null;

/** Call at the start of each sanctuary fetch; bumps generation when JWT changes. */
export function beginSanctuaryFetch(token: string | null | undefined): number {
  const nextToken = token ?? null;
  if (nextToken !== activeToken) {
    activeToken = nextToken;
    fetchGeneration += 1;
  }
  return fetchGeneration;
}

export function isSanctuaryFetchStale(
  token: string | null | undefined,
  generation: number,
): boolean {
  return generation !== fetchGeneration || (token ?? null) !== activeToken;
}

/** Invalidate in-flight sanctuary loads (e.g. on logout). */
export function invalidateSanctuaryFetches(): void {
  activeToken = null;
  fetchGeneration += 1;
}
