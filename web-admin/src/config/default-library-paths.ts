/**
 * Fixed library path categories (matches api-server seed-lib-pg PATHS — 12 cards in the app).
 * CMS lists only these; staff add guides under each path, not new paths.
 */
export const DEFAULT_LIBRARY_PATH_CATEGORIES = [
  "anxiety",
  "gratitude",
  "healing",
  "grief",
  "family",
  "strength",
  "peace",
  "hope",
  "forgiveness",
  "wisdom",
  "guidance",
  "relationships",
] as const;

export type DefaultLibraryPathCategory = (typeof DEFAULT_LIBRARY_PATH_CATEGORIES)[number];

const ORDER = new Map<string, number>(
  DEFAULT_LIBRARY_PATH_CATEGORIES.map((slug, i) => [slug, i]),
);

export function isDefaultLibraryPathCategory(category: string): boolean {
  return ORDER.has(category.trim().toLowerCase());
}

/** Keep only the 12 default paths, in app card order. */
export function filterDefaultLibraryPaths<T extends { category: string }>(paths: T[]): T[] {
  return paths
    .filter((p) => isDefaultLibraryPathCategory(p.category))
    .sort(
      (a, b) =>
        (ORDER.get(a.category.trim().toLowerCase()) ?? 99) -
        (ORDER.get(b.category.trim().toLowerCase()) ?? 99),
    );
}
