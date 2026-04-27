import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type FeedNoticeState = { message: string; kind: "success" | "info" } | null;

type Ctx = {
  notice: FeedNoticeState;
  showNotice: (message: string, kind?: "success" | "info") => void;
  clearNotice: () => void;
  /** Increments when the feed should scroll to top and refresh (e.g. after creating a post). */
  feedJumpToTopNonce: number;
  requestFeedJumpToTop: () => void;
};

const FeedNoticeContext = createContext<Ctx | null>(null);

export function FeedNoticeProvider({ children }: { children: React.ReactNode }) {
  const [notice, setNotice] = useState<FeedNoticeState>(null);
  const [feedJumpToTopNonce, setFeedJumpToTopNonce] = useState(0);

  const showNotice = useCallback((message: string, kind: "success" | "info" = "success") => {
    setNotice({ message, kind });
  }, []);

  const clearNotice = useCallback(() => setNotice(null), []);

  const requestFeedJumpToTop = useCallback(() => {
    setFeedJumpToTopNonce((n) => n + 1);
  }, []);

  const value = useMemo(
    () => ({
      notice,
      showNotice,
      clearNotice,
      feedJumpToTopNonce,
      requestFeedJumpToTop,
    }),
    [notice, showNotice, clearNotice, feedJumpToTopNonce, requestFeedJumpToTop],
  );

  return <FeedNoticeContext.Provider value={value}>{children}</FeedNoticeContext.Provider>;
}

export function useFeedNotice() {
  const ctx = useContext(FeedNoticeContext);
  if (!ctx) {
    return {
      notice: null as FeedNoticeState,
      showNotice: () => {},
      clearNotice: () => {},
      feedJumpToTopNonce: 0,
      requestFeedJumpToTop: () => {},
    };
  }
  return ctx;
}
