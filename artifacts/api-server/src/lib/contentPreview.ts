/** Teaser text for locked premium content — paragraph-aware, ~40% of body. */
export function buildContentPreview(full: string): { preview: string; locked: boolean } {
  const text = full.trim();
  if (!text) return { preview: "", locked: false };

  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  if (paragraphs.length <= 1) {
    const targetLen = Math.max(80, Math.ceil(text.length * 0.4));
    if (targetLen >= text.length) return { preview: text, locked: false };
    let cut = targetLen;
    const slice = text.slice(0, cut);
    const lastSpace = slice.lastIndexOf(" ");
    if (lastSpace > cut * 0.6) cut = lastSpace;
    return { preview: `${text.slice(0, cut).trim()}…`, locked: true };
  }

  const takeCount = Math.min(3, Math.max(1, Math.ceil(paragraphs.length * 0.4)));
  if (takeCount >= paragraphs.length) return { preview: text, locked: false };
  return { preview: paragraphs.slice(0, takeCount).join("\n\n"), locked: true };
}
