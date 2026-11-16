import { TZDate, tz } from "@date-fns/tz";
import { addDays, format, startOfDay } from "date-fns";
import type { TimeWindow } from "./overlap";

/**
 * Times are stored in UTC and shown in the business timezone (section 6). These helpers work
 * the same on the server and in the browser, so a page never depends on the viewer's own zone.
 */

/** "2026-11-14" for the given instant, as seen in the business timezone. */
export const dayKey = (instant: Date | string, timeZone: string) =>
  format(new Date(instant), "yyyy-MM-dd", { in: tz(timeZone) });

/** The UTC window covering one calendar day in the business timezone. */
export function dayWindow(day: string, timeZone: string): TimeWindow {
  const [y, m, d] = day.split("-").map(Number);
  const start = new TZDate(y, m - 1, d, timeZone);
  return { start: new Date(start.getTime()), end: new Date(addDays(start, 1).getTime()) };
}

export function todayWindow(timeZone: string, now = new Date()): TimeWindow {
  const start = startOfDay(now, { in: tz(timeZone) });
  return { start: new Date(start.getTime()), end: new Date(addDays(start, 1).getTime()) };
}

/** A date and an "HH:mm" time typed in the business timezone, as a UTC ISO string. */
export function zonedToIso(day: string, time: string, timeZone: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(new TZDate(y, m - 1, d, hh, mm, timeZone).getTime()).toISOString();
}

export const formatInZone = (instant: Date | string, timeZone: string, pattern: string) =>
  format(new Date(instant), pattern, { in: tz(timeZone) });

/** "Sat 14 Nov, 10:00–12:00", or with both dates when the window spans midnight. */
export function formatWindow(start: Date | string, end: Date | string, timeZone: string): string {
  const sameDay = dayKey(start, timeZone) === dayKey(end, timeZone);
  const from = formatInZone(start, timeZone, "EEE d MMM, HH:mm");
  const to = formatInZone(end, timeZone, sameDay ? "HH:mm" : "EEE d MMM, HH:mm");
  return `${from}–${to}`;
}
