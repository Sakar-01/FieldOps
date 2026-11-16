export const MIN_JOB_MINUTES = 15;
export const MAX_JOB_HOURS = 12;

export interface TimeWindow {
  start: Date;
  end: Date;
}

/** Returns a message when the window breaks the scheduling rules, otherwise null. */
export function validateWindow({ start, end }: TimeWindow): string | null {
  const minutes = (end.getTime() - start.getTime()) / 60_000;
  if (minutes <= 0) return "The end time must be after the start time";
  if (minutes < MIN_JOB_MINUTES) return `A job must last at least ${MIN_JOB_MINUTES} minutes`;
  if (minutes > MAX_JOB_HOURS * 60) return `A job can last at most ${MAX_JOB_HOURS} hours`;
  return null;
}

/**
 * Half-open intervals: a job ending at 11:00 and one starting at 11:00 don't overlap.
 * The repository query uses the same comparison: scheduledStart < end && scheduledEnd > start.
 */
export const windowsOverlap = (a: TimeWindow, b: TimeWindow) => a.start < b.end && a.end > b.start;
