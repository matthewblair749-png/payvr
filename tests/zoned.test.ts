import { describe, expect, it } from "vitest";
import { addDays, localDate, localDayRange, localMidnight, safeTimeZone } from "@/lib/zoned";

describe("zoned days", () => {
  it("finds local midnight in a zone", () => {
    expect(localMidnight("America/New_York", "2026-10-01").toISOString()).toBe("2026-10-01T04:00:00.000Z");
    expect(localMidnight("Asia/Tokyo", "2026-10-01").toISOString()).toBe("2026-09-30T15:00:00.000Z");
    expect(localMidnight("UTC", "2026-10-01").toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("gets DST days right (23 and 25 hours long)", () => {
    const spring = localDayRange("America/New_York", "2026-03-08");
    expect((spring.to.getTime() - spring.from.getTime()) / 3_600_000).toBe(23);
    const fall = localDayRange("America/New_York", "2026-11-01");
    expect((fall.to.getTime() - fall.from.getTime()) / 3_600_000).toBe(25);
  });

  it("reads the local date of an instant, and shifts dates", () => {
    expect(localDate("America/Los_Angeles", new Date("2026-10-01T05:00:00Z"))).toBe("2026-09-30");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("falls back to UTC for junk zones", () => {
    expect(safeTimeZone("Mars/Olympus")).toBe("UTC");
    expect(safeTimeZone(undefined)).toBe("UTC");
    expect(safeTimeZone("Europe/Berlin")).toBe("Europe/Berlin");
  });
});
