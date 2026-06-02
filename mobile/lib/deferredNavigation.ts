/** Bumped when a deferred href is queued so EntitlementGate can apply it. */
let deferredNavigationEpoch = 0;
const deferredListeners = new Set<() => void>();

export function subscribeDeferredNavigation(listener: () => void): () => void {
  deferredListeners.add(listener);
  return () => {
    deferredListeners.delete(listener);
  };
}

export function bumpDeferredNavigation(): void {
  deferredNavigationEpoch += 1;
  deferredListeners.forEach((l) => l());
}

export function getDeferredNavigationEpoch(): number {
  return deferredNavigationEpoch;
}
