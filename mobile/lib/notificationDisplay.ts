import type { Notification } from "@workspace/api-client-react";
import { postTextForDisplay } from "@/lib/postDisplayContent";

type NotifType = string;
type NotifRow = Omit<Notification, "type"> & { type: NotifType };

/** Bold headline — actor name is included here when available. */
export function notificationTitle(n: NotifRow): string {
  switch (n.type) {
    case "prayer":
      return n.actorUsername ? `${n.actorUsername} prayed with you` : "Someone prayed with you";
    case "prayer_milestone":
      return "Your prayer is spreading";
    case "saved":
      return n.actorUsername ? `${n.actorUsername} saved your prayer` : "Someone saved your prayer";
    case "comment":
      return n.actorUsername ? `${n.actorUsername} commented` : "New comment";
    case "follow":
      return n.actorUsername ? `${n.actorUsername} followed you` : "New follower";
    case "post_reported":
      return "Your prayer was reported";
    case "reminder":
      return "Prayer reminder";
    case "category_new":
      return n.category ? `New in library: ${n.category}` : "New library content";
    case "post_approved":
      return "Prayer approved";
    case "post_declined":
      return "Prayer not approved";
    case "mod_queue":
      return "Moderation needed";
    case "role_updated":
      return "Your role was updated";
    case "boost_alert":
      return "Your prayer was boosted";
    case "system":
      return "Update";
    default:
      return "Notification";
  }
}

/** Optional subtitle — never repeats the actor username (that lives in the title). */
export function notificationSubtitle(n: NotifRow): string | null {
  switch (n.type) {
    case "prayer":
      return null;
    case "saved":
      return "Added to their saved prayers";
    case "comment":
      return "Left a comment on your prayer";
    case "follow":
      return "You have a new follower";
    case "prayer_milestone":
      return n.message?.trim() || null;
    case "post_reported":
      return "Our team will review your prayer.";
    case "boost_alert":
      return "It’s prioritized higher in the community feed";
    default:
      return n.message?.trim() || null;
  }
}

export function notificationPostPreview(n: NotifRow): string | null {
  const text = postTextForDisplay(n.postPreview);
  return text.trim() ? text : null;
}
