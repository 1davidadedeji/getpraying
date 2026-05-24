import React from "react";
import { StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useSharedValue } from "react-native-reanimated";
import { useCurrentTabScrollY } from "react-native-collapsible-tab-view";

// Must load from src/ — same module graph as Tabs.Container (Metro "react-native" entry).
// lib/module/hooks uses a duplicate Context and throws "must be inside Tabs.Container".
const { useTabsContext, useScroller } = require("react-native-collapsible-tab-view/src/hooks") as {
  useTabsContext: () => {
    refMap: Record<string, unknown>;
    focusedTab: { value: string };
    headerScrollDistance: { value: number };
  };
  useScroller: () => (ref: unknown, x: number, y: number, animated: boolean) => void;
};

type Props = {
  children: React.ReactNode;
};

/**
 * Forwards vertical drags on the profile header (avatar, stats) to the active tab list
 * so the header collapses when scrolling from the top section — not only from posts.
 */
export function ProfileCollapsibleHeaderShell({ children }: Props) {
  const { refMap, focusedTab, headerScrollDistance } = useTabsContext();
  const scrollY = useCurrentTabScrollY();
  const scrollTo = useScroller();
  const panStartY = useSharedValue(0);

  const pan = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .failOffsetX([-12, 12])
    .onStart(() => {
      panStartY.value = scrollY.value;
    })
    .onUpdate((event) => {
      const tab = focusedTab.value;
      const ref = refMap[tab];
      if (!ref) return;
      const max = headerScrollDistance.value;
      const next = Math.max(0, Math.min(max, panStartY.value - event.translationY));
      scrollTo(ref, 0, next, false);
    });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={styles.wrap} collapsable={false}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "transparent",
  },
});
