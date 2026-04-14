export const NANO_MODEL = "gpt-4.1-nano";
export const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
export const OPENAI_MODERATION_URL = "https://api.openai.com/v1/moderations";

export function getOpenAIKey(): string | null {
  return process.env.OPENAI_API_KEY ?? null;
}

export function openAIHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

/**
 * Extract the text from an OpenAI Responses API result.
 * Handles both nested `output[0].content[].text` and flat `output_text`.
 */
export function extractOutputText(data: any): string | undefined {
  return (
    data?.output?.[0]?.content?.find?.((c: any) => c?.type === "output_text")?.text ??
    data?.output_text
  );
}
