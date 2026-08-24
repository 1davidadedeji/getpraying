import type { Post } from "@workspace/api-client-react";
import { useCallback, useMemo, useState } from "react";
import type { ViewToken } from "react-native";

/**
 * Home-feed style: pick one in-view post with video or audio for muted autoplay.
 * Controls always show pause while playing (including muted feed preview).
 */
export function useFeedMediaViewability() {
  const [feedMediaFocusPostId, setFeedMediaFocusPostId] = useState<number | null>(null);

  const viewabilityConfig = useMemo(
    () => ({
      itemVisiblePercentThreshold: 55,
      minimumViewTime: 280,
    }),
    [],
  );

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    let best: ViewToken | null = null;
    for (const t of viewableItems) {
      if (!t.isViewable || !t.item) continue;
      const post = t.item as Post;
      if (post.mediaType !== "video" && post.mediaType !== "audio") continue;
      if (!best || (t.index ?? Infinity) < (best.index ?? Infinity)) best = t;
    }
    if (!best?.item) return;
    setFeedMediaFocusPostId((best.item as Post).id);
  }, []);

  const clearFeedMediaFocus = useCallback(() => setFeedMediaFocusPostId(null), []);

  return { feedMediaFocusPostId, onViewableItemsChanged, viewabilityConfig, clearFeedMediaFocus };
}
