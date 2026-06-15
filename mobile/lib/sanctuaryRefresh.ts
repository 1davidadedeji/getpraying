type SanctuaryRefreshListener = () => void;

const listeners = new Set<SanctuaryRefreshListener>();

export function subscribeSanctuaryRefresh(listener: SanctuaryRefreshListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Force sanctuary consumers to refetch (push received, slot boundary crossed). */
export function requestSanctuaryRefresh(): void {
  for (const listener of listeners) {
    listener();
  }
}
