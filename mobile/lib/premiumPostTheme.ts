import { Platform, type ViewStyle } from "react-native";
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

const premiumShadow: ViewStyle =
  Platform.OS === "web"
    ? {}
    : {
        shadowColor: PREMIUM_POST.star,
        shadowOpacity: 0.1,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      };

/** Gold card chrome for premium library posts and guides (replaces default surface). */
export function premiumCardStyle(isPremium: boolean): ViewStyle {
  if (!isPremium) return {};
  return {
    backgroundColor: PREMIUM_POST.cardBg,
    borderColor: PREMIUM_POST.cardBorder,
    borderWidth: 1,
    ...premiumShadow,
  };
}

/** Gold border on cards that keep a custom background (sanctuary slots, lecture carousel). */
export function premiumCardBorderStyle(isPremium: boolean): ViewStyle {
  if (!isPremium) return {};
  return {
    borderColor: PREMIUM_POST.cardBorder,
    borderWidth: 1,
    ...premiumShadow,
  };
}

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
