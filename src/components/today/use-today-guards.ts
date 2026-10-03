"use client";

import { useEffect } from "react";

import { sendBrowserAlert } from "@/features/notifications/store";
import type { AttendanceDTO, TimeEntryDTO } from "@/lib/types";

export interface TodayGuardsOptions {
  activeEntry: TimeEntryDTO | null;
  isWorking: boolean;
  onBreak: boolean;
  attendance: AttendanceDTO | null;
}

/**
 * Today-screen side-effect guards: a beforeunload prompt while working and
 * minute-interval desktop alerts for long tasks and extended breaks.
 */
export function useTodayGuards({
  activeEntry,
  isWorking,
  onBreak,
  attendance,
}: TodayGuardsOptions) {
  // Protect against accidental tab close or page navigation while working
  useEffect(() => {
    if (!activeEntry && !isWorking) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [activeEntry, isWorking]);

  // Proactive desktop alerts for long running tasks (>90m) or extended breaks (>45m)
  useEffect(() => {
    if (!isWorking) return;

    const interval = setInterval(() => {
      // 1. Long running active task
      if (activeEntry && activeEntry.status === "active") {
        const startedMs = Date.parse(activeEntry.startedAt);
        const elapsedMinutes = Math.floor(
          (Date.now() - startedMs - activeEntry.pausedSeconds * 1000) / 60000,
        );
        if (elapsedMinutes === 90 || elapsedMinutes === 180) {
          sendBrowserAlert(
            "Task Milestone",
            `"${activeEntry.taskName}" has been active for ${elapsedMinutes}m. Remember to stay hydrated and take a pause if needed!`,
            "/timer",
          );
        }
      }

      // 2. Extended break
      if (onBreak && attendance?.activeBreak?.startedAt) {
        const breakStartedMs = Date.parse(attendance.activeBreak.startedAt);
        const breakMinutes = Math.floor((Date.now() - breakStartedMs) / 60000);
        if (breakMinutes === 45 || breakMinutes === 60) {
          sendBrowserAlert(
            "Break Reminder",
            `You have been on break for ${breakMinutes}m. Ready to resume your tasks?`,
            "/timer",
          );
        }
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [isWorking, onBreak, attendance, activeEntry]);
}
