/**
 * Pure due-date helpers. Task due dates are written by the task dialog as
 * `${date}T23:59:59Z`, so they are compared by their date part only (never
 * converted to a zoned instant, which would shift them a day in UTC+ zones).
 */
import type { TaskStatus } from "@/lib/types";

/** The YYYY-MM-DD part of a stored due date. */
export function dueDateKey(dueAt: string): string {
  return dueAt.slice(0, 10);
}

/** True when the due date is before today and the task is still open. */
export function isOverdue(
  dueAt: string | null | undefined,
  status: TaskStatus,
  todayKey: string,
): boolean {
  return Boolean(
    dueAt && status !== "done" && status !== "cancelled" && dueDateKey(dueAt) < todayKey,
  );
}

/** True when the due date is today (status-agnostic, as the Kanban card has always been). */
export function isDueToday(dueAt: string | null | undefined, todayKey: string): boolean {
  return Boolean(dueAt && dueDateKey(dueAt) === todayKey);
}
