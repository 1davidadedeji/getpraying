/**
 * "For your situation" paths — 13 cards, same order as mobile Library tab and api-server seed.
 * Keep in sync with `artifacts/api-server/src/lib/libraryPathCategories.ts`.
 */
export const DEFAULT_LIBRARY_PATH_CATEGORIES = [
  "anxiety",
  "family",
  "forgiveness",
  "gratitude",
  "grief",
  "guidance",
  "healing",
  "hope",
  "peace",
  "relationships",
  "strength",
  "wisdom",
  "wealth",
] as const;

export type DefaultLibraryPathCategory = (typeof DEFAULT_LIBRARY_PATH_CATEGORIES)[number];

const ORDER = new Map<string, number>(
  DEFAULT_LIBRARY_PATH_CATEGORIES.map((slug, i) => [slug, i]),
);

export function isDefaultLibraryPathCategory(category: string): boolean {
  return ORDER.has(category.trim().toLowerCase());
}

/** Keep only the 13 default paths, in app card order. */
export function filterDefaultLibraryPaths<T extends { category: string }>(paths: T[]): T[] {
  return paths
    .filter((p) => isDefaultLibraryPathCategory(p.category))
    .sort(
      (a, b) =>
        (ORDER.get(a.category.trim().toLowerCase()) ?? 99) -
        (ORDER.get(b.category.trim().toLowerCase()) ?? 99),
    );
}
