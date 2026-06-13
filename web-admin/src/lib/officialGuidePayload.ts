/** Send null when scripture is blank so the API treats it as optional. */
export function scriptureForApi(raw: string | null | undefined): string | null {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}
