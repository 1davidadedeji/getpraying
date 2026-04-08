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
] as const;

export type Category = (typeof CATEGORIES)[number];

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

async function callOpenAIForCategory(content: string): Promise<Category> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const input = [
    {
      role: "system",
      content:
        "You are a classifier for a prayer app. Choose exactly one category from the allowed list and return only strict JSON.",
    },
    {
      role: "user",
      content: JSON.stringify({
        allowed_categories: CATEGORIES,
        prayer_text: content,
        output_format: { category: "<one_of_allowed_categories>" },
      }),
    },
  ];

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input,
      temperature: 0,
      max_output_tokens: 50,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI error: HTTP ${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`);
  }

  const data: any = await res.json();
  const rawText: string | undefined =
    data?.output?.[0]?.content?.find?.((c: any) => c?.type === "output_text")?.text ??
    data?.output_text;

  if (!rawText || typeof rawText !== "string") {
    throw new Error("OpenAI response missing output text");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    // Sometimes models wrap JSON in text; extract first {...}
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("OpenAI returned non-JSON output");
    parsed = JSON.parse(match[0]);
  }

  const candidate = parsed?.category;
  if (!isCategory(candidate)) {
    throw new Error("OpenAI returned invalid category");
  }

  return candidate;
}

export async function suggestCategory(content: string): Promise<Category | null> {
  const trimmed = content.trim();
  if (trimmed.length < 10) return null;
  return await callOpenAIForCategory(trimmed);
}

