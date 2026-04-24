import { iconKeyForPathCategory } from "@/constants/pathCategoryIcon";

/** When API returns no paths yet, still show Explore paths (counts 0). */
export type LibraryPathCard = {
  name: string;
  count: number;
  icon: string;
  pathId?: number;
  /** For client-only fallback tiles (no pathId) */
  slug: string;
};

/** API shape from GET /library/categories */
export type ApiLibraryCategory = {
  name: string;
  count: number;
  icon: string;
  pathId?: number;
  /** Path category slug (e.g. anxiety) — from prayer_paths.category */
  category?: string;
};

export const LIBRARY_FALLBACK_PATHS: LibraryPathCard[] = [
  { name: "Anxiety", slug: "anxiety", count: 0, icon: iconKeyForPathCategory("anxiety") },
  { name: "Gratitude", slug: "gratitude", count: 0, icon: iconKeyForPathCategory("gratitude") },
  { name: "Healing", slug: "healing", count: 0, icon: iconKeyForPathCategory("healing") },
  { name: "Grief", slug: "grief", count: 0, icon: iconKeyForPathCategory("grief") },
  { name: "Family", slug: "family", count: 0, icon: iconKeyForPathCategory("family") },
  { name: "Strength", slug: "strength", count: 0, icon: iconKeyForPathCategory("strength") },
  { name: "Peace", slug: "peace", count: 0, icon: iconKeyForPathCategory("peace") },
  { name: "Hope", slug: "hope", count: 0, icon: iconKeyForPathCategory("hope") },
  { name: "Forgiveness", slug: "forgiveness", count: 0, icon: iconKeyForPathCategory("forgiveness") },
  { name: "Wisdom", slug: "wisdom", count: 0, icon: iconKeyForPathCategory("wisdom") },
  { name: "Guidance", slug: "guidance", count: 0, icon: iconKeyForPathCategory("guidance") },
  { name: "Relationships", slug: "relationships", count: 0, icon: iconKeyForPathCategory("relationships") },
];
