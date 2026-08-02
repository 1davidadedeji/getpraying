import { filterAllowedCategories } from "./categoriesAllowlist";
import { NANO_MODEL, OPENAI_RESPONSES_URL, extractOutputText, getOpenAIKey, openAIHeaders } from "./openai";
import { pick, randInt } from "./simulatedActivityRandom";

const FALLBACK_TEMPLATES: { category: string; text: string }[] = [
  {
    category: "anxiety",
    text: "The news has been heavy this week and I'm carrying a lot of worry. Please pray for peace and for wisdom about what I can actually control.",
  },
  {
    category: "gratitude",
    text: "Small miracle today — something I'd been waiting on finally came through. Thankful and wanting to remember God was in it the whole time.",
  },
  {
    category: "healing",
    text: "A friend is recovering after surgery and the road ahead feels long. Praying for strength, good care, and healing that surprises the doctors.",
  },
  {
    category: "guidance",
    text: "Big decision at work this month and I don't want to move from fear. Asking for clarity and doors that only God can open.",
  },
  {
    category: "relationships",
    text: "Tension at home after a hard conversation. We love each other but we're both tired. Pray for soft hearts and honest grace.",
  },
  {
    category: "provision",
    text: "Bills stacked up after an unexpected expense. Trusting God as provider but honestly feeling stretched. Pray for provision and calm.",
  },
  {
    category: "hope",
    text: "It's been a gray season and I'm clinging to hope even when I can't feel it. Pray I keep showing up and believing morning is coming.",
  },
  {
    category: "family",
    text: "My kid starts something new next week and they're nervous. Pray for courage for them and patience for us as parents.",
  },
  {
    category: "mental health",
    text: "Motivation has been low and the days blur together. Not giving up — just asking for light, routine, and people who check in.",
  },
  {
    category: "peace",
    text: "Couldn't sleep last night — mind racing about everything happening in the world. Pray for rest and a quiet spirit today.",
  },
];

const COMMENT_TEMPLATES = [
  "Praying for you right now. God sees every tear.",
  "Lifting you up. You are not alone in this.",
  "The Lord is near to the brokenhearted. Praying for comfort.",
  "Standing with you in prayer. God is faithful.",
  "God hears you. He hasn't forgotten. Praying.",
  "You're in my prayers today and every day.",
  "Amen! God's timing is always perfect.",
  "Holding space for you in prayer. You're loved.",
  "Praying God provides exactly what you need.",
  "So encouraged by your faith. Praying alongside you!",
];

export type GeneratedPrayer = { content: string; category: string | null };

function fallbackPrayer(): GeneratedPrayer {
  const item = pick(FALLBACK_TEMPLATES);
  return { content: item.text, category: item.category };
}

function monthContext(): string {
  return new Date().toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "America/New_York" });
}

export async function generateSimulatedPrayerPost(): Promise<GeneratedPrayer> {
  const apiKey = getOpenAIKey();
  if (!apiKey) return fallbackPrayer();

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
              "You write authentic prayer-request posts for a Christian prayer app. Sound like a real person, not a bot. No hashtags, emojis, or quotation marks around the post. 2-4 sentences.",
          },
          {
            role: "user",
            content: `Write one prayer request post for category "${category}". Reference something timely for ${monthContext()} — news, season, work, family, health, or everyday life. Return JSON only: {"content":"...","category":"${category}"}`,
          },
        ],
        text: { format: { type: "json_object" } },
      }),
    });

    if (!res.ok) return fallbackPrayer();

    const data = (await res.json()) as unknown;
    const raw = extractOutputText(data);
    if (!raw) return fallbackPrayer();

    const parsed = JSON.parse(raw) as { content?: unknown; category?: unknown };
    const content = typeof parsed.content === "string" ? parsed.content.trim() : "";
    if (content.length < 20 || content.length > 1200) return fallbackPrayer();

    const tags = filterAllowedCategories([
      typeof parsed.category === "string" ? parsed.category : category,
    ]);
    return { content, category: tags[0] ?? category };
  } catch {
    return fallbackPrayer();
  }
}

export function pickSimulatedComment(): string {
  return pick(COMMENT_TEMPLATES);
}

export async function generateSimulatedComment(postContent: string): Promise<string> {
  if (Math.random() > 0.35) return pickSimulatedComment();

  const apiKey = getOpenAIKey();
  if (!apiKey) return pickSimulatedComment();

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
              "Write a short supportive comment on a prayer app (1-2 sentences). Warm, Christian, human. No hashtags.",
          },
          {
            role: "user",
            content: `Prayer post:\n${postContent.slice(0, 800)}\n\nWrite one comment.`,
          },
        ],
      }),
    });
    if (!res.ok) return pickSimulatedComment();
    const data = (await res.json()) as unknown;
    const text = extractOutputText(data)?.trim();
    if (!text || text.length < 8 || text.length > 400) return pickSimulatedComment();
    return text;
  } catch {
    return pickSimulatedComment();
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
