"use client";

import { useEffect, useRef } from "react";

import { hasOpenDialog, isTypingTarget } from "@/lib/keyboard";

/**
 * Today-screen keyboard shortcuts:
 *
 * - `s` starts the work day (no attendance yet), opens the log-activity
 *   dialog (clocked in, no active task), or does nothing (task running).
 * - `b` toggles the work-day break while clocked in; no-op otherwise.
 * - `Space` pauses the running task or resumes the paused one, with
 *   `preventDefault` so the page does not scroll.
 *
 * Keys are ignored while typing in a form field, while any dialog is open,
 * and while a mutation is in flight — the shared shortcut contract.
 */

export interface TodayShortcutsOptions {
  /** No attendance record exists yet (work day not started). */
  canClockIn: boolean;
  /** Attendance status is "open". */
  attendanceOpen: boolean;
  /** An active or paused time entry exists. */
  hasActiveEntry: boolean;
  /** The active entry is running. */
  isRunning: boolean;
  /** The active entry is paused. */
  isPaused: boolean;
  /** An attendance break is currently open. */
  onBreak: boolean;
  /** A mutation is in flight (`pending !== null`). */
  busy: boolean;
  clockIn: () => void | Promise<unknown>;
  openLogActivity: () => void;
  toggleBreak: () => void | Promise<unknown>;
  togglePauseResume: () => void | Promise<unknown>;
}

export function useTodayShortcuts(options: TodayShortcutsOptions): void {
  // Latest-ref pattern: the listener is attached once, but always reads the
  // flags/handlers from the most recent render — no stale closures.
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const current = optionsRef.current;

      if (isTypingTarget(event.target) || hasOpenDialog()) return;
      if (current.busy) return;
      // Leave browser/OS modifier combos (Ctrl+S, Cmd+S, …) untouched.
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      // Held-key repeats fire faster than mutations settle.
      if (event.repeat) return;

      if (event.key === "s" || event.key === "S") {
        if (current.canClockIn) {
          void current.clockIn();
        } else if (!current.hasActiveEntry) {
          current.openLogActivity();
        }
        return;
      }

      if (event.key === "b" || event.key === "B") {
        if (current.attendanceOpen) {
          void current.toggleBreak();
        }
        return;
      }

      if (event.key === " ") {
        if (current.isRunning || current.isPaused) {
          event.preventDefault();
          void current.togglePauseResume();
        }
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
