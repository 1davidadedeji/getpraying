import { Image } from "expo-image";
import React from "react";
import { StyleSheet, type StyleProp, type ImageStyle } from "react-native";
import {
  APP_LOGO_SOURCE,
  appLogoSizePx,
  splashLogoSizePx,
  welcomeLogoSizePx,
} from "@/constants/branding";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";

type Props = {
  /** Splash matches native launch screen; welcome is slightly larger on the landing screen. */
  variant?: "default" | "welcome" | "splash";
  size?: number;
  style?: StyleProp<ImageStyle>;
};

/** Single app mark for welcome, auth, splash, and loading states. */
export function AppLogo({ variant = "default", size, style }: Props) {
  const { uiScale } = useResponsiveLayout();
  const side =
    size ??
    (variant === "splash"
      ? splashLogoSizePx(uiScale)
      : variant === "welcome"
        ? welcomeLogoSizePx(uiScale)
        : appLogoSizePx(uiScale));

  return (
    <Image
      source={APP_LOGO_SOURCE}
      style={[styles.logo, { width: side, height: side }, style]}
      contentFit="contain"
      accessibilityLabel="Get Praying app logo"
    />
  );
}

const styles = StyleSheet.create({
  logo: {},
});
