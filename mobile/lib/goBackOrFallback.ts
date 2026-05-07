import { router, type Href } from "expo-router";

/** Avoids noop back when deep-linked onto a stack root (Expo Router canGoBack === false). */
export function goBackOrFallback(fallbackRoute: Href): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallbackRoute);
  }
}
