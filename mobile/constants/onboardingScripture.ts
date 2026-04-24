/** Rotates by day of year for stable UX; extend or replace with admin config later. */
export const ONBOARDING_SCRIPTURE_STRIPS: { text: string; ref: string }[] = [
  {
    text: "Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God.",
    ref: "Philippians 4:6",
  },
  {
    text: "Cast all your anxiety on him because he cares for you.",
    ref: "1 Peter 5:7",
  },
  {
    text: "The Lord is close to the brokenhearted and saves those who are crushed in spirit.",
    ref: "Psalm 34:18",
  },
  {
    text: "Come to me, all you who are weary and burdened, and I will give you rest.",
    ref: "Matthew 11:28",
  },
  {
    text: "Peace I leave with you; my peace I give you. I do not give to you as the world gives.",
    ref: "John 14:27",
  },
];

export function scriptureStripForToday(): { text: string; ref: string } {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const diff = Date.now() - start.getTime();
  const day = Math.floor(diff / (24 * 60 * 60 * 1000));
  return ONBOARDING_SCRIPTURE_STRIPS[day % ONBOARDING_SCRIPTURE_STRIPS.length]!;
}
