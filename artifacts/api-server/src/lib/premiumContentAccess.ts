import { subscriptionTierGrantsUnlimitedBoost } from "./boostEligibility";
import { buildContentPreview } from "./contentPreview";
import type { LectureTrackDto } from "./lectureTracks";

export type PremiumViewer = {
  role?: string | null;
  subscription?: string | null;
} | null | undefined;

export function userHasPremiumContentAccess(viewer: PremiumViewer): boolean {
  if (!viewer) return false;
  if (viewer.role === "admin" || viewer.role === "moderator") return true;
  return subscriptionTierGrantsUnlimitedBoost(viewer.subscription);
}

export function parseIsPremiumFromBody(body: unknown, fallback = false): boolean {
  if (body == null || typeof body !== "object" || !("isPremium" in body)) return fallback;
  return Boolean((body as { isPremium?: unknown }).isPremium);
}

type OfficialLike = {
  isPremium?: boolean | null;
  scheduleSlot?: string | null;
  category?: string | null;
  content?: string | null;
  audioUrl?: string | null;
  tracks?: LectureTrackDto[] | null;
};

/** Morning/evening sanctuary guides are always free for every viewer. */
export function isSanctuaryScheduleSlot(
  scheduleSlot: string | null | undefined,
  category?: string | null,
): boolean {
  const slot = scheduleSlot?.trim().toLowerCase();
  if (slot === "morning" || slot === "evening") return true;
  return category?.trim().toLowerCase() === "sanctuary";
}

export function applyPremiumOfficialForViewer<T extends OfficialLike>(
  item: T,
  viewer: PremiumViewer,
): T & { contentPreview?: string; contentLocked?: boolean } {
  if (isSanctuaryScheduleSlot(item.scheduleSlot, item.category)) {
    return item;
  }
  if (!item.isPremium || userHasPremiumContentAccess(viewer)) {
    return item;
  }

  const fullContent = item.content ?? "";
  const { preview, locked } = buildContentPreview(fullContent);

  return {
    ...item,
    content: locked ? preview : fullContent,
    contentPreview: preview,
    contentLocked: true,
    audioUrl: null,
    tracks: item.tracks?.map((t) => ({ ...t, audioUrl: "" })) ?? item.tracks,
  };
}

type PostLike = {
  isPremium?: boolean | null;
  content?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
};

export function applyPremiumPostForViewer<T extends PostLike>(
  post: T,
  viewer: PremiumViewer,
  opts?: { viewerUserId?: number | null; authorId?: number | null },
): T & { contentPreview?: string; contentLocked?: boolean } {
  const isAuthor =
    opts?.viewerUserId != null &&
    opts?.authorId != null &&
    opts.viewerUserId === opts.authorId;

  if (!post.isPremium || userHasPremiumContentAccess(viewer) || isAuthor) {
    return post;
  }

  const fullContent = post.content ?? "";
  const { preview, locked } = buildContentPreview(fullContent);
  const stripMedia = post.mediaType === "video" || post.mediaType === "audio";

  return {
    ...post,
    content: locked ? preview : fullContent,
    contentPreview: preview,
    contentLocked: true,
    mediaUrl: stripMedia ? null : post.mediaUrl,
  };
}

/** Walk cached library list/sanctuary payloads before send. */
export function transformLibraryPayloadForViewer(body: unknown, viewer: PremiumViewer): unknown {
  if (body == null || typeof body !== "object") return body;
  const o = body as Record<string, unknown>;

  if (Array.isArray(o.prayers)) {
    return {
      ...o,
      prayers: o.prayers.map((p) => applyPremiumOfficialForViewer(p as OfficialLike, viewer)),
    };
  }

  if ("morning" in o || "evening" in o) {
    return {
      ...o,
      morning: o.morning
        ? applyPremiumOfficialForViewer(o.morning as OfficialLike, viewer)
        : o.morning ?? null,
      evening: o.evening
        ? applyPremiumOfficialForViewer(o.evening as OfficialLike, viewer)
        : o.evening ?? null,
    };
  }

  if (Array.isArray(o.officialPrayers)) {
    return {
      ...o,
      officialPrayers: o.officialPrayers.map((p) =>
        applyPremiumOfficialForViewer(p as OfficialLike, viewer),
      ),
      ...(Array.isArray(o.savedOfficialPrayers)
        ? {
            savedOfficialPrayers: o.savedOfficialPrayers.map((p) =>
              applyPremiumOfficialForViewer(p as OfficialLike, viewer),
            ),
          }
        : {}),
    };
  }

  return body;
}
