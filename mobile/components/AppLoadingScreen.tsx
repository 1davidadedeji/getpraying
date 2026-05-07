import { Image } from "expo-image";
import React from "react";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import colors from "@/constants/colors";

type Props = {
  /** Default: matches native splash (`app.json`) — black + ladder mark only. */
  variant?: "splash" | "cream";
};

/**
 * In-app loading surface while session/fonts/bootstrap complete.
 * Uses the same ladder asset as the native splash so reopening the app matches launch.
 */
export function AppLoadingScreen({ variant = "splash" }: Props) {
  const insets = useSafeAreaInsets();
  const isSplash = variant === "splash";
  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const botPad = Platform.OS === "web" ? 0 : insets.bottom;

  return (
    <View
      style={[
        styles.fill,
        isSplash ? styles.bgSplash : styles.bgCream,
        { paddingTop: topPad, paddingBottom: botPad },
      ]}
    >
      <Image
        source={require("../assets/images/icon-bg.png")}
        style={styles.logo}
        contentFit="contain"
        accessibilityLabel="Get Praying"
      />
      <ActivityIndicator color={isSplash ? colors.accent : colors.flame} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  bgSplash: {
    backgroundColor: "#000000",
  },
  bgCream: {
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
