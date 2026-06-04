import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { AppLogo } from "@/components/AppLogo";
import { SPLASH_BACKGROUND_COLOR } from "@/constants/branding";
import colors from "@/constants/colors";

type Props = {
  /** @deprecated Ignored — always uses cream to match native splash. */
  variant?: "splash" | "cream";
  /** Optional spinner for bootstrap states (positioned below center so the logo stays centered). */
  showSpinner?: boolean;
};

/** Full-screen branded splash — matches native launch screen (big logo, true center). */
export function SplashBrandedFill({ showSpinner = false }: Pick<Props, "showSpinner">) {
  return (
    <View style={[styles.fill, styles.bg]}>
      <AppLogo variant="splash" />
      {showSpinner ? (
        <ActivityIndicator color={colors.primary} style={styles.spinner} />
      ) : null}
    </View>
  );
}

/** Same mark as splash while auth hydrates. */
export function SplashBrandedOverlay() {
  return (
    <View pointerEvents="auto" style={styles.overlayRoot}>
      <AppLogo variant="splash" />
    </View>
  );
}

/** In-app loading while session/bootstrap completes. */
export function AppLoadingScreen({ showSpinner = true }: Props) {
  return <SplashBrandedFill showSpinner={showSpinner} />;
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
    backgroundColor: SPLASH_BACKGROUND_COLOR,
  },
  bg: {
    backgroundColor: SPLASH_BACKGROUND_COLOR,
  },
  spinner: {
    position: "absolute",
    bottom: "18%",
  },
});
