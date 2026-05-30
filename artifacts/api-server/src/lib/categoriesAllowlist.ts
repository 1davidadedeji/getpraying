/** Must match mobile `MAX_POST_TAGS` in `mobile/app/post/new.tsx`. */
export const MAX_POST_CATEGORY_TAGS = 2;

/** Allowed prayer category slugs (must match mobile `CATEGORY_SLUGS`). */
export const ALLOWED_CATEGORY_SLUGS = new Set([
  "anxiety",
  "gratitude",
  "healing",
  "guidance",
  "relationships",
  "protection",
  "provision",
  "grief",
  "hope",
  "praise",
  "wisdom",
  "peace",
  "family",
  "health",
  "work/career",
  "finances",
  "sleep",
  "growth/purpose",
  "forgiveness",
  "mental health",
]);

export function filterAllowedCategories(categories: unknown): string[] {
  if (!Array.isArray(categories)) return [];
  const out: string[] = [];
  for (const c of categories) {
    if (typeof c !== "string") continue;
    const t = c.trim().toLowerCase();
    if (ALLOWED_CATEGORY_SLUGS.has(t) && !out.includes(t)) out.push(t);
  }
  return out.slice(0, MAX_POST_CATEGORY_TAGS);
}
