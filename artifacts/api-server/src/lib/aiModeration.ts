import {
  NANO_MODEL,
  OPENAI_RESPONSES_URL,
  OPENAI_MODERATION_URL,
  getOpenAIKey,
  openAIHeaders,
  extractOutputText,
} from "./openai";

export type ModerationResult =
  | { outcome: "approved"; category: string | null }
  | { outcome: "rejected"; reason: string }
  | { outcome: "queue"; reason: string };

async function checkModeration(content: string): Promise<{ flagged: boolean; categories: string[] }> {
  const apiKey = getOpenAIKey();
  if (!apiKey) return { flagged: false, categories: [] };

  const res = await fetch(OPENAI_MODERATION_URL, {
    method: "POST",
    headers: openAIHeaders(apiKey),
    body: JSON.stringify({ input: content }),
  });

  if (!res.ok) return { flagged: false, categories: [] };

  const data: any = await res.json();
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

async function checkIsPrayer(content: string): Promise<"approve" | "reject"> {
  const apiKey = getOpenAIKey();
  if (!apiKey) return "approve";

  const res = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: openAIHeaders(apiKey),
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

  const text = (extractOutputText(await res.json()) ?? "").trim().toLowerCase();
  return text.startsWith("reject") ? "reject" : "approve";
}

export async function moderatePost(content: string): Promise<ModerationResult> {
  try {
    const mod = await checkModeration(content);
    if (mod.flagged) {
      return { outcome: "rejected", reason: `Content flagged for: ${mod.categories.join(", ")}` };
    }

    if ((await checkIsPrayer(content)) === "reject") {
      return { outcome: "rejected", reason: "This doesn't appear to be a prayer, praise, or spiritual request." };
    }

    return { outcome: "approved", category: null };
  } catch {
    return { outcome: "queue", reason: "AI moderation unavailable — queued for review." };
  }
}

export async function aiRewrite(content: string): Promise<string> {
  const apiKey = getOpenAIKey();
  if (!apiKey) throw new Error("AI service not configured");

  const res = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: openAIHeaders(apiKey),
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

  const rewritten = extractOutputText(await res.json());
  if (!rewritten || typeof rewritten !== "string") {
    throw new Error("AI returned empty response");
  }
  return rewritten.trim();
}
