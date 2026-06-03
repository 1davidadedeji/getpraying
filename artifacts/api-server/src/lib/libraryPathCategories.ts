/**
 * "For your situation" library cards — order matches mobile LIBRARY_FALLBACK_PATHS and seed PATHS.
 * Keep in sync with web-admin `config/default-library-paths.ts`.
 */
export const LIBRARY_SITUATION_CATEGORY_ORDER = [
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

export type LibrarySituationCategory = (typeof LIBRARY_SITUATION_CATEGORY_ORDER)[number];

const ORDER_INDEX = new Map<string, number>(
  LIBRARY_SITUATION_CATEGORY_ORDER.map((slug, i) => [slug, i]),
);

export function isLibrarySituationCategory(category: string): boolean {
  return ORDER_INDEX.has(category.trim().toLowerCase());
}

export function sortByLibrarySituationCategoryOrder<T extends { category: string }>(
  paths: T[],
): T[] {
  return [...paths].sort(
    (a, b) =>
      (ORDER_INDEX.get(a.category.trim().toLowerCase()) ?? 999) -
      (ORDER_INDEX.get(b.category.trim().toLowerCase()) ?? 999),
  );
}

/** The 13 default path categories shown in the app and CMS. */
export function filterLibrarySituationPaths<T extends { category: string }>(paths: T[]): T[] {
  return sortByLibrarySituationCategoryOrder(
    paths.filter((p) => isLibrarySituationCategory(p.category)),
  );
}
