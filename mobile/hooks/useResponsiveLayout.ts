import { useMemo } from "react";
import { Platform, useWindowDimensions } from "react-native";
import { LAYOUT } from "@/constants/layout";
import {
  clamp,
  getCardRadius,
  getFabSize,
  getGutter,
  getIconAction,
  getIconTab,
  getIsLandscape,
  getTwoColumnFeed,
  getUiScale,
} from "@/lib/responsiveMetrics";

export function useResponsiveLayout() {
  const { width, height, fontScale } = useWindowDimensions();
  const windowWidth = Math.max(320, width);
  const windowHeight = Math.max(320, height);

  const isLandscape = useMemo(() => getIsLandscape(width, height), [width, height]);
  const uiScale = useMemo(() => getUiScale(width, height), [width, height]);

  const gutter = useMemo(() => getGutter(width, height), [width, height]);

  const contentInnerWidth = Math.min(LAYOUT.contentMaxWidth, windowWidth - gutter * 2);
  const feedInnerWidth = Math.min(LAYOUT.feedMaxWidth, windowWidth - gutter * 2);

  const isTablet = windowWidth >= LAYOUT.tabletMinWidth;
  const isDesktop = windowWidth >= 1024;

  const useTwoColumnFeed = useMemo(
    () => getTwoColumnFeed(width, height, isTablet, Platform.OS === "web"),
    [width, height, isTablet],
  );

  const iconTab = useMemo(() => getIconTab(uiScale), [uiScale]);
  const iconAction = useMemo(() => getIconAction(uiScale), [uiScale]);
  const fabSize = useMemo(() => getFabSize(uiScale), [uiScale]);
  const cardRadius = useMemo(() => getCardRadius(uiScale), [uiScale]);
  const tabLabelSize = useMemo(() => Math.round(clamp(11 * uiScale, 10, 13)), [uiScale]);

  return {
    windowWidth,
    windowHeight,
    fontScale,
    uiScale,
    isLandscape,
    gutter,
    contentInnerWidth,
    feedInnerWidth,
    isTablet,
    isDesktop,
    useTwoColumnFeed,
    iconTab,
    iconAction,
    fabSize,
    cardRadius,
    tabLabelSize,
  };
}
