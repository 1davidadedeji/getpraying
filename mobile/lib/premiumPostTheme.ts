import colors from "@/constants/colors";

/** Visual palette for premium prayer posts (visible to all viewers). */
export const PREMIUM_POST = {
  bannerBg: "#FFF8E7",
  bannerBorder: "#E8D5A3",
  cardBorder: "#E8D5A3",
  cardBg: "#FFFCF5",
  actionsBg: "#FFF5E0",
  actionsBorder: "#E8D5A3",
  prayActive: "#C9922A",
  prayIdle: "#B8860B",
  bookmarkActive: "#8B6914",
  commentActive: "#8B6914",
  accentMuted: "#C4A962",
  star: "#B8860B",
} as const;

export type PremiumActionState = {
  hasPrayed?: boolean;
  isSaved?: boolean;
  hasCommented?: boolean;
};

export function premiumPostActionColors(isPremium: boolean, state: PremiumActionState) {
  if (!isPremium) {
    return {
      pray: state.hasPrayed ? colors.flame : colors.muted,
      bookmark: state.isSaved ? colors.primary : colors.muted,
      comment: state.hasCommented ? colors.primary : colors.muted,
      share: colors.muted,
      countPrayActive: colors.flame,
      countSavedActive: colors.primary,
      countCommentActive: colors.primary,
    };
  }
  return {
    pray: state.hasPrayed ? PREMIUM_POST.prayActive : PREMIUM_POST.prayIdle,
    bookmark: state.isSaved ? PREMIUM_POST.bookmarkActive : PREMIUM_POST.accentMuted,
    comment: state.hasCommented ? PREMIUM_POST.commentActive : PREMIUM_POST.accentMuted,
    share: PREMIUM_POST.accentMuted,
    countPrayActive: PREMIUM_POST.prayActive,
    countSavedActive: PREMIUM_POST.bookmarkActive,
    countCommentActive: PREMIUM_POST.commentActive,
  };
}
