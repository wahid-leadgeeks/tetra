"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { todayKey } from "@/lib/time";
import type { AttendanceDTO, DaySummaryDTO, TimeEntryDTO } from "@/lib/types";
import { emitNotification } from "@/features/notifications/store";

export type PendingAction =
  | "clock-in"
  | "clock-out"
  | "break-start"
  | "break-end"
  | "start-task"
  | "stop-task"
  | "pause-task"
  | "resume-task";

export type LoadState = "loading" | "ready" | "error";

export interface StartTaskInput {
  taskName: string;
  categoryId: string;
  notes?: string;
}

/** Extract a calm error message from a JSON error payload. */
function errorMessage(payload: unknown): string | null {
  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const error = (payload as { error: unknown }).error;
    if (typeof error === "string" && error.length > 0) return error;
  }
  return null;
}

async function fetchDaySummary(timezone: string): Promise<DaySummaryDTO> {
  const res = await fetch(`/api/days/${todayKey(timezone)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as DaySummaryDTO;
}

/**
 * Today screen state: one GET for the day summary plus typed mutations.
 * Every mutation refreshes both the client state and the server tree.
 */
export function useTodayState(timezone: string) {
  const router = useRouter();
  const [summary, setSummary] = useState<DaySummaryDTO | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [pending, setPending] = useState<PendingAction | null>(null);

  useEffect(() => {
    let active = true;
    fetchDaySummary(timezone)
      .then((data) => {
        if (!active) return;
        setSummary(data);
        setLoadState("ready");
      })
      .catch(() => {
        if (active) setLoadState("error");
      });
    return () => {
      active = false;
    };
  }, [timezone]);

  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      const data = await fetchDaySummary(timezone);
      setSummary(data);
      setLoadState("ready");
      return true;
    } catch {
      setLoadState("error");
      return false;
    }
  }, [timezone]);

  const settle = useCallback(async () => {
    await refresh();
    router.refresh();
  }, [refresh, router]);

  // Automatically refresh server state when network connectivity returns
  useEffect(() => {
    const handleNetworkOnline = () => {
      void settle();
    };
    window.addEventListener("tetra:network-online", handleNetworkOnline);
    return () => {
      window.removeEventListener("tetra:network-online", handleNetworkOnline);
    };
  }, [settle]);

  const post = useCallback(
    async <T>(
      action: PendingAction,
      path: string,
      body?: unknown,
    ): Promise<T | null> => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        toast.error("You are currently offline", {
          description: "Please reconnect to the internet to save changes.",
        });
        return null;
      }

      setPending(action);
      try {
        const res = await fetch(path, {
          method: "POST",
          headers:
            body === undefined ? undefined : { "Content-Type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const payload: unknown = await res.json().catch(() => null);
        if (!res.ok) {
          toast.error(errorMessage(payload) ?? "Something went wrong");
          return null;
        }
        return payload as T;
      } catch {
        toast.error("Couldn't reach the server", {
          description: "Check your connection and try again.",
        });
        return null;
      } finally {
        setPending(null);
      }
    },
    [],
  );

  const clockIn = useCallback(async (): Promise<boolean> => {
    const attendance = await post<
      AttendanceDTO & {
        autoSync?: {
          attempted: boolean;
          success?: boolean;
          cell?: string;
          value?: string;
          idempotent?: boolean;
          message?: string;
        };
      }
    >("clock-in", "/api/attendance/start");
    if (attendance) {
      if (attendance.autoSync?.attempted) {
        if (attendance.autoSync.success) {
          if (attendance.autoSync.idempotent) {
            toast.success(
              "Work day started · Clock-in already set in Google Sheet",
            );
          } else {
            toast.success(
              `Work day started · Clock-in synced to Google Sheet (${attendance.autoSync.cell}: ${attendance.autoSync.value})`,
            );
          }
        } else {
          toast.success("Work day started");
          toast.error(
            `Google Sheet notice: ${attendance.autoSync.message ?? "Could not sync clock-in to sheet"}`,
          );
        }
      } else {
        toast.success("Work day started");
      }
      emitNotification({
        type: "attendance",
        severity: "info",
        title: "Workday Started",
        message: "You are clocked in. Logging tasks will track time towards your daily target.",
        href: "/",
        actionLabel: "View Today",
      });
      await settle();
      return true;
    }
    return false;
  }, [post, settle]);

  const clockOut = useCallback(async (): Promise<boolean> => {
    const attendance = await post<
      AttendanceDTO & {
        autoSync?: {
          attempted: boolean;
          success?: boolean;
          idempotent?: boolean;
          changedCount?: number;
          message?: string;
        };
      }
    >("clock-out", "/api/attendance/stop");
    if (attendance) {
      if (attendance.autoSync?.attempted) {
        if (attendance.autoSync.success) {
          if (attendance.autoSync.idempotent) {
            toast.success("Work day ended · Google Sheet already up to date");
          } else {
            toast.success(
              `Work day ended · Auto-synced to Google Sheet (${attendance.autoSync.changedCount} ${
                attendance.autoSync.changedCount === 1 ? "cell" : "cells"
              } updated)`,
            );
          }
        } else {
          toast.success("Work day ended");
          toast.error(
            `Auto-sync notice: ${attendance.autoSync.message ?? "Could not sync to Google Sheet"}`,
          );
        }
      } else {
        toast.success("Work day ended");
      }
      emitNotification({
        type: "attendance",
        severity: "success",
        title: "Workday Ended",
        message: "Shift closed. Review and verify your daily summary before final submission.",
        href: "/reports",
        actionLabel: "Review Day",
      });
      await settle();
      return true;
    }
    return false;
  }, [post, settle]);

  const startBreak = useCallback(async (): Promise<boolean> => {
    const attendance = await post<AttendanceDTO>(
      "break-start",
      "/api/breaks/start",
    );
    if (attendance) {
      toast.success("On break");
      emitNotification({
        type: "attendance",
        severity: "reminder",
        title: "Break Started",
        message: "Work timers paused. Enjoy your break!",
        href: "/",
      });
      await settle();
      return true;
    }
    return false;
  }, [post, settle]);

  const endBreak = useCallback(async (): Promise<boolean> => {
    const attendance = await post<AttendanceDTO>(
      "break-end",
      "/api/breaks/stop",
    );
    if (attendance) {
      toast.success("Back from break");
      emitNotification({
        type: "attendance",
        severity: "info",
        title: "Break Ended",
        message: "Welcome back! Ready for the next activity.",
        href: "/",
      });
      await settle();
      return true;
    }
    return false;
  }, [post, settle]);

  const startTask = useCallback(
    async (input: StartTaskInput): Promise<TimeEntryDTO | null> => {
      // Starting a task while not clocked in opens the work day first, at
      // the same moment — one less step, same audit trail (two rows).
      if (summary?.attendance == null) {
        const attendance = await post<AttendanceDTO>(
          "clock-in",
          "/api/attendance/start",
        );
        if (attendance === null) return null;
        toast.success("Work day started");
      }
      const entry = await post<TimeEntryDTO>(
        "start-task",
        "/api/time-entries/start",
        input,
      );
      if (entry) {
        toast.success(`Started \u201C${input.taskName}\u201D`);
        await settle();
      }
      return entry;
    },
    [post, settle, summary],
  );

  const stopTask = useCallback(async (): Promise<boolean> => {
    const entry = await post<TimeEntryDTO>("stop-task", "/api/time-entries/stop");
    if (entry) {
      toast.success("Task stopped");
      await settle();
      return true;
    }
    return false;
  }, [post, settle]);

  const pauseTask = useCallback(async (): Promise<boolean> => {
    const entry = await post<TimeEntryDTO>(
      "pause-task",
      "/api/time-entries/pause",
    );
    if (entry) {
      toast.success("Task paused · On break");
      await settle();
      return true;
    }
    return false;
  }, [post, settle]);

  const resumeTask = useCallback(async (): Promise<boolean> => {
    const entry = await post<TimeEntryDTO>(
      "resume-task",
      "/api/time-entries/resume",
    );
    if (entry) {
      toast.success("Task resumed");
      await settle();
      return true;
    }
    return false;
  }, [post, settle]);

  return {
    summary,
    loadState,
    pending,
    refresh,
    clockIn,
    clockOut,
    startBreak,
    endBreak,
    startTask,
    stopTask,
    pauseTask,
    resumeTask,
  };
}
