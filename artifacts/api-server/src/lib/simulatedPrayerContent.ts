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

export type CommentTheme =
  | "healing"
  | "anxiety"
  | "gratitude"
  | "work"
  | "family"
  | "relationships"
  | "guidance"
  | "provision"
  | "hope"
  | "peace"
  | "general";

const THEME_KEYWORDS: { theme: CommentTheme; patterns: RegExp[] }[] = [
  {
    theme: "healing",
    patterns: [
      /\bheal(ing|ed)?\b/i,
      /\bsurgery\b/i,
      /\brecover(y|ing)?\b/i,
      /\bhospital\b/i,
      /\bcancer\b/i,
      /\billness\b/i,
      /\bdiagnos/i,
      /\bpain\b/i,
      /\bdoctor/i,
    ],
  },
  {
    theme: "anxiety",
    patterns: [
      /\banxi/i,
      /\bworr(y|ied|ies)\b/i,
      /\bstress(ed|ful)?\b/i,
      /\bfear(ful|s)?\b/i,
      /\bpanic\b/i,
      /\bmind (won'?t|racing|spinning)\b/i,
      /\boverwhelm/i,
    ],
  },
  {
    theme: "gratitude",
    patterns: [
      /\bgrateful\b/i,
      /\bthank(ful|s)?\b/i,
      /\bpraise\b/i,
      /\bblessing/i,
      /\bmiracle\b/i,
      /\banswered\b/i,
    ],
  },
  {
    theme: "work",
    patterns: [
      /\bwork\b/i,
      /\bjob\b/i,
      /\bcareer\b/i,
      /\binterview\b/i,
      /\bboss\b/i,
      /\bworkplace\b/i,
      /\bcoworker/i,
      /\bunemployment\b/i,
      /\blayoff/i,
    ],
  },
  {
    theme: "family",
    patterns: [
      /\bfamily\b/i,
      /\bmom\b/i,
      /\bdad\b/i,
      /\bmother\b/i,
      /\bfather\b/i,
      /\bparent/i,
      /\bkid(s)?\b/i,
      /\bchild(ren)?\b/i,
      /\bson\b/i,
      /\bdaughter\b/i,
      /\bspouse\b/i,
      /\bwife\b/i,
      /\bhusband\b/i,
    ],
  },
  {
    theme: "relationships",
    patterns: [
      /\brelationship/i,
      /\bmarriage\b/i,
      /\bfriend(ship)?\b/i,
      /\btension\b/i,
      /\bconflict\b/i,
      /\breconcile/i,
      /\bforgiveness\b/i,
    ],
  },
  {
    theme: "guidance",
    patterns: [
      /\bguidance\b/i,
      /\bdecision\b/i,
      /\bclarity\b/i,
      /\bwisdom\b/i,
      /\bdirection\b/i,
      /\bcrossroads\b/i,
      /\bdiscern/i,
    ],
  },
  {
    theme: "provision",
    patterns: [
      /\bprovision\b/i,
      /\bfinanc/i,
      /\bmoney\b/i,
      /\bbills?\b/i,
      /\brent\b/i,
      /\bdebt\b/i,
      /\bprovid/i,
    ],
  },
  {
    theme: "hope",
    patterns: [/\bhope\b/i, /\bwaiting\b/i, /\bweary\b/i, /\bgray season\b/i, /\bdiscourag/i],
  },
  {
    theme: "peace",
    patterns: [/\bpeace\b/i, /\brest\b/i, /\bsleep\b/i, /\bquiet\b/i, /\bcalm\b/i],
  },
];

const COMMENT_BY_THEME: Record<
  CommentTheme,
  { tier: ContentLengthTier; text: string }[]
> = {
  healing: [
    { tier: "short", text: "Praying for healing and strength." },
    { tier: "short", text: "Asking God for a good recovery." },
    { tier: "normal", text: "Praying for skilled care, eased pain, and healing that surprises everyone." },
    { tier: "normal", text: "Lifting up this recovery — strength for today and hope for tomorrow." },
    { tier: "long", text: "Thank you for sharing this. I'm praying for the recovery ahead — for rest, good care, and healing that goes deeper than any scan can show." },
  ],
  anxiety: [
    { tier: "short", text: "Praying for peace over that anxiety." },
    { tier: "short", text: "Asking God to quiet your mind." },
    { tier: "normal", text: "Praying the Lord settles your thoughts and gives rest you can feel." },
    { tier: "normal", text: "Standing with you — asking for peace in the middle of the worry." },
    { tier: "long", text: "I've felt that racing mind too. Praying God gives you one calm breath at a time, and reminds you that you don't have to carry all of this alone." },
  ],
  gratitude: [
    { tier: "short", text: "Celebrating this with you — amen!" },
    { tier: "short", text: "Praise God for this blessing." },
    { tier: "normal", text: "So glad you shared this. Giving thanks with you for what God has done." },
    { tier: "normal", text: "This is beautiful — praying you keep noticing His kindness in the details." },
    { tier: "long", text: "Thank you for pointing us back to gratitude. I'm praising God with you and praying this reminder of His faithfulness stays close when harder days come." },
  ],
  work: [
    { tier: "short", text: "Praying for clarity at work." },
    { tier: "short", text: "Asking God to open the right door." },
    { tier: "normal", text: "Praying over this job situation — wisdom, favor, and doors only God can open." },
    { tier: "normal", text: "Lifting up your work decision. Asking for peace and clear next steps." },
    { tier: "long", text: "Work decisions can weigh so heavy. I'm praying for wise counsel, closed doors that close cleanly, and courage to walk through the right one when it opens." },
  ],
  family: [
    { tier: "short", text: "Praying for your family today." },
    { tier: "short", text: "Asking God to cover your home." },
    { tier: "normal", text: "Praying for grace and soft hearts in your family right now." },
    { tier: "normal", text: "Lifting up your loved ones — for protection, unity, and peace at home." },
    { tier: "long", text: "Family needs hit differently. I'm praying for every person you named in your heart — for patience, healing conversations, and God's nearness in your home." },
  ],
  relationships: [
    { tier: "short", text: "Praying for grace in that relationship." },
    { tier: "short", text: "Asking God to soften hearts." },
    { tier: "normal", text: "Praying for honest words, soft hearts, and real reconciliation where it's needed." },
    { tier: "normal", text: "Standing with you — asking God to bring peace into that tension." },
    { tier: "long", text: "Relationships can be so tender and so hard. Praying for wisdom in how you show up, for forgiveness where it's needed, and for God to restore what feels broken." },
  ],
  guidance: [
    { tier: "short", text: "Praying for clear guidance." },
    { tier: "short", text: "Asking God for wisdom here." },
    { tier: "normal", text: "Praying for clarity on this decision and peace when the path becomes clear." },
    { tier: "normal", text: "Asking the Lord to light the next step — not the whole staircase." },
    { tier: "long", text: "Crossroads are exhausting. I'm praying for wise counsel, for closed doors to close cleanly, and for a settled peace when the right direction becomes obvious." },
  ],
  provision: [
    { tier: "short", text: "Praying for God's provision." },
    { tier: "short", text: "Asking the Lord to provide." },
    { tier: "normal", text: "Praying for timely provision and peace while you wait on God to make a way." },
    { tier: "normal", text: "Lifting up these needs — asking God to meet you in practical ways." },
    { tier: "long", text: "Financial pressure is so heavy. I'm asking God to provide what you need, open unexpected doors, and give you rest from the constant calculating." },
  ],
  hope: [
    { tier: "short", text: "Praying hope rises again." },
    { tier: "short", text: "Asking God for light in this season." },
    { tier: "normal", text: "Praying for fresh hope and strength to keep showing up while you wait." },
    { tier: "normal", text: "Standing with you — asking God to send small signs that morning is coming." },
    { tier: "long", text: "Waiting seasons are long. I'm praying God renews your hope, sends people who sit with you, and reminds you that this chapter isn't the whole story." },
  ],
  peace: [
    { tier: "short", text: "Praying for deep peace tonight." },
    { tier: "short", text: "Asking God for real rest." },
    { tier: "normal", text: "Praying the Lord quiets your spirit and gives rest you can feel in your body." },
    { tier: "normal", text: "Lifting you up — asking for calm where things feel noisy." },
    { tier: "long", text: "When peace feels far, I'm praying God draws near — settling your thoughts, easing the tension, and giving you rest that lasts past the morning." },
  ],
  general: [
    { tier: "short", text: "Praying specifically over what you shared." },
    { tier: "short", text: "God hears every word of this." },
    { tier: "normal", text: "Thank you for trusting us with this. I'm praying over every detail you named." },
    { tier: "normal", text: "Lifting this request up — asking God to meet you right in the middle of it." },
    { tier: "long", text: "Thank you for sharing this honestly. I'm asking the Lord to meet you in the specifics of what you wrote and to surprise you with His nearness and help." },
  ],
};

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

/** Detect the dominant prayer theme from post text for correlated bot comments. */
export function detectCommentTheme(postContent: string): CommentTheme {
  const text = postContent.trim();
  if (!text) return "general";

  let best: CommentTheme = "general";
  let bestScore = 0;
  for (const entry of THEME_KEYWORDS) {
    let score = 0;
    for (const re of entry.patterns) {
      if (re.test(text)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = entry.theme;
    }
  }
  return bestScore > 0 ? best : "general";
}

export function pickSimulatedComment(
  postContent: string,
  tier: ContentLengthTier = pickContentLengthTier(),
): string {
  const theme = detectCommentTheme(postContent);
  const themed = COMMENT_BY_THEME[theme];
  const pool = themed.filter((item) => item.tier === tier);
  return pick(pool.length > 0 ? pool : themed).text;
}

export async function generateSimulatedComment(
  postContent: string,
  opts?: { realUserPost?: boolean },
): Promise<string> {
  const realUserPost = opts?.realUserPost === true;
  const tier = pickContentLengthTier();
  const bounds = COMMENT_LENGTH[tier];
  const fallback = () => pickSimulatedComment(postContent, tier);

  // Prefer post-aware AI; keep a small share of short themed fallbacks for variety.
  const useFallbackFlavor = Math.random() < (realUserPost ? 0.12 : 0.18);
  if (useFallbackFlavor) return fallback();

  const apiKey = getOpenAIKey();
  if (!apiKey) return fallback();

  const theme = detectCommentTheme(postContent);

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
              `Write a supportive comment on a Christian prayer app. Warm and human — like someone who actually read the post. ` +
              `You MUST reference something specific from the prayer (the situation, person, decision, need, or hope). ` +
              `Do not write vague lines like "Praying for you", "Amen", or "Standing with you" unless you also name the specific ask. ` +
              `No hashtags, no emojis, no quotation marks around the comment. Detected theme hint: ${theme}. ${bounds.prompt}`,
          },
          {
            role: "user",
            content: `Prayer post:\n${postContent.slice(0, 800)}\n\nWrite one comment that clearly relates to this post.`,
          },
        ],
      }),
    });
    if (!res.ok) return fallback();
    const data = (await res.json()) as unknown;
    const text = extractOutputText(data)?.trim();
    if (!text || text.length < bounds.min || text.length > bounds.max) return fallback();
    return text;
  } catch {
    return fallback();
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
