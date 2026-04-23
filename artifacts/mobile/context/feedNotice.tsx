import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type FeedNoticeState = { message: string; kind: "success" | "info" } | null;

type Ctx = {
  notice: FeedNoticeState;
  showNotice: (message: string, kind?: "success" | "info") => void;
  clearNotice: () => void;
};

const FeedNoticeContext = createContext<Ctx | null>(null);

export function FeedNoticeProvider({ children }: { children: React.ReactNode }) {
  const [notice, setNotice] = useState<FeedNoticeState>(null);

  const showNotice = useCallback((message: string, kind: "success" | "info" = "success") => {
    setNotice({ message, kind });
  }, []);

  const clearNotice = useCallback(() => setNotice(null), []);

  const value = useMemo(
    () => ({ notice, showNotice, clearNotice }),
    [notice, showNotice, clearNotice],
  );

  return <FeedNoticeContext.Provider value={value}>{children}</FeedNoticeContext.Provider>;
}

export function useFeedNotice() {
  const ctx = useContext(FeedNoticeContext);
  if (!ctx) {
    return { notice: null as FeedNoticeState, showNotice: () => {}, clearNotice: () => {} };
  }
  return ctx;
}
