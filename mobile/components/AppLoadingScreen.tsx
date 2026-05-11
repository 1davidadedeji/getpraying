import { Image } from "expo-image";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import colors from "@/constants/colors";

/** Logo vs shortest screen edge — native splash `imageWidth` should feel similar after prebuild. */
const SPLASH_LOGO_FRAC = 0.76;

type Props = {
  /** @deprecated Ignored — always uses cream to match native splash. */
  variant?: "splash" | "cream";
};

function SplashTagline({
  titleFontFamily,
  minDim,
}: {
  titleFontFamily?: string;
  minDim: number;
}) {
  const fontSize = Math.max(22, Math.round(minDim * 0.065));
  return (
    <Text
      accessibilityRole="text"
      style={[
        styles.tagline,
        { fontSize },
        titleFontFamily != null
          ? { fontFamily: titleFontFamily }
          : { fontWeight: "700" },
      ]}
    >
      Get Praying
    </Text>
  );
}

/** Full-screen branded splash — ladder + “Get Praying” (system bold until custom fonts load). */
export function SplashBrandedFill() {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const botPad = Platform.OS === "web" ? 0 : insets.bottom;
  const minDim = Math.min(winW, winH);
  const splashSide = Math.round(minDim * SPLASH_LOGO_FRAC);

  return (
    <View style={[styles.fill, styles.bg, { paddingTop: topPad, paddingBottom: botPad }]}>
      <Image
        source={require("../assets/images/splash-icon.png")}
        style={{ width: splashSide, height: splashSide }}
        contentFit="contain"
        accessibilityLabel="Get Praying logo"
      />
      <SplashTagline minDim={minDim} />
    </View>
  );
}

/** Same mark as splash, using loaded brand serif — show after fonts; e.g. over root until auth hydrates. */
export function SplashBrandedOverlay() {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const botPad = Platform.OS === "web" ? 0 : insets.bottom;
  const minDim = Math.min(winW, winH);
  const splashSide = Math.round(minDim * SPLASH_LOGO_FRAC);

  return (
    <View
      pointerEvents="auto"
      style={[styles.overlayRoot, { paddingTop: topPad, paddingBottom: botPad }]}
    >
      <Image
        source={require("../assets/images/splash-icon.png")}
        style={{ width: splashSide, height: splashSide }}
        contentFit="contain"
        accessibilityLabel="Get Praying logo"
      />
      <SplashTagline titleFontFamily="NotoSerif_700Bold" minDim={minDim} />
    </View>
  );
}

/**
 * In-app loading while session/fonts/bootstrap complete.
 * Matches `expo.splash.backgroundColor` and `colors.cream`.
 */
export function AppLoadingScreen(_props: Props) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const botPad = Platform.OS === "web" ? 0 : insets.bottom;
  const minDim = Math.min(winW, winH);
  const splashSide = Math.round(minDim * SPLASH_LOGO_FRAC);

  return (
    <View style={[styles.fill, styles.bg, { paddingTop: topPad, paddingBottom: botPad }]}>
      <Image
        source={require("../assets/images/splash-icon.png")}
        style={{ width: splashSide, height: splashSide }}
        contentFit="contain"
        accessibilityLabel="Get Praying logo"
      />
      <SplashTagline titleFontFamily="NotoSerif_700Bold" minDim={minDim} />
      <ActivityIndicator color={colors.flame} style={styles.spinner} />
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
    /* Always cream — matches expo.splash (incl. dark) and ignores system scheme. */
    backgroundColor: colors.cream,
  },
  tagline: {
    marginTop: 16,
    color: colors.primary,
    letterSpacing: 0.6,
    textAlign: "center",
  },
  spinner: {
    marginTop: 28,
  },
});
