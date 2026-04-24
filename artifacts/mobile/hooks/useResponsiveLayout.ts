import { useMemo } from "react";
import { Platform, useWindowDimensions } from "react-native";
import { LAYOUT } from "@/constants/layout";

export function useResponsiveLayout() {
  const { width, height, fontScale } = useWindowDimensions();
  const windowWidth = Math.max(320, width);

  const gutter = useMemo(() => {
    if (windowWidth < 360) return 14;
    if (windowWidth >= 1024) return 32;
    if (windowWidth >= LAYOUT.tabletMinWidth) return 24;
    return 18;
  }, [windowWidth]);

  const contentInnerWidth = Math.min(LAYOUT.contentMaxWidth, windowWidth - gutter * 2);
  const feedInnerWidth = Math.min(LAYOUT.feedMaxWidth, windowWidth - gutter * 2);

  const isTablet = windowWidth >= LAYOUT.tabletMinWidth;
  const isDesktop = windowWidth >= 1024;
  const useTwoColumnFeed = Platform.OS === "web" || isTablet;

  return {
    windowWidth,
    windowHeight: height,
    fontScale,
    gutter,
    contentInnerWidth,
    feedInnerWidth,
    isTablet,
    isDesktop,
    useTwoColumnFeed,
  };
}
