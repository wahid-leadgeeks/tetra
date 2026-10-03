/**
 * Pure helpers for the Daily Review stepper and the backfill navigator.
 * Kept free of JSX so they can be unit-tested in the node vitest env.
 */
import { isBlockingWarning } from "@/features/daily-summary/domain";
import type { DaySummaryDTO } from "@/lib/types";

export type ReviewStepNumber = 1 | 2 | 3;

export interface ReviewStepState {
  /** First step that is not done; 3 once everything is done. */
  current: ReviewStepNumber;
  /** Done flags, indexed by step number. */
  done: Record<ReviewStepNumber, boolean>;
  /** True when all three steps are done (the day is synced and clean). */
  allDone: boolean;
}

/**
 * Steps:
 * 1. Resolve "Needs attention" — done when no blocking warnings remain
 *    (`short_break` is informational and never blocks).
 * 2. Mark reviewed — done when the day is reviewed or synced.
 * 3. Preview, then Sync to Sheet — done when the day is synced.
 */
export function computeReviewStep(
  summary: Pick<DaySummaryDTO, "warnings" | "reviewState">,
): ReviewStepState {
  const done: Record<ReviewStepNumber, boolean> = {
    1: summary.warnings.filter(isBlockingWarning).length === 0,
    2: summary.reviewState === "reviewed" || summary.reviewState === "synced",
    3: summary.reviewState === "synced",
  };
  const firstOpen = ([1, 2, 3] as const).find((step) => !done[step]);
  return {
    current: firstOpen ?? 3,
    done,
    allDone: firstOpen === undefined,
  };
}

export interface BackfillPosition {
  /** 0-based index of the current day in the list, or -1 when it is not in it. */
  index: number;
  /** First missing day strictly after the current day, or null when none is left. */
  next: string | null;
}

/** `days` are YYYY-MM-DD keys sorted ascending (as parsed by the Reports page). */
export function getBackfillPosition(
  days: readonly string[],
  currentDay: string,
): BackfillPosition {
  return {
    index: days.indexOf(currentDay),
    next: days.find((day) => day > currentDay) ?? null,
  };
}
