import type { QueryClient } from "@tanstack/react-query";
import { InteractionManager } from "react-native";
import { clearAudioMediaCache } from "@/lib/audioMediaCache";
import {
  clearLibraryCache,
  setLibraryFetchEntitlement,
} from "@/lib/libraryFetchCache";
import { setPremiumPromptAccess } from "@/lib/promptPremiumContent";
import { invalidateSanctuaryFetches } from "@/lib/sanctuaryFetchGuard";

/**
 * Clears auth first, then React Query after the next frame / idle work so modals
 * and tab redirects can finish unmounting (avoids ErrorBoundary on sign-out confirm).
 */
export async function logoutThenClearQueryCache(
  logout: () => Promise<void>,
  queryClient: QueryClient,
): Promise<void> {
  clearLibraryCache();
  setLibraryFetchEntitlement(false);
  setPremiumPromptAccess(false);
  invalidateSanctuaryFetches();
  void clearAudioMediaCache();
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
