import { filterAllowedCategories } from "./categoriesAllowlist";
import { NANO_MODEL, OPENAI_RESPONSES_URL, extractOutputText, getOpenAIKey, openAIHeaders } from "./openai";
import { pick, randInt } from "./simulatedActivityRandom";

type ContentLengthTier = "short" | "normal" | "long";

const LENGTH_TIERS: { tier: ContentLengthTier; weight: number }[] = [
  { tier: "short", weight: 0.28 },
  { tier: "normal", weight: 0.52 },
  { tier: "long", weight: 0.2 },
];

const POST_LENGTH: Record<
  ContentLengthTier,
  { prompt: string; min: number; max: number }
> = {
  short: { prompt: "One punchy sentence under 90 characters.", min: 15, max: 100 },
  normal: { prompt: "2-4 sentences.", min: 80, max: 420 },
  long: { prompt: "5-7 sentences with specific detail.", min: 350, max: 1200 },
};

const COMMENT_LENGTH: Record<
  ContentLengthTier,
  { prompt: string; min: number; max: number }
> = {
  short: { prompt: "One brief line under 45 characters.", min: 8, max: 55 },
  normal: { prompt: "1-2 sentences.", min: 40, max: 200 },
  long: { prompt: "2-4 sentences referencing the post.", min: 150, max: 400 },
};

const FALLBACK_TEMPLATES: { category: string; text: string; tier: ContentLengthTier }[] = [
  {
    category: "anxiety",
    tier: "short",
    text: "Heavy week — please pray for peace.",
  },
  {
    category: "anxiety",
    tier: "normal",
    text: "The news has been heavy this week and I'm carrying a lot of worry. Please pray for peace and for wisdom about what I can actually control.",
  },
  {
    category: "anxiety",
    tier: "long",
    text: "I've been anxious for weeks about things I can't fix, and it's starting to wear on my sleep and my patience at home. I'm trying to trust God but some nights my mind won't quiet down. Please pray for rest, for perspective, and for me to remember I'm held even when everything feels uncertain.",
  },
  {
    category: "gratitude",
    tier: "short",
    text: "Small miracle today — grateful.",
  },
  {
    category: "gratitude",
    tier: "normal",
    text: "Small miracle today — something I'd been waiting on finally came through. Thankful and wanting to remember God was in it the whole time.",
  },
  {
    category: "gratitude",
    tier: "long",
    text: "After months of waiting, we finally got the answer we hoped for at work today. I don't take that for granted — so many doors closed before this one opened. Thankful for everyone who prayed with us and for the reminder that God's timing isn't mine. Celebrating quietly and giving Him the credit.",
  },
  {
    category: "healing",
    tier: "short",
    text: "Pray for my friend's recovery.",
  },
  {
    category: "healing",
    tier: "normal",
    text: "A friend is recovering after surgery and the road ahead feels long. Praying for strength, good care, and healing that surprises the doctors.",
  },
  {
    category: "healing",
    tier: "long",
    text: "My friend had unexpected complications after surgery and the recovery timeline keeps shifting. She's tired and scared, and her family is running on fumes. Please pray for skilled care, for pain to ease, for hope on the hard days, and for healing that goes beyond what any scan can measure.",
  },
  {
    category: "guidance",
    tier: "short",
    text: "Big decision coming — need clarity.",
  },
  {
    category: "guidance",
    tier: "normal",
    text: "Big decision at work this month and I don't want to move from fear. Asking for clarity and doors that only God can open.",
  },
  {
    category: "guidance",
    tier: "long",
    text: "I'm at a crossroads with my career and every option has tradeoffs I can't see clearly yet. I don't want to choose from panic or pride — I want to choose from faith. Please pray for wise counsel, for closed doors to close cleanly, and for peace when the right path becomes obvious.",
  },
  {
    category: "relationships",
    tier: "short",
    text: "Tension at home — pray for grace.",
  },
  {
    category: "relationships",
    tier: "normal",
    text: "Tension at home after a hard conversation. We love each other but we're both tired. Pray for soft hearts and honest grace.",
  },
  {
    category: "peace",
    tier: "normal",
    text: "Couldn't sleep last night — mind racing about everything happening in the world. Pray for rest and a quiet spirit today.",
  },
  {
    category: "hope",
    tier: "long",
    text: "It's been a gray season and some days hope feels like work instead of gift. I'm not giving up — I'm asking for light, for small signs of renewal, and for people who will sit with me without trying to fix everything. Pray I keep showing up and believing morning is coming.",
  },
];

const COMMENT_TEMPLATES: { text: string; tier: ContentLengthTier }[] = [
  { tier: "short", text: "Praying for you." },
  { tier: "short", text: "Amen." },
  { tier: "short", text: "God hears you." },
  { tier: "short", text: "Standing with you." },
  { tier: "normal", text: "Praying for you right now. God sees every tear." },
  { tier: "normal", text: "Lifting you up. You are not alone in this." },
  { tier: "normal", text: "The Lord is near to the brokenhearted. Praying for comfort." },
  { tier: "normal", text: "Standing with you in prayer. God is faithful." },
  { tier: "normal", text: "You're in my prayers today and every day." },
  { tier: "long", text: "I've been where you are — the waiting is exhausting. Praying God gives you strength for today only, and people who show up without needing perfect words." },
  { tier: "long", text: "Thank you for sharing this honestly. I'm asking the Lord to meet you in the middle of the uncertainty and to surprise you with provision you didn't see coming." },
];

