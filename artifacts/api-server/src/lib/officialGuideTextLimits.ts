/** Curated official guides — keep copy readable in the app; enforced on create/update. */
export const OFFICIAL_GUIDE_TITLE_MAX = 160;
export const OFFICIAL_GUIDE_CONTENT_MAX = 4000;
export const OFFICIAL_GUIDE_SCRIPTURE_MAX = 500;

export function officialGuideTextError(opts: {
  title: string;
  content: string;
  scripture: string | null;
}): string | null {
  if (opts.title.length > OFFICIAL_GUIDE_TITLE_MAX) {
    return `Title must be ${OFFICIAL_GUIDE_TITLE_MAX} characters or fewer.`;
  }
  if (opts.content.length > OFFICIAL_GUIDE_CONTENT_MAX) {
    return `Description must be ${OFFICIAL_GUIDE_CONTENT_MAX} characters or fewer.`;
  }
  if (opts.scripture && opts.scripture.length > OFFICIAL_GUIDE_SCRIPTURE_MAX) {
    return `Scripture must be ${OFFICIAL_GUIDE_SCRIPTURE_MAX} characters or fewer.`;
  }
  return null;
}
