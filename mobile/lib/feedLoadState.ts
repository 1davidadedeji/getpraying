export type FeedScreenLoadPhase = "start" | "settle";

/**
 * Full-screen feed spinner. A later silent load (tab focus) must still clear it:
 * the superseded initial request skips `finally`, and silent loads used to skip
 * `setLoading(false)` as well — leaving the APK on a spinner with no posts.
 */
export function nextFullScreenFeedLoading(args: {
  currentlyLoading: boolean;
  silent: boolean;
  isCurrentGeneration: boolean;
  phase: FeedScreenLoadPhase;
}): boolean {
  if (args.phase === "start") {
    if (args.silent) return args.currentlyLoading;
    return true;
  }
  if (!args.isCurrentGeneration) return args.currentlyLoading;
  return false;
}

export function shouldSkipSilentFeedPostReload(fullScreenLoading: boolean): boolean {
  return fullScreenLoading;
}
