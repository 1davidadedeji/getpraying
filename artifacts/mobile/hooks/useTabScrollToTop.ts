import { useNavigation } from "expo-router";
import { useEffect } from "react";

/**
 * When the user taps the current (or any) tab in the bottom bar, scroll this screen back to the top.
 * Matches common “tap tab to return home” behavior.
 */
export function useTabScrollToTop(onTabPress: () => void) {
  const navigation = useNavigation();

  useEffect(() => {
    const unsub = navigation.addListener("tabPress" as never, () => {
      onTabPress();
    });
    return unsub;
  }, [navigation, onTabPress]);
}
