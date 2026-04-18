/** Own-profile main tabs (stitch: MY PRAYERS / SAVED / CATEGORIES) */
export const PROFILE_MAIN_TABS = [
  { key: "my" as const, label: "My Prayers" },
  { key: "saved" as const, label: "Saved" },
  { key: "categories" as const, label: "Categories" },
];

export type ProfileMainTabKey = (typeof PROFILE_MAIN_TABS)[number]["key"];
