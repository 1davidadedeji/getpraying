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
import { showSubscriptionPrompt } from "@/context/subscriptionPrompt";
import { PremiumBadge } from "@/components/PremiumBadge";

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
    <View style={styles.lockCard} accessibilityRole="text" accessibilityLabel="Premium content locked">
      <View style={styles.lockIconCircle}>
        <Ionicons name="lock-closed" size={isMedia ? 22 : 20} color={colors.primary} />
      </View>
      <PremiumBadge variant="locked" fontSize={11} />
      <Text style={styles.lockHint}>
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

  return (
    <View style={[styles.wrap, locked && { minHeight }, style]}>
      <View style={locked ? styles.contentDimmed : undefined} pointerEvents={locked ? "none" : "auto"}>
        {children}
      </View>
      {locked ? (
        <>
          <BlurView
            intensity={Platform.OS === "ios" ? 28 : 56}
            tint="light"
            style={StyleSheet.absoluteFill}
            experimentalBlurMethod={Platform.OS === "android" ? "dimezisBlurView" : undefined}
          />
          <Pressable
            style={styles.overlay}
            onPress={() => (onUnlockPress ? onUnlockPress() : showSubscriptionPrompt("premiumContent"))}
            accessibilityRole="button"
            accessibilityLabel="Subscribe to unlock premium content"
          >
            <PremiumLockOverlay mode={mode} />
          </Pressable>
        </>
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
    overflow: "hidden",
    borderRadius: 12,
  },
  contentDimmed: {
    opacity: 0.55,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  lockCard: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.92)",
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
  lockHint: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
  },
  subscriberMarker: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 2,
  },
});
