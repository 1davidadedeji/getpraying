import { AppState, type AppStateStatus } from "react-native";

type ResumeTask = () => void;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastAppState: AppStateStatus = AppState.currentState;

/** Run `task` once after the app has been active for `delayMs` (debounced). */
export function scheduleOnAppActive(task: ResumeTask, delayMs = 400): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    if (AppState.currentState === "active") task();
  }, delayMs);
}

/**
 * Subscribe to foreground transitions with debouncing so resume does not stampede the network/UI.
 */
export function subscribeAppActive(task: ResumeTask, delayMs = 400): () => void {
  const sub = AppState.addEventListener("change", (next) => {
    const prev = lastAppState;
    lastAppState = next;
    if (prev.match(/inactive|background/) && next === "active") {
      scheduleOnAppActive(task, delayMs);
    }
  });
  return () => {
    sub.remove();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };
}
