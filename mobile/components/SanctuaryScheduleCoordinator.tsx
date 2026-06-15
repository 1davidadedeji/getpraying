import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { sanctuaryScheduleFingerprint } from "@/lib/sanctuarySchedule";
import { requestSanctuaryRefresh } from "@/lib/sanctuaryRefresh";

const SLOT_CHECK_MS = 60_000;

/**
 * Refetches sanctuary content when the local slot boundary crosses (4 AM / 5 PM)
 * or when slot-aware calendar dates change near midnight.
 */
export function SanctuaryScheduleCoordinator() {
  const fingerprintRef = useRef(sanctuaryScheduleFingerprint());

  useEffect(() => {
    const check = () => {
      const next = sanctuaryScheduleFingerprint();
      if (next === fingerprintRef.current) return;
      fingerprintRef.current = next;
      requestSanctuaryRefresh();
    };

    const interval = setInterval(check, SLOT_CHECK_MS);
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") check();
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, []);

  return null;
}
