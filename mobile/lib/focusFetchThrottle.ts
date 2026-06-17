export const DEFAULT_FOCUS_FETCH_THROTTLE_MS = 8_000;

/** Returns true when enough time has passed since the last focus-driven fetch. */
export function shouldRunThrottledFocusFetch(
  lastRunAt: number,
  now: number,
  throttleMs = DEFAULT_FOCUS_FETCH_THROTTLE_MS,
): boolean {
  if (throttleMs <= 0) return true;
  return now - lastRunAt >= throttleMs;
}

export type LibraryFocusTab = "categories" | "saved";

export type LibraryFocusFetchLoaders = {
  loadCategories: () => void | Promise<void>;
  loadSanctuary: () => void | Promise<void>;
  loadSavedOfficialIds: () => void | Promise<void>;
  loadLectures: () => void | Promise<void>;
  loadSaved: () => void | Promise<void>;
};

/** Library tab focus refresh — categories vs saved loaders. */
export function runLibraryFocusFetch(
  activeTab: LibraryFocusTab,
  loaders: LibraryFocusFetchLoaders,
  opts?: { focusSection?: string | null; scrollToSanctuary?: () => void },
): void {
  if (activeTab === "categories") {
    void loaders.loadCategories();
    void loaders.loadSanctuary();
    void loaders.loadSavedOfficialIds();
    void loaders.loadLectures();
  } else if (activeTab === "saved") {
    void loaders.loadSaved();
  }

  if (opts?.focusSection && opts.scrollToSanctuary) {
    opts.scrollToSanctuary();
  }
}

/** Feed tab focus refresh — sanctuary slot cards only (feed page load is mount-gated). */
export function runFeedSanctuaryFocusFetch(loadSanctuary: () => void | Promise<void>): void {
  void loadSanctuary();
}
