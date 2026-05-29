/** Double-spaced line height for readable body copy (CMS / admin text). */
export function doubleSpacedLineHeight(fontSize: number): number {
  return Math.round(fontSize * 2);
}

/** Normalize line endings from admin textareas and CMS paste. */
export function normalizeBodyText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/** Split on blank lines for paragraph spacing. */
export function bodyParagraphs(text: string): string[] {
  const normalized = normalizeBodyText(text).trim();
  if (!normalized) return [];
  return normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
}
