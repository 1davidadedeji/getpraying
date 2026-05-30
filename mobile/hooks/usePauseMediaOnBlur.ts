import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { pauseAllMediaExcept } from "@/lib/mediaPlaybackCoordinator";

/** Pause all feed/profile media when the screen loses focus (tab switch or stack pop). */
export function usePauseMediaOnBlur(clearFeedMediaFocus?: () => void) {
  useFocusEffect(
    useCallback(() => {
      return () => {
        void pauseAllMediaExcept(null);
        clearFeedMediaFocus?.();
      };
    }, [clearFeedMediaFocus]),
  );
}
