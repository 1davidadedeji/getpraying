/** Tiny className join — avoids pulling clsx for this app only. */
export function cn(...parts: Array<string | false | undefined | null>): string {
  return parts.filter(Boolean).join(" ");
}
