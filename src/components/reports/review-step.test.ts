import { describe, expect, it } from "vitest";

import { computeReviewStep, getBackfillPosition } from "./review-step";
import type { DayWarning, ReviewState } from "@/lib/types";

function summary(reviewState: ReviewState, warnings: DayWarning[] = []) {
  return { reviewState, warnings };
}

const gap: DayWarning = { type: "gap", message: "45m gap", minutes: 45 };
const shortBreak: DayWarning = {
  type: "short_break",
  message: "Break at 10:02 lasted under a minute (40s)",
  breakId: "b1",
  seconds: 40,
};
const missingClockOut: DayWarning = {
  type: "missing_clock_out",
  message: "Attendance was never closed",
};

describe("computeReviewStep", () => {
  it("starts at step 1 while blocking warnings remain", () => {
    const state = computeReviewStep(summary("draft", [gap]));
    expect(state.current).toBe(1);
    expect(state.done).toEqual({ 1: false, 2: false, 3: false });
    expect(state.allDone).toBe(false);
  });

  it.each(["draft", "ready"] as const)("moves to step 2 for a clean %s day", (reviewState) => {
    const state = computeReviewStep(summary(reviewState));
    expect(state.current).toBe(2);
    expect(state.done).toEqual({ 1: true, 2: false, 3: false });
  });

  it("treats short_break-only warnings as non-blocking (step 2)", () => {
    const state = computeReviewStep(summary("ready", [shortBreak]));
    expect(state.current).toBe(2);
    expect(state.done[1]).toBe(true);
  });

  it("keeps a changed_after_sync day markable at step 2", () => {
    const state = computeReviewStep(summary("changed_after_sync"));
    expect(state.current).toBe(2);
    expect(state.done).toEqual({ 1: true, 2: false, 3: false });
  });

  it("moves to step 3 once reviewed", () => {
    const state = computeReviewStep(summary("reviewed"));
    expect(state.current).toBe(3);
    expect(state.done).toEqual({ 1: true, 2: true, 3: false });
    expect(state.allDone).toBe(false);
  });

  it("marks all steps done when synced, staying on step 3", () => {
    const state = computeReviewStep(summary("synced"));
    expect(state.current).toBe(3);
    expect(state.done).toEqual({ 1: true, 2: true, 3: true });
    expect(state.allDone).toBe(true);
  });

  it("open attendance on a past day (missing_clock_out) stays on step 1", () => {
    const state = computeReviewStep(summary("draft", [missingClockOut]));
    expect(state.current).toBe(1);
  });

  it("open attendance today without warnings is at step 2 (review prompts clock-out)", () => {
    const state = computeReviewStep(summary("draft"));
    expect(state.current).toBe(2);
  });

  it("returns to step 1 when a reviewed day still has blocking warnings", () => {
    const state = computeReviewStep(summary("reviewed", [gap, shortBreak]));
    expect(state.current).toBe(1);
    expect(state.done).toEqual({ 1: false, 2: true, 3: false });
  });
});

describe("getBackfillPosition", () => {
  const days = ["2026-09-14", "2026-09-15", "2026-09-17"];

  it("finds the index and the next missing day", () => {
    expect(getBackfillPosition(days, "2026-09-14")).toEqual({ index: 0, next: "2026-09-15" });
    expect(getBackfillPosition(days, "2026-09-15")).toEqual({ index: 1, next: "2026-09-17" });
  });

  it("has no next day on the last missing day", () => {
    expect(getBackfillPosition(days, "2026-09-17")).toEqual({ index: 2, next: null });
  });

  it("uses the first missing day after the current day when the current day is not listed", () => {
    expect(getBackfillPosition(days, "2026-09-16")).toEqual({ index: -1, next: "2026-09-17" });
    expect(getBackfillPosition(days, "2026-09-10")).toEqual({ index: -1, next: "2026-09-14" });
    expect(getBackfillPosition(days, "2026-09-18")).toEqual({ index: -1, next: null });
  });
});
