/**
 * Simple in-memory sliding-window rate limiter.
 * Each key (e.g. userId) is allowed `maxHits` within `windowMs`.
 */
interface WindowEntry {
  timestamps: number[];
}

export class RateLimiter {
  private store = new Map<string, WindowEntry>();
  private windowMs: number;
  private maxHits: number;

  constructor(windowMs: number, maxHits: number) {
    this.windowMs = windowMs;
    this.maxHits = maxHits;
  }

  /** Returns true if the action is allowed (and records the hit). */
  tryHit(key: string): boolean {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    let entry = this.store.get(key);

    if (!entry) {
      entry = { timestamps: [] };
      this.store.set(key, entry);
    }

    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

    if (entry.timestamps.length >= this.maxHits) {
      return false;
    }

    entry.timestamps.push(now);
    return true;
  }

  remaining(key: string): number {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const entry = this.store.get(key);
    if (!entry) return this.maxHits;
    const active = entry.timestamps.filter((t) => t > cutoff).length;
    return Math.max(0, this.maxHits - active);
  }
}
