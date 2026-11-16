import { describe, expect, it } from "vitest";
import { validateWindow, windowsOverlap } from "@/lib/domain/overlap";

const at = (time: string) => new Date(`2026-11-14T${time}:00Z`);
const win = (start: string, end: string) => ({ start: at(start), end: at(end) });

describe("windowsOverlap (FR-JOB-05)", () => {
  it("detects partial and full overlaps", () => {
    expect(windowsOverlap(win("10:00", "12:00"), win("11:00", "13:00"))).toBe(true);
    expect(windowsOverlap(win("10:00", "12:00"), win("09:00", "10:30"))).toBe(true);
    expect(windowsOverlap(win("10:00", "12:00"), win("10:30", "11:00"))).toBe(true);
    expect(windowsOverlap(win("10:30", "11:00"), win("10:00", "12:00"))).toBe(true);
    expect(windowsOverlap(win("10:00", "12:00"), win("10:00", "12:00"))).toBe(true);
  });

  it("allows touching windows", () => {
    expect(windowsOverlap(win("10:00", "11:00"), win("11:00", "12:00"))).toBe(false);
    expect(windowsOverlap(win("11:00", "12:00"), win("10:00", "11:00"))).toBe(false);
  });

  it("allows separate windows", () => {
    expect(windowsOverlap(win("08:00", "09:00"), win("14:00", "15:00"))).toBe(false);
  });
});

describe("validateWindow", () => {
  it("accepts 15 minutes to 12 hours", () => {
    expect(validateWindow(win("10:00", "10:15"))).toBeNull();
    expect(validateWindow(win("08:00", "20:00"))).toBeNull();
  });

  it("rejects an end before or equal to the start", () => {
    expect(validateWindow(win("10:00", "10:00"))).toMatch(/after the start/);
    expect(validateWindow(win("10:00", "09:00"))).toMatch(/after the start/);
  });

  it("rejects too short and too long jobs", () => {
    expect(validateWindow(win("10:00", "10:14"))).toMatch(/at least 15/);
    expect(validateWindow(win("08:00", "20:01"))).toMatch(/at most 12/);
  });
});
