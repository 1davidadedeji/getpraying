/**
 * Default “Today’s Word” rotation: one verse per day of year, cycling through a fixed
 * curated list (public-domain phrasing). Admins can override any date via the API.
 */
export type DailyQuote = { quoteText: string; reference: string };

const QUOTES: readonly DailyQuote[] = [
  { quoteText: "Be still, and know that I am God.", reference: "— Psalm 46:10" },
  { quoteText: "The Lord is my shepherd; I shall not want.", reference: "— Psalm 23:1" },
  { quoteText: "Trust in the Lord with all your heart.", reference: "— Proverbs 3:5" },
  { quoteText: "Cast all your anxiety on him, because he cares for you.", reference: "— 1 Peter 5:7" },
  { quoteText: "Come to me, all who labor and are heavy laden, and I will give you rest.", reference: "— Matthew 11:28" },
  { quoteText: "Rejoice always, pray without ceasing.", reference: "— 1 Thessalonians 5:16–17" },
  { quoteText: "Let all that you do be done in love.", reference: "— 1 Corinthians 16:14" },
  { quoteText: "Peace I leave with you; my peace I give to you.", reference: "— John 14:27" },
  { quoteText: "The Lord is near to all who call on him.", reference: "— Psalm 145:18" },
  { quoteText: "We love because he first loved us.", reference: "— 1 John 4:19" },
  { quoteText: "Create in me a clean heart, O God.", reference: "— Psalm 51:10" },
  { quoteText: "Your word is a lamp to my feet and a light to my path.", reference: "— Psalm 119:105" },
  { quoteText: "I can do all things through him who strengthens me.", reference: "— Philippians 4:13" },
  { quoteText: "Do not be anxious about anything, but in everything by prayer…", reference: "— Philippians 4:6" },
  { quoteText: "For I know the plans I have for you, declares the Lord.", reference: "— Jeremiah 29:11" },
  { quoteText: "The steadfast love of the Lord never ceases.", reference: "— Lamentations 3:22" },
  { quoteText: "He heals the brokenhearted and binds up their wounds.", reference: "— Psalm 147:3" },
  { quoteText: "Blessed are the peacemakers, for they shall be called sons of God.", reference: "— Matthew 5:9" },
  { quoteText: "Love your neighbor as yourself.", reference: "— Mark 12:31" },
  { quoteText: "Let not your hearts be troubled. Believe in God.", reference: "— John 14:1" },
  { quoteText: "If God is for us, who can be against us?", reference: "— Romans 8:31" },
  { quoteText: "Wait for the Lord; be strong, and let your heart take courage.", reference: "— Psalm 27:14" },
  { quoteText: "The Lord will fight for you; you need only to be still.", reference: "— Exodus 14:14" },
  { quoteText: "Delight yourself in the Lord, and he will give you the desires of your heart.", reference: "— Psalm 37:4" },
  { quoteText: "For where two or three are gathered in my name, there am I.", reference: "— Matthew 18:20" },
  { quoteText: "With God all things are possible.", reference: "— Matthew 19:26" },
  { quoteText: "The Lord is good; his steadfast love endures forever.", reference: "— Psalm 100:5" },
  { quoteText: "Let the words of my mouth… be acceptable in your sight, O Lord.", reference: "— Psalm 19:14" },
  { quoteText: "Bless the Lord, O my soul, and forget not all his benefits.", reference: "— Psalm 103:2" },
  { quoteText: "Even though I walk through the valley… I will fear no evil.", reference: "— Psalm 23:4" },
  { quoteText: "You keep him in perfect peace whose mind is stayed on you.", reference: "— Isaiah 26:3" },
  { quoteText: "Fear not, for I am with you.", reference: "— Isaiah 41:10" },
  { quoteText: "But they who wait for the Lord shall renew their strength.", reference: "— Isaiah 40:31" },
  { quoteText: "For my yoke is easy, and my burden is light.", reference: "— Matthew 11:30" },
  { quoteText: "Abide in me, and I in you.", reference: "— John 15:4" },
  { quoteText: "By grace you have been saved through faith.", reference: "— Ephesians 2:8" },
  { quoteText: "There is therefore now no condemnation for those who are in Christ Jesus.", reference: "— Romans 8:1" },
  { quoteText: "And we know that for those who love God all things work together for good.", reference: "— Romans 8:28" },
  { quoteText: "Do not be overcome by evil, but overcome evil with good.", reference: "— Romans 12:21" },
  { quoteText: "So we do not lose heart.", reference: "— 2 Corinthians 4:16" },
  { quoteText: "My grace is sufficient for you, for my power is made perfect in weakness.", reference: "— 2 Corinthians 12:9" },
  { quoteText: "But God shows his love for us in that while we were still sinners, Christ died for us.", reference: "— Romans 5:8" },
  { quoteText: "If we confess our sins, he is faithful and just to forgive us.", reference: "— 1 John 1:9" },
  { quoteText: "Little children, let us not love in word or talk but in deed and in truth.", reference: "— 1 John 3:18" },
  { quoteText: "He must increase, but I must decrease.", reference: "— John 3:30" },
  { quoteText: "You are the light of the world.", reference: "— Matthew 5:14" },
  { quoteText: "Let your light shine before others.", reference: "— Matthew 5:16" },
  { quoteText: "Ask, and it will be given to you; seek, and you will find.", reference: "— Matthew 7:7" },
  { quoteText: "Whatever you ask in prayer, believe that you have received it.", reference: "— Mark 11:24" },
  { quoteText: "Man shall not live by bread alone.", reference: "— Matthew 4:4" },
  { quoteText: "Blessed are the poor in spirit, for theirs is the kingdom of heaven.", reference: "— Matthew 5:3" },
  { quoteText: "Blessed are those who mourn, for they shall be comforted.", reference: "— Matthew 5:4" },
  { quoteText: "Blessed are the meek, for they shall inherit the earth.", reference: "— Matthew 5:5" },
  { quoteText: "Blessed are those who hunger and thirst for righteousness.", reference: "— Matthew 5:6" },
  { quoteText: "Blessed are the merciful, for they shall receive mercy.", reference: "— Matthew 5:7" },
  { quoteText: "Blessed are the pure in heart, for they shall see God.", reference: "— Matthew 5:8" },
  { quoteText: "Blessed are the peacemakers.", reference: "— Matthew 5:9" },
  { quoteText: "You shall love the Lord your God with all your heart.", reference: "— Matthew 22:37" },
  { quoteText: "Take heart; I have overcome the world.", reference: "— John 16:33" },
  { quoteText: "I am the way, and the truth, and the life.", reference: "— John 14:6" },
  { quoteText: "I am the resurrection and the life.", reference: "— John 11:25" },
  { quoteText: "Greater love has no one than this, that someone lay down his life for his friends.", reference: "— John 15:13" },
  { quoteText: "In the world you will have tribulation. But take heart; I have overcome the world.", reference: "— John 16:33" },
  { quoteText: "The Lord is my light and my salvation; whom shall I fear?", reference: "— Psalm 27:1" },
  { quoteText: "O Lord, you have searched me and known me.", reference: "— Psalm 139:1" },
  { quoteText: "When I am afraid, I put my trust in you.", reference: "— Psalm 56:3" },
  { quoteText: "He only is my rock and my salvation.", reference: "— Psalm 62:6" },
  { quoteText: "Taste and see that the Lord is good.", reference: "— Psalm 34:8" },
  { quoteText: "Oh, magnify the Lord with me, and let us exalt his name together.", reference: "— Psalm 34:3" },
  { quoteText: "The name of the Lord is a strong tower.", reference: "— Proverbs 18:10" },
  { quoteText: "A gentle answer turns away wrath.", reference: "— Proverbs 15:1" },
  { quoteText: "Commit your work to the Lord, and your plans will be established.", reference: "— Proverbs 16:3" },
  { quoteText: "Whoever walks in integrity walks securely.", reference: "— Proverbs 10:9" },
  { quoteText: "The fear of the Lord is the beginning of wisdom.", reference: "— Proverbs 9:10" },
  { quoteText: "Above all else, guard your heart.", reference: "— Proverbs 4:23" },
  { quoteText: "Gracious words are like a honeycomb, sweetness to the soul.", reference: "— Proverbs 16:24" },
  { quoteText: "Iron sharpens iron.", reference: "— Proverbs 27:17" },
  { quoteText: "Many are the plans in the mind of a man, but it is the purpose of the Lord that will stand.", reference: "— Proverbs 19:21" },
  { quoteText: "The Lord is righteous in all his ways.", reference: "— Psalm 145:17" },
  { quoteText: "I sought the Lord, and he answered me.", reference: "— Psalm 34:4" },
  { quoteText: "This is the day that the Lord has made; let us rejoice and be glad in it.", reference: "— Psalm 118:24" },
  { quoteText: "Give thanks to the Lord, for he is good.", reference: "— Psalm 107:1" },
  { quoteText: "Enter his gates with thanksgiving.", reference: "— Psalm 100:4" },
  { quoteText: "Oh give thanks to the Lord, for he is good; his steadfast love endures forever!", reference: "— Psalm 118:1" },
  { quoteText: "The Lord is my strength and my shield.", reference: "— Psalm 28:7" },
  { quoteText: "You are a hiding place for me.", reference: "— Psalm 32:7" },
  { quoteText: "Lead me in your truth and teach me.", reference: "— Psalm 25:5" },
  { quoteText: "Teach me your way, O Lord.", reference: "— Psalm 27:11" },
  { quoteText: "Let me hear in the morning of your steadfast love.", reference: "— Psalm 143:8" },
  { quoteText: "Satisfy us in the morning with your steadfast love.", reference: "— Psalm 90:14" },
  { quoteText: "The heavens declare the glory of God.", reference: "— Psalm 19:1" },
  { quoteText: "When I look at your heavens, the work of your fingers…", reference: "— Psalm 8:3" },
  { quoteText: "O Lord, our Lord, how majestic is your name in all the earth!", reference: "— Psalm 8:1" },
  { quoteText: "I lift up my eyes to the hills. From where does my help come?", reference: "— Psalm 121:1" },
  { quoteText: "My help comes from the Lord, who made heaven and earth.", reference: "— Psalm 121:2" },
  { quoteText: "Unless the Lord builds the house, those who build it labor in vain.", reference: "— Psalm 127:1" },
  { quoteText: "Children are a heritage from the Lord.", reference: "— Psalm 127:3" },
  { quoteText: "How good and pleasant it is when brothers dwell in unity!", reference: "— Psalm 133:1" },
  { quoteText: "Out of the depths I cry to you, O Lord!", reference: "— Psalm 130:1" },
  { quoteText: "The Lord is my rock and my fortress and my deliverer.", reference: "— Psalm 18:2" },
  { quoteText: "The Lord is merciful and gracious, slow to anger.", reference: "— Psalm 103:8" },
  { quoteText: "As far as the east is from the west, so far does he remove our transgressions.", reference: "— Psalm 103:12" },
  { quoteText: "For as high as the heavens are above the earth, so great is his steadfast love.", reference: "— Psalm 103:11" },
  { quoteText: "Bless the Lord, O my soul, and all that is within me, bless his holy name!", reference: "— Psalm 103:1" },
  { quoteText: "He heals the brokenhearted and binds up their wounds.", reference: "— Psalm 147:3" },
  { quoteText: "The Lord lifts up the humble.", reference: "— Psalm 147:6" },
  { quoteText: "Praise the Lord! Praise God in his sanctuary.", reference: "— Psalm 150:1" },
  { quoteText: "Let everything that has breath praise the Lord!", reference: "— Psalm 150:6" },
];

export function dayOfYearFromDate(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

export function getDefaultDailyQuote(dayOfYear: number): DailyQuote {
  const n = QUOTES.length;
  const idx = ((dayOfYear - 1) % n + n) % n;
  return QUOTES[idx]!;
}

export function parseCalendarDateString(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(y, mo - 1, day);
  if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== day) return null;
  return d;
}
