/**
 * In-memory sliding-window limits for auth endpoints (per IP / per key).
 * For multi-instance production, replace with Redis-backed limits.
 */

import type { Request } from "express";

type Entry = { hits: number[] };

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;

function prune(entry: Entry, now: number, windowMs: number): void {
  const cutoff = now - windowMs;
  entry.hits = entry.hits.filter((t) => t > cutoff);
}

export class HitWindowLimiter {
  private store = new Map<string, Entry>();
  private maxHits: number;
  private windowMs: number;

  constructor(maxHits: number, windowMs: number = DEFAULT_WINDOW_MS) {
    this.maxHits = maxHits;
    this.windowMs = windowMs;
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    for (const [key, entry] of this.store) {
      entry.hits = entry.hits.filter((t) => t > cutoff);
      if (entry.hits.length === 0) this.store.delete(key);
    }
  }

  /** Returns true if under limit and records this attempt. */
  recordHit(key: string): boolean {
    const now = Date.now();
    let entry = this.store.get(key);
    if (!entry) {
      entry = { hits: [] };
      this.store.set(key, entry);
    }
    prune(entry, now, this.windowMs);
    if (entry.hits.length >= this.maxHits) return false;
    entry.hits.push(now);
    return true;
  }

  reset(key: string): void {
    this.store.delete(key);
  }
}

/** Counts failures in a sliding window; use for login / OTP brute-force. */
export class FailureWindowLimiter {
  private store = new Map<string, number[]>();
  private windowMs: number;
  private maxFails: number;

  constructor(maxFails: number, windowMs = DEFAULT_WINDOW_MS) {
    this.maxFails = maxFails;
    this.windowMs = windowMs;
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    for (const [key, hits] of this.store) {
      const next = hits.filter((t) => t > cutoff);
      if (next.length === 0) this.store.delete(key);
      else this.store.set(key, next);
    }
  }

  /** Record one failure. Returns blocked=true if this key is now over the limit. */
  recordFailure(key: string): { blocked: boolean; retryAfterSec?: number } {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    let hits = this.store.get(key)?.filter((t) => t > cutoff) ?? [];
    if (hits.length >= this.maxFails) {
      const oldest = hits[0]!;
      return { blocked: true, retryAfterSec: Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000)) };
    }
    hits.push(now);
    this.store.set(key, hits);
    return { blocked: false };
  }

  reset(key: string): void {
    this.store.delete(key);
  }
}

export function clientIp(req: Pick<Request, "headers" | "socket">): string {
  const xf = req.headers["x-forwarded-for"];
  const raw =
    typeof xf === "string"
      ? xf.split(",")[0]?.trim()
      : Array.isArray(xf)
        ? xf[0]?.trim()
        : "";
  return raw || req.socket.remoteAddress || "unknown";
}
