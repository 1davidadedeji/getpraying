import { useNavigation } from "expo-router";
import { useEffect } from "react";
import { shouldJumpFeedToTopOnTabPress } from "@/lib/feedSessionPolicy";

/**
 * Tap-the-Feed-tab-again jumps to top. Arriving from Alerts/Profile must not.
 */
export function useTabScrollToTop(onTabPress: () => void) {
  const navigation = useNavigation();

  useEffect(() => {
    const unsub = navigation.addListener("tabPress" as never, () => {
      if (
        !shouldJumpFeedToTopOnTabPress({
          feedTabAlreadyFocused: navigation.isFocused(),
        })
      ) {
        return;
      }
      onTabPress();
    });
    return unsub;
  }, [navigation, onTabPress]);
}
