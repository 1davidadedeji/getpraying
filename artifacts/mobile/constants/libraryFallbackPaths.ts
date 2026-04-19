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
export type ApiLibraryCategory = { name: string; count: number; icon: string; pathId?: number };

export const LIBRARY_FALLBACK_PATHS: LibraryPathCard[] = [
  { name: "Anxiety & Worry", slug: "anxiety", count: 0, icon: iconKeyForPathCategory("anxiety") },
  { name: "Gratitude", slug: "gratitude", count: 0, icon: iconKeyForPathCategory("gratitude") },
  { name: "Healing", slug: "healing", count: 0, icon: iconKeyForPathCategory("healing") },
  { name: "Guidance", slug: "guidance", count: 0, icon: iconKeyForPathCategory("guidance") },
  { name: "Relationships", slug: "relationships", count: 0, icon: iconKeyForPathCategory("relationships") },
  { name: "Protection", slug: "protection", count: 0, icon: iconKeyForPathCategory("protection") },
  { name: "Provision", slug: "provision", count: 0, icon: iconKeyForPathCategory("provision") },
  { name: "Grief & Loss", slug: "grief", count: 0, icon: iconKeyForPathCategory("grief") },
  { name: "Hope", slug: "hope", count: 0, icon: iconKeyForPathCategory("hope") },
  { name: "Praise & Worship", slug: "praise", count: 0, icon: iconKeyForPathCategory("praise") },
  { name: "Wisdom", slug: "wisdom", count: 0, icon: iconKeyForPathCategory("wisdom") },
  { name: "Peace", slug: "peace", count: 0, icon: iconKeyForPathCategory("peace") },
];
