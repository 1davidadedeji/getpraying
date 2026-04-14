/**
 * AI moderation pipeline for GetPraying:
 *   1. OpenAI Moderation API (free) — checks for violence, hate, sexual content, etc.
 *   2. GPT-4.1-nano (cheapest) — determines if content is actually a prayer/spiritual ask
 *
 * Posts that pass both steps are auto-approved. Otherwise they're rejected or queued.
 */

export type ModerationResult =
  | { outcome: "approved"; category: string | null }
  | { outcome: "rejected"; reason: string }
  | { outcome: "queue"; reason: string };

const NANO_MODEL = "gpt-4.1-nano";

function getApiKey(): string | null {
  return process.env.OPENAI_API_KEY ?? null;
}

function extractOutputText(data: any): string | undefined {
  return (
    data?.output?.[0]?.content?.find?.((c: any) => c?.type === "output_text")?.text ??
    data?.output_text
  );
}

/**
 * Step 1: Free OpenAI moderation check — flags harmful content.
 */
async function checkModeration(content: string): Promise<{ flagged: boolean; categories: string[] }> {
  const apiKey = getApiKey();
  if (!apiKey) return { flagged: false, categories: [] };

  const res = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: content }),
  });

  if (!res.ok) return { flagged: false, categories: [] };

  const data = await res.json();
  const result = data?.results?.[0];
  if (!result) return { flagged: false, categories: [] };

  const flaggedCats: string[] = [];
  if (result.categories) {
    for (const [cat, flagged] of Object.entries(result.categories)) {
      if (flagged) flaggedCats.push(cat);
    }
  }

  return { flagged: !!result.flagged, categories: flaggedCats };
}

/**
 * Step 2: GPT-4.1-nano — is this a prayer / spiritual ask?
 */
async function checkIsPrayer(content: string): Promise<"approve" | "reject"> {
  const apiKey = getApiKey();
  if (!apiKey) return "approve";

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: NANO_MODEL,
      input: [
        {
          role: "user",
          content:
            `Is this a prayer, praise, devotion, testimony, or spiritual request for a Christian prayer app? ` +
            `Say only "approve" or "reject". If it is not related to faith, prayer, or spirituality, reject it.\n\n` +
            `"${content}"`,
        },
      ],
      temperature: 0,
      max_output_tokens: 16,
    }),
  });

  if (!res.ok) return "approve";

  const data = await res.json();
  const text = (extractOutputText(data) ?? "").trim().toLowerCase();
  return text.startsWith("reject") ? "reject" : "approve";
}

/**
 * Full moderation pipeline. Returns the outcome and reason.
 * Staff posts skip this entirely (handled by the caller).
 */
export async function moderatePost(content: string): Promise<ModerationResult> {
  try {
    // Step 1: Free moderation
    const mod = await checkModeration(content);
    if (mod.flagged) {
      return {
        outcome: "rejected",
        reason: `Content flagged for: ${mod.categories.join(", ")}`,
      };
    }

    // Step 2: Nano prayer check
    const prayerCheck = await checkIsPrayer(content);
    if (prayerCheck === "reject") {
      return {
        outcome: "rejected",
        reason: "This doesn't appear to be a prayer, praise, or spiritual request.",
      };
    }

    return { outcome: "approved", category: null };
  } catch {
    // If AI fails, queue for human review rather than blocking the user
    return { outcome: "queue", reason: "AI moderation unavailable — queued for review." };
  }
}

/**
 * AI-powered rewrite using nano for cost efficiency.
 */
export async function aiRewrite(content: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("AI service not configured");

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: NANO_MODEL,
      input: [
        {
          role: "system",
          content:
            "You help people write prayer requests and praises for a Christian prayer app. " +
            "Rewrite the text with more clarity, emotional depth, and spiritual sensitivity. " +
            "Keep the same meaning. Keep it under 2000 characters. " +
            "Return ONLY the rewritten text, nothing else.",
        },
        { role: "user", content: content.trim() },
      ],
      temperature: 0.7,
      max_output_tokens: 600,
    }),
  });

  if (!res.ok) throw new Error("AI service is temporarily unavailable");

  const data = await res.json();
  const rewritten = extractOutputText(data);
  if (!rewritten || typeof rewritten !== "string") {
    throw new Error("AI returned empty response");
  }

  return rewritten.trim();
}
