export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function pickN<T>(arr: readonly T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

/** Random Date between startMs and endMs (inclusive). */
export function randomTimeBetween(startMs: number, endMs: number): Date {
  if (endMs <= startMs) return new Date(startMs);
  return new Date(startMs + Math.floor(Math.random() * (endMs - startMs + 1)));
}

export type EngagementAction = "pray" | "comment" | "save" | "boost";

/** Weighted random engagement action for simulated accounts. */
export function pickEngagementAction(forRealUserPost: boolean): EngagementAction {
  const roll = Math.random();
  if (forRealUserPost) {
    if (roll < 0.52) return "pray";
    if (roll < 0.72) return "save";
    if (roll < 0.88) return "comment";
    return "boost";
  }
  if (roll < 0.55) return "pray";
  if (roll < 0.78) return "save";
  if (roll < 0.93) return "comment";
  return "boost";
}
