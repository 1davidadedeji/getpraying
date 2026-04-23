export function parseCategoryTagsFromRow(post: {
  category: string | null;
  categoryTags: string | null;
}): string[] {
  if (post.categoryTags) {
    try {
      const p = JSON.parse(post.categoryTags) as unknown;
      if (Array.isArray(p) && p.every((x) => typeof x === "string")) {
        return [...new Set(p.map((s) => s.trim()).filter(Boolean))];
      }
    } catch {
      /* invalid json */
    }
  }
  return post.category ? [post.category] : [];
}
