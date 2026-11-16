import { describe, expect, it } from "vitest";
import { dayKey, dayWindow, formatWindow, todayWindow, zonedToIso } from "@/lib/domain/time";

const IST = "Asia/Kolkata"; // UTC+05:30, no daylight saving

describe("business timezone helpers", () => {
  it("converts a typed date and time in the business zone to UTC", () => {
    expect(zonedToIso("2026-11-14", "10:00", IST)).toBe("2026-11-14T04:30:00.000Z");
  });

  it("builds the UTC window for a business day", () => {
    const { start, end } = dayWindow("2026-11-14", IST);
    expect(start.toISOString()).toBe("2026-11-13T18:30:00.000Z");
    expect(end.toISOString()).toBe("2026-11-14T18:30:00.000Z");
  });

  it("finds today in the business zone, not in UTC", () => {
    // 20:00 UTC on the 13th is already 01:30 on the 14th in India.
    const now = new Date("2026-11-13T20:00:00Z");
    expect(todayWindow(IST, now).start.toISOString()).toBe("2026-11-13T18:30:00.000Z");
    expect(dayKey(now, IST)).toBe("2026-11-14");
  });

  it("formats a window in the business zone", () => {
    expect(formatWindow("2026-11-14T04:30:00Z", "2026-11-14T06:30:00Z", IST)).toBe(
      "Sat 14 Nov, 10:00–12:00",
    );
  });
});
