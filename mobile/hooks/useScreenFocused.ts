import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

/** True while the current screen is focused in the navigation stack or tab. */
export function useScreenFocused(): boolean {
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return focused;
}