export type GeneratedPrayer = { content: string; category: string | null };

export function pickContentLengthTier(): ContentLengthTier {
  const roll = Math.random();
  let acc = 0;
  for (const entry of LENGTH_TIERS) {
    acc += entry.weight;
    if (roll <= acc) return entry.tier;
  }
  return "normal";
}

function fallbackPrayer(tier: ContentLengthTier = pickContentLengthTier()): GeneratedPrayer {
  const pool = FALLBACK_TEMPLATES.filter((item) => item.tier === tier);
  const item = pick(pool.length > 0 ? pool : FALLBACK_TEMPLATES);
  return { content: item.text, category: item.category };
}

function monthContext(): string {
  return new Date().toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "America/New_York" });
}

export async function generateSimulatedPrayerPost(): Promise<GeneratedPrayer> {
  const tier = pickContentLengthTier();
  const bounds = POST_LENGTH[tier];
  const apiKey = getOpenAIKey();
  if (!apiKey) return fallbackPrayer(tier);

  const categories = [
    "anxiety",
    "gratitude",
    "healing",
    "guidance",
    "relationships",
    "provision",
    "hope",
    "family",
    "mental health",
    "peace",
    "work/career",
    "health",
  ];
  const category = pick(categories);

  try {
    const res = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: openAIHeaders(apiKey),
      body: JSON.stringify({
        model: NANO_MODEL,
        input: [
          {
            role: "system",
            content:
              `You write authentic prayer-request posts for a Christian prayer app. Sound like a real person, not a bot. No hashtags, emojis, or quotation marks around the post. ${bounds.prompt}`,
          },
          {
            role: "user",
            content: `Write one prayer request post for category "${category}". Reference something timely for ${monthContext()} — news, season, work, family, health, or everyday life. Return JSON only: {"content":"...","category":"${category}"}`,
          },
        ],
        text: { format: { type: "json_object" } },
      }),
    });

    if (!res.ok) return fallbackPrayer(tier);

    const data = (await res.json()) as unknown;
    const raw = extractOutputText(data);
    if (!raw) return fallbackPrayer(tier);

    const parsed = JSON.parse(raw) as { content?: unknown; category?: unknown };
    const content = typeof parsed.content === "string" ? parsed.content.trim() : "";
    if (content.length < bounds.min || content.length > bounds.max) return fallbackPrayer(tier);

    const tags = filterAllowedCategories([
      typeof parsed.category === "string" ? parsed.category : category,
    ]);
    return { content, category: tags[0] ?? category };
  } catch {
    return fallbackPrayer(tier);
  }
}

export function pickSimulatedComment(tier: ContentLengthTier = pickContentLengthTier()): string {
  const pool = COMMENT_TEMPLATES.filter((item) => item.tier === tier);
  return pick(pool.length > 0 ? pool : COMMENT_TEMPLATES).text;
}

export async function generateSimulatedComment(
  postContent: string,
  opts?: { realUserPost?: boolean },
): Promise<string> {
  const realUserPost = opts?.realUserPost === true;
  const tier = pickContentLengthTier();
  const bounds = COMMENT_LENGTH[tier];
  if (Math.random() > (realUserPost ? 0.2 : 0.35)) return pickSimulatedComment(tier);

  const apiKey = getOpenAIKey();
  if (!apiKey) return pickSimulatedComment(tier);

  try {
    const res = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: openAIHeaders(apiKey),
      body: JSON.stringify({
        model: NANO_MODEL,
        input: [
          {
            role: "system",
            content:
              realUserPost
                ? `Write a supportive comment on a prayer app. Warm, Christian, human. Sound like a real person who read their post — reference something specific when possible. No hashtags. ${bounds.prompt}`
                : `Write a supportive comment on a prayer app. Warm, Christian, human. No hashtags. ${bounds.prompt}`,
          },
          {
            role: "user",
            content: `Prayer post:\n${postContent.slice(0, 800)}\n\nWrite one comment.`,
          },
        ],
      }),
    });
    if (!res.ok) return pickSimulatedComment(tier);
    const data = (await res.json()) as unknown;
    const text = extractOutputText(data)?.trim();
    if (!text || text.length < bounds.min || text.length > bounds.max) return pickSimulatedComment(tier);
    return text;
  } catch {
    return pickSimulatedComment(tier);
  }
}

export function engagementCountForPost(realUserPost: boolean): number {
  return realUserPost ? randInt(5, 15) : randInt(3, 12);
}

export function engagementDelayMs(realUserPost: boolean): number {
  const minH = realUserPost ? 1 : 0.5;
  const maxH = realUserPost ? 48 : 24;
  return randInt(Math.floor(minH * 60), Math.floor(maxH * 60)) * 60_000;
}
