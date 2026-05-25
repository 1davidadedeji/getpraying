import { postShareUrl } from "@/lib/publicWebOrigin";

type ShareablePost = {
  id: number;
  content: string;
  mediaType?: string | null;
  prayCount: number;
  isAnonymous?: boolean;
  authorDisplayName?: string | null;
  authorUsername?: string | null;
};

function postSharePreviewText(content: string, mediaType?: string | null): string {
  const trimmed = content.trim();
  if (trimmed.length > 0) {
    const snippet = `${trimmed.slice(0, 200)}${trimmed.length > 200 ? "\u2026" : ""}`;
    return `"${snippet}"`;
  }
  if (mediaType === "image") return "A photo prayer";
  if (mediaType === "video") return "A video prayer";
  if (mediaType === "audio") return "An audio prayer";
  return "A prayer on Get Praying";
}

/** Native share sheet payload for a feed or detail post. */
export function buildPostSharePayload(post: ShareablePost): { message: string; url: string } {
  const url = postShareUrl(post.id);
  const authorName = post.isAnonymous
    ? "Anonymous"
    : post.authorDisplayName ?? post.authorUsername ?? "Someone";
  const preview = postSharePreviewText(post.content, post.mediaType);
  const prayingLine =
    post.prayCount === 1
      ? "❤️ 1 person praying with them"
      : `❤️ ${post.prayCount} people praying with them`;
  const message =
    `${preview}\n\n` +
    `🙏 Shared by ${authorName}\n` +
    `${prayingLine}\n\n` +
    `Tap to join on Get Praying:\n` +
    url;
  return { message, url };
}
