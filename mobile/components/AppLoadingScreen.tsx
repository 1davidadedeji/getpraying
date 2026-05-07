import { Image } from "expo-image";
import React from "react";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import colors from "@/constants/colors";

type Props = {
  /** @deprecated Ignored — always uses cream to match native splash. */
  variant?: "splash" | "cream";
};

/**
 * In-app loading while session/fonts/bootstrap complete.
 * Matches `expo.splash.backgroundColor` and `colors.cream`.
 */
export function AppLoadingScreen(_props: Props) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const botPad = Platform.OS === "web" ? 0 : insets.bottom;

  return (
    <View style={[styles.fill, styles.bg, { paddingTop: topPad, paddingBottom: botPad }]}>
      <Image
        source={require("../assets/images/icon-bg.png")}
        style={styles.logo}
        contentFit="contain"
        accessibilityLabel="Get Praying"
      />
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
  bg: {
    /* Must match app.json expo.splash.backgroundColor (#F9F6F0). If the native splash still looks black, try a clean iOS build (simulator caches Storyboard assets) and confirm icon-bg.png uses transparency rather than a baked-in black fill. */
    backgroundColor: colors.cream,
  },
  logo: {
    width: 168,
    height: 168,
  },
  spinner: {
    marginTop: 20,
  },
});
