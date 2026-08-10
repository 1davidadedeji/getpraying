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
import { openPremiumPaywall } from "@/lib/openPremiumPaywall";

const LOCKED_OVERLAY_MIN_H = 132;

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
  style?: StyleProp<ViewStyle>;
  onUnlockPress?: () => void;
};

function PremiumLockOverlay({ mode = "text" }: { mode?: "text" | "media" }) {
  const isMedia = mode === "media";
  return (
    <View style={styles.lockCard} pointerEvents="none">
      <View style={styles.lockIconCircle}>
        <Ionicons name="lock-closed" size={isMedia ? 22 : 20} color={colors.primary} />
      </View>
      <Text style={styles.premiumLabel}>Premium</Text>
      <Text style={styles.lockHint} numberOfLines={2}>
        {isMedia ? "Subscribe to play" : "Subscribe to unlock"}
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
  style,
  onUnlockPress,
}: Props) {
  const showMarker = Boolean(isPremium && showSubscriberMarker && !locked);

  if (!locked && !showMarker) {
    return <>{children}</>;
  }

  const lockedMinHeight = Math.max(minHeight, LOCKED_OVERLAY_MIN_H);

  const handleUnlockPress = () => {
    if (onUnlockPress) {
      onUnlockPress();
      return;
    }
    openPremiumPaywall();
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
          <PremiumLockOverlay mode={mode} />
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
  },
  blurClip: {
    borderRadius: 12,
    overflow: "hidden",
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
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  },
  lockIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  premiumLabel: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 11,
    color: colors.primary,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  lockHint: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
    textAlign: "center",
  },
  subscriberMarker: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 3,
    elevation: 5,
  },
});
