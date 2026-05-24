import { Image } from "expo-image";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import colors from "@/constants/colors";
import { APP_LOGO_SOURCE, appLogoSizePx } from "@/constants/branding";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";

type Props = {
  /** @deprecated Ignored — always uses cream to match native splash. */
  variant?: "splash" | "cream";
};

/** Full-screen branded splash — same logo + cream as sign-in. */
export function SplashBrandedFill() {
  const insets = useSafeAreaInsets();
  const { uiScale } = useResponsiveLayout();
  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const botPad = Platform.OS === "web" ? 0 : insets.bottom;
  const logoSide = appLogoSizePx(uiScale);

  return (
    <View style={[styles.fill, styles.bg, { paddingTop: topPad, paddingBottom: botPad }]}>
      <Image
        source={APP_LOGO_SOURCE}
        style={{ width: logoSide, height: logoSide }}
        contentFit="contain"
        accessibilityLabel="Get Praying app logo"
      />
    </View>
  );
}

/** Same mark as splash while auth hydrates. */
export function SplashBrandedOverlay() {
  const insets = useSafeAreaInsets();
  const { uiScale } = useResponsiveLayout();
  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const botPad = Platform.OS === "web" ? 0 : insets.bottom;
  const logoSide = appLogoSizePx(uiScale);

  return (
    <View
      pointerEvents="auto"
      style={[styles.overlayRoot, { paddingTop: topPad, paddingBottom: botPad }]}
    >
      <Image
        source={APP_LOGO_SOURCE}
        style={{ width: logoSide, height: logoSide }}
        contentFit="contain"
        accessibilityLabel="Get Praying app logo"
      />
    </View>
  );
}

/**
 * In-app loading while session/fonts/bootstrap complete.
 * Matches sign-in cream background and logo.
 */
export function AppLoadingScreen(_props: Props) {
  const insets = useSafeAreaInsets();
  const { uiScale } = useResponsiveLayout();
  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const botPad = Platform.OS === "web" ? 0 : insets.bottom;
  const logoSide = appLogoSizePx(uiScale);

  return (
    <View style={[styles.fill, styles.bg, { paddingTop: topPad, paddingBottom: botPad }]}>
      <Image
        source={APP_LOGO_SOURCE}
        style={{ width: logoSide, height: logoSide }}
        contentFit="contain"
        accessibilityLabel="Get Praying app logo"
      />
      <ActivityIndicator color={colors.primary} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.cream,
  },
  bg: {
    backgroundColor: colors.cream,
  },
  spinner: {
    marginTop: 28,
  },
});
