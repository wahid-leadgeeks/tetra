"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { todayKey } from "@/lib/time";
import type { AttendanceDTO, DaySummaryDTO, TimeEntryDTO } from "@/lib/types";

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

  const post = useCallback(
    async <T>(
      action: PendingAction,
      path: string,
      body?: unknown,
    ): Promise<T | null> => {
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
    const attendance = await post<AttendanceDTO>(
      "clock-in",
      "/api/attendance/start",
    );
    if (attendance) {
      toast.success("Work day started");
      await settle();
      return true;
    }
    return false;
  }, [post, settle]);

  const clockOut = useCallback(async (): Promise<boolean> => {
    const attendance = await post<AttendanceDTO>(
      "clock-out",
      "/api/attendance/stop",
    );
    if (attendance) {
      toast.success("Work day ended");
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
      toast.success("Task paused");
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
