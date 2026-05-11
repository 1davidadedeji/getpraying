/**
 * Prayer post categories — mirrors mobile/lib/categories.ts for admin filtering UI.
 */
export const POST_CATEGORY_SLUGS = [
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
] as const;

const LABELS: Record<string, string> = {
  anxiety: "Anxiety & worry",
  gratitude: "Gratitude",
  healing: "Healing",
  guidance: "Guidance",
  relationships: "Relationships",
  protection: "Protection",
  provision: "Provision",
  grief: "Grief & loss",
  hope: "Hope",
  praise: "Praise & worship",
  wisdom: "Wisdom",
  peace: "Peace",
  family: "Family",
  health: "Health",
  "work/career": "Work & career",
  finances: "Finances",
  sleep: "Sleep",
  "growth/purpose": "Growth & purpose",
  forgiveness: "Forgiveness",
  "mental health": "Mental health",
};

export const POST_CATEGORY_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All categories" },
  ...POST_CATEGORY_SLUGS.map((slug) => ({
    value: slug,
    label: LABELS[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1),
  })),
];
