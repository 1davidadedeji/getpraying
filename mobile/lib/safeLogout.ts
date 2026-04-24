import type { QueryClient } from "@tanstack/react-query";
import { InteractionManager } from "react-native";

/**
 * Clears auth first, then React Query after the next frame / idle work so modals
 * and tab redirects can finish unmounting (avoids ErrorBoundary on sign-out confirm).
 */
export async function logoutThenClearQueryCache(
  logout: () => Promise<void>,
  queryClient: QueryClient,
): Promise<void> {
  try {
    await logout();
  } catch {
    /* logout() already swallows api errors; extra safety */
  }
  InteractionManager.runAfterInteractions(() => {
    requestAnimationFrame(() => {
      queryClient.clear();
    });
  });
}
