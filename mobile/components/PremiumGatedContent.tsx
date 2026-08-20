import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import colors from "@/constants/colors";
import { PremiumBadge } from "@/components/PremiumBadge";
import { promptPremiumContentUnlock } from "@/lib/promptPremiumContent";

const LOCKED_OVERLAY_MIN = {
  default: 132,
  compact: 88,
} as const;

type Props = {
  /** Free viewer — blur content and show centered lock. */
  locked: boolean;
  /** Item is premium (shows subscriber marker when unlocked). */
  isPremium?: boolean;
  /** Paying viewer — small star marker on premium content. */
  showSubscriberMarker?: boolean;
  children: React.ReactNode;
  minHeight?: number;
  mode?: "text" | "media";
  /** Smaller lock chrome for narrow cards (e.g. lecture carousel). */
  overlaySize?: "default" | "compact";
  style?: StyleProp<ViewStyle>;
  onUnlockPress?: () => void;
  /** After subscribe, run this (e.g. start playback). */
  onUnlocked?: () => void;
};

function PremiumLockOverlay({
  mode = "text",
  overlaySize = "default",
}: {
  mode?: "text" | "media";
  overlaySize?: "default" | "compact";
}) {
  const compact = overlaySize === "compact";
  const isMedia = mode === "media";
  return (
    <View
      style={[
        styles.lockCard,
        compact && styles.lockCardCompact,
      ]}
      pointerEvents="none"
    >
      <View style={[styles.lockIconCircle, compact && styles.lockIconCircleCompact]}>
        <Ionicons
          name="lock-closed"
          size={compact ? 16 : isMedia ? 22 : 20}
          color={colors.primary}
        />
      </View>
      <Text style={[styles.premiumLabel, compact && styles.premiumLabelCompact]}>Premium</Text>
      <Text style={[styles.lockHint, compact && styles.lockHintCompact]} numberOfLines={2}>
        {isMedia ? "Tap to subscribe and play" : "Tap to subscribe and unlock"}
      </Text>
    </View>
  );
}

/** Blurs premium previews for free users; shows a star marker for subscribers. */
export function PremiumGatedContent({
  locked,
  isPremium = false,
  showSubscriberMarker = false,
  children,
  minHeight = 100,
  mode = "text",
  overlaySize = "default",
  style,
  onUnlockPress,
  onUnlocked,
}: Props) {
  const showMarker = Boolean(isPremium && showSubscriberMarker && !locked);

  if (!locked && !showMarker) {
    return <>{children}</>;
  }

  const overlayMin = LOCKED_OVERLAY_MIN[overlaySize];
  const lockedMinHeight = Math.max(minHeight, overlayMin);

  const handleUnlockPress = () => {
    if (onUnlockPress) {
      onUnlockPress();
      return;
    }
    promptPremiumContentUnlock(onUnlocked ? { onUnlocked } : undefined);
  };

  return (
    <View style={[styles.wrap, style, locked && { minHeight: lockedMinHeight }]}>
      <View style={[styles.blurClip, locked && { minHeight: lockedMinHeight }]}>
        <View style={locked ? styles.contentDimmed : undefined} pointerEvents={locked ? "none" : "auto"}>
          {children}
        </View>
        {locked ? (
          <BlurView
            intensity={Platform.OS === "ios" ? 28 : 56}
            tint="light"
            style={StyleSheet.absoluteFill}
            experimentalBlurMethod={Platform.OS === "android" ? "dimezisBlurView" : undefined}
          />
        ) : null}
      </View>
      {locked ? (
        <Pressable
          style={styles.overlay}
          onPress={handleUnlockPress}
          accessibilityRole="button"
          accessibilityLabel="Subscribe to unlock premium content"
        >
          <PremiumLockOverlay mode={mode} overlaySize={overlaySize} />
        </Pressable>
      ) : null}
      {showMarker ? (
        <View style={styles.subscriberMarker} pointerEvents="none">
          <PremiumBadge variant="subscriber" fontSize={10} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    width: "100%",
  },
  blurClip: {
    borderRadius: 12,
    overflow: "hidden",
    width: "100%",
  },
  contentDimmed: {
    opacity: 0.55,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    elevation: 4,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  lockCard: {
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 280,
    width: "92%",
  },
  lockCardCompact: {
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    maxWidth: "100%",
    width: "100%",
  },
  lockIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  lockIconCircleCompact: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  premiumLabel: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 11,
    color: colors.primary,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  premiumLabelCompact: {
    fontSize: 10,
    letterSpacing: 0.4,
  },
  lockHint: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
    textAlign: "center",
  },
  lockHintCompact: {
    fontSize: 10,
    lineHeight: 14,
  },
  subscriberMarker: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 3,
    elevation: 5,
  },
});
