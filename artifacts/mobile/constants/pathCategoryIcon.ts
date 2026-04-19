/** Aligns with API `iconForPathCategory` (library routes) → keys into `FEATHER_ICON_MAP` */
export function iconKeyForPathCategory(category: string): string {
  const c = category.trim().toLowerCase();
  const map: Record<string, string> = {
    anxiety: "waves",
    gratitude: "sun",
    healing: "heart-pulse",
    guidance: "compass",
    family: "users",
    health: "stethoscope",
    "work/career": "briefcase",
    finances: "dollar-sign",
    sleep: "moon",
    "growth/purpose": "sprout",
    forgiveness: "hand-heart",
    relationships: "heart",
    "mental health": "brain",
    protection: "shield",
    provision: "leaf",
    grief: "cloud",
    hope: "star",
    praise: "music",
    wisdom: "help-circle",
    peace: "cloud",
    general: "star",
  };
  return map[c] ?? "star";
}
