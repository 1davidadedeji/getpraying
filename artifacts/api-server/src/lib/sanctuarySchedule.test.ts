import { describe, expect, it } from "vitest";
import { resolveSanctuarySlotDates } from "./sanctuarySchedule";

describe("resolveSanctuarySlotDates", () => {
  it("aligns morning/evening go-live dates with 4 AM and 5 PM slots", () => {
    const tz = "UTC";
    const beforeMorning = new Date("2026-06-16T03:30:00Z");
    const morning = new Date("2026-06-16T04:30:00Z");
    const afternoon = new Date("2026-06-16T12:00:00Z");
    const evening = new Date("2026-06-16T17:30:00Z");

    expect(resolveSanctuarySlotDates(tz, beforeMorning)).toEqual({
      morningDate: "2026-06-15",
      eveningDate: "2026-06-15",
    });
    expect(resolveSanctuarySlotDates(tz, morning)).toEqual({
      morningDate: "2026-06-16",
      eveningDate: "2026-06-15",
    });
    expect(resolveSanctuarySlotDates(tz, afternoon)).toEqual({
      morningDate: "2026-06-16",
      eveningDate: "2026-06-15",
    });
    expect(resolveSanctuarySlotDates(tz, evening)).toEqual({
      morningDate: "2026-06-16",
      eveningDate: "2026-06-16",
    });
  });
});
