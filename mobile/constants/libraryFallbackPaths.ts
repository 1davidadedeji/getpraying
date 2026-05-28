import { iconKeyForPathCategory } from "@/constants/pathCategoryIcon";

/** When API returns no paths yet, still show Explore paths (counts 0). */
export type LibraryPathCard = {
  name: string;
  count: number;
  icon: string;
  /** Emoji to display instead of a Feather icon (takes priority when set). */
  emoji?: string;
  pathId?: number;
  /** For client-only fallback tiles (no pathId) */
  slug: string;
};

/** API shape from GET /library/categories */
export type ApiLibraryCategory = {
  name: string;
  count: number;
  icon: string;
  /** Emoji to display instead of a Feather icon (takes priority when set). */
  emoji?: string;
  pathId?: number;
  /** Path category slug (e.g. anxiety) — from prayer_paths.category */
  category?: string;
};

/**
 * Emoji per path `category` slug (aligned with api-server `library` icon keys).
 * Used when `/library/categories` rows omit `emoji`.
 */
export const LIBRARY_CATEGORY_EMOJI_BY_SLUG: Record<string, string> = {
  anxiety: "🕊️",
  gratitude: "🙏",
  healing: "🧡",
  guidance: "🪧",
  family: "👨‍👩‍👧",
  health: "🩺",
  "work/career": "💼",
  finances: "💰",
  sleep: "🌙",
  "growth/purpose": "🌱",
  forgiveness: "🌿",
  relationships: "💞",
  "mental health": "🧠",
  protection: "🛡️",
  provision: "🌿",
  grief: "🤍",
  hope: "✨",
  praise: "🎵",
  wisdom: "📖",
  peace: "☮️",
  strength: "🦁",
  general: "⭐️",
};

function normalizeSlugKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "-").replace(/^\/+|\/+$/g, "");
}

/** Resolve emoji for a category row (explicit `emoji`, API `category`, or fallback path match). */
export function emojiForLibraryCategory(cat: {
  emoji?: string;
  name: string;
  pathId?: number | null;
  slug?: string;
  category?: string;
}): string | undefined {
  const trimmed = typeof cat.emoji === "string" ? cat.emoji.trim() : "";
  if (trimmed) return trimmed;

  const fromApiSlug = typeof cat.category === "string" ? normalizeSlugKey(cat.category) : "";
  if (fromApiSlug && LIBRARY_CATEGORY_EMOJI_BY_SLUG[fromApiSlug])
    return LIBRARY_CATEGORY_EMOJI_BY_SLUG[fromApiSlug];
  /** `work-career`-style mismatches vs `work/career` */
  if (fromApiSlug) {
    const slash = fromApiSlug.replace(/-slash-/g, "/").replace(/-/g, "/");
    if (LIBRARY_CATEGORY_EMOJI_BY_SLUG[slash]) return LIBRARY_CATEGORY_EMOJI_BY_SLUG[slash];
  }

  const slugGuess =
    "slug" in cat && typeof cat.slug === "string" && cat.slug.trim()
      ? normalizeSlugKey(cat.slug)
      : normalizeSlugKey(cat.name || "");
  if (slugGuess && LIBRARY_CATEGORY_EMOJI_BY_SLUG[slugGuess])
    return LIBRARY_CATEGORY_EMOJI_BY_SLUG[slugGuess];

  if (cat.pathId != null) {
    const byId = LIBRARY_FALLBACK_PATHS.find((p) => p.pathId === cat.pathId);
    if (byId?.emoji) return byId.emoji;
  }

  const nm = normalizeSlugKey(cat.name);
  const byName = LIBRARY_FALLBACK_PATHS.find((p) => normalizeSlugKey(p.slug) === nm || normalizeSlugKey(p.name) === nm);
  return byName?.emoji ?? undefined;
}

export const LIBRARY_FALLBACK_PATHS: LibraryPathCard[] = [
  { name: "Anxiety & Calm", slug: "anxiety", count: 0, icon: iconKeyForPathCategory("anxiety"), emoji: "🕊️" },
  { name: "Gratitude", slug: "gratitude", count: 0, icon: iconKeyForPathCategory("gratitude"), emoji: "🙏" },
  { name: "Healing", slug: "healing", count: 0, icon: iconKeyForPathCategory("healing"), emoji: "🧡" },
  { name: "Grief & Loss", slug: "grief", count: 0, icon: iconKeyForPathCategory("grief"), emoji: "🤍" },
  { name: "Family", slug: "family", count: 0, icon: iconKeyForPathCategory("family"), emoji: "👨‍👩‍👧" },
  { name: "Strength", slug: "strength", count: 0, icon: iconKeyForPathCategory("strength"), emoji: "🦁" },
  { name: "Success & Wealth", slug: "peace", count: 0, icon: iconKeyForPathCategory("peace"), emoji: "☮️" },
  { name: "Hope & Light", slug: "hope", count: 0, icon: iconKeyForPathCategory("hope"), emoji: "✨" },
  { name: "Forgiveness", slug: "forgiveness", count: 0, icon: iconKeyForPathCategory("forgiveness"), emoji: "🌿" },
  { name: "Wisdom", slug: "wisdom", count: 0, icon: iconKeyForPathCategory("wisdom"), emoji: "📖" },
  { name: "Guidance", slug: "guidance", count: 0, icon: iconKeyForPathCategory("guidance"), emoji: "🪧" },
  { name: "Relationships", slug: "relationships", count: 0, icon: iconKeyForPathCategory("relationships"), emoji: "💞" },
  { name: "Intercession", slug: "intercession", count: 0, icon: "heart", emoji: "🤲" },
  { name: "Thanksgiving", slug: "thanksgiving", count: 0, icon: iconKeyForPathCategory("gratitude"), emoji: "🙌" },
  { name: "Praise & Worship", slug: "praise", count: 0, icon: iconKeyForPathCategory("praise"), emoji: "🎵" },
  { name: "Courses", slug: "courses", count: 0, icon: "star", emoji: "📚" },
];
