import {
  NANO_MODEL,
  OPENAI_RESPONSES_URL,
  getOpenAIKey,
  openAIHeaders,
  extractOutputText,
} from "./openai";

const CATEGORIES = [
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

export type Category = (typeof CATEGORIES)[number];

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

async function callOpenAIForCategories(content: string): Promise<Category[]> {
  const apiKey = getOpenAIKey();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const res = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: openAIHeaders(apiKey),
    body: JSON.stringify({
      model: NANO_MODEL,
      input: [
        {
          role: "system",
          content:
            "You are a classifier for a prayer app. Choose 1–3 best-fitting categories from the allowed list and return only strict JSON. Order them by relevance (most relevant first).",
        },
        {
          role: "user",
          content: JSON.stringify({
            allowed_categories: CATEGORIES,
            prayer_text: content,
            output_format: { categories: ["<category1>", "<optional_category2>", "<optional_category3>"] },
          }),
        },
      ],
      temperature: 0,
      max_output_tokens: 80,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI error: HTTP ${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`);
  }

  const rawText = extractOutputText(await res.json());
  if (!rawText || typeof rawText !== "string") {
    throw new Error("OpenAI response missing output text");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("OpenAI returned non-JSON output");
    parsed = JSON.parse(match[0]);
  }

  const rawCategories = parsed?.categories ?? (parsed?.category ? [parsed.category] : []);
  const valid = (Array.isArray(rawCategories) ? rawCategories : [rawCategories])
    .filter(isCategory)
    .slice(0, 3);

  if (valid.length === 0) throw new Error("OpenAI returned no valid categories");
  return valid;
}

/** Returns the primary (best) category for storing in the DB. */
export async function suggestCategory(content: string): Promise<Category | null> {
  const trimmed = content.trim();
  if (trimmed.length < 10) return null;
  const categories = await callOpenAIForCategories(trimmed);
  return categories[0] ?? null;
}

/** Returns all suggested categories (1–3) for the UI to auto-select. */
export async function suggestCategories(content: string): Promise<Category[]> {
  const trimmed = content.trim();
  if (trimmed.length < 10) return [];
  return await callOpenAIForCategories(trimmed);
}

