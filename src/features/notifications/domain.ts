import type {
  NotificationSeverity,
  NotificationType,
  TetraNotification,
} from "./types";

export function formatRelativeTime(
  isoString: string,
  now: Date = new Date(),
): string {
  const date = new Date(isoString);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function calculateUnreadCount(
  notifications: readonly TetraNotification[],
): number {
  return notifications.filter((n) => !n.read).length;
}

export function filterNotifications(
  notifications: readonly TetraNotification[],
  tab: "all" | "unread",
): TetraNotification[] {
  if (tab === "unread") {
    return notifications.filter((n) => !n.read);
  }
  return [...notifications];
}

export function markNotificationRead(
  notifications: readonly TetraNotification[],
  id: string,
): TetraNotification[] {
  return notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
}

export function markAllNotificationsRead(
  notifications: readonly TetraNotification[],
): TetraNotification[] {
  return notifications.map((n) => ({ ...n, read: true }));
}

export function removeNotificationById(
  notifications: readonly TetraNotification[],
  id: string,
): TetraNotification[] {
  return notifications.filter((n) => n.id !== id);
}

export function createNotification(
  input: {
    type: NotificationType;
    severity: NotificationSeverity;
    title: string;
    message: string;
    href?: string;
    actionLabel?: string;
  },
  now: Date = new Date(),
): TetraNotification {
  return {
    id: `notif-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
    type: input.type,
    severity: input.severity,
    title: input.title,
    message: input.message,
    timestamp: now.toISOString(),
    read: false,
    href: input.href,
    actionLabel: input.actionLabel,
  };
}

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export interface CompanionAlertContext {
  todayKey: string;
  now?: Date;
  daySummary: {
    workDate: string;
    attendance: {
      clockInAt?: string;
      clockOutAt?: string | null;
      startedAt?: string;
      endedAt?: string | null;
      activeBreak?: { startedAt: string; endedAt?: string | null } | null;
      breaks?: Array<{ startedAt: string; endedAt?: string | null }>;
    } | null;
    breaks?: Array<{
      startedAt: string;
      endedAt?: string | null;
    }>;
    timeEntries: Array<{
      id: string;
      taskName: string;
      status: string;
      startedAt: string;
      endedAt: string | null;
      pausedSeconds: number;
    }>;
    warnings: Array<{
      type: string;
      message: string;
    }>;
    reviewState: string;
  };
  weekSummary?: {
    from: string;
    to: string;
    days: Array<{
      workDate: string;
      workMinutes: number;
      hasData: boolean;
    }>;
    totals: {
      workMinutes: number;
      daysTracked: number;
    };
  } | null;
  calendarEvents?: Array<{
    id: string;
    title: string;
    startedAt: string;
    endedAt: string;
    isImported: boolean;
  }>;
  hasUnsyncedYesterday?: boolean;
  yesterdayKey?: string;
}

/**
 * Generates proactive, actionable companion alerts for time gaps, missed meetings,
 * missing work days, weekly target deficit (<40h), forgotten timers, and extended breaks.
 */
export function generateCompanionAlerts(context: CompanionAlertContext): TetraNotification[] {
  const alerts: TetraNotification[] = [];
  const now = context.now ?? new Date();

  const isAttendanceOpen = Boolean(
    context.daySummary.attendance &&
      !context.daySummary.attendance.clockOutAt &&
      !context.daySummary.attendance.endedAt,
  );

  // 1. Unaccounted Time Gap Alerts
  if (isAttendanceOpen) {
    const gapWarnings = context.daySummary.warnings.filter((w) => w.type === "gap");
    for (const w of gapWarnings) {
      alerts.push({
        id: `alert-gap-${context.daySummary.workDate}-${w.message.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`,
        type: "gap",
        severity: "warning",
        title: "Unaccounted Time Gap",
        message: `${w.message}. Log an activity or break to keep your report accurate.`,
        timestamp: now.toISOString(),
        read: false,
        href: "/",
        actionLabel: "Log Activity",
      });
    }
  }

  // 2. Missed / Unlogged Meeting Alerts
  if (context.calendarEvents) {
    for (const event of context.calendarEvents) {
      const endMs = new Date(event.endedAt).getTime();
      if (!event.isImported && endMs < now.getTime()) {
        const minutesAgo = Math.max(1, Math.floor((now.getTime() - endMs) / 60_000));
        if (minutesAgo <= 1440) {
          alerts.push({
            id: `alert-meeting-${event.id}`,
            type: "meeting",
            severity: "warning",
            title: "Unlogged Meeting",
            message: `Meeting "${event.title}" ended ${minutesAgo}m ago and has not been logged on your timeline.`,
            timestamp: now.toISOString(),
            read: false,
            href: "/",
            actionLabel: "Import Meeting",
          });
        }
      }
    }
  }

  // 3. Missing Work Day Alerts (Past weekdays Mon-Fri in current week)
  if (context.weekSummary) {
    for (const day of context.weekSummary.days) {
      if (day.workDate < context.todayKey) {
        // Parse date for day of week: 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
        const d = new Date(`${day.workDate}T12:00:00Z`);
        const dow = d.getUTCDay();
        if (dow >= 1 && dow <= 5 && !day.hasData && day.workMinutes === 0) {
          const dayName = WEEKDAY_NAMES[dow];
          alerts.push({
            id: `alert-missing-day-${day.workDate}`,
            type: "missing_day",
            severity: "warning",
            title: "Missing Work Day",
            message: `No work or attendance recorded for ${dayName} (${day.workDate}). Review and backfill before weekly submission.`,
            timestamp: now.toISOString(),
            read: false,
            href: `/days/${day.workDate}`,
            actionLabel: "Review Day",
          });
        }
      }
    }
  }

  // 4. Weekly Target Deficit (< 40h)
  if (context.weekSummary) {
    const todayDate = new Date(`${context.todayKey}T12:00:00Z`);
    const currentDow = todayDate.getUTCDay();
    const isLateWeekOrEnded = currentDow >= 5 || currentDow === 0 || context.weekSummary.to < context.todayKey;
    const weeklyMinutes = context.weekSummary.totals.workMinutes;

    if (isLateWeekOrEnded && weeklyMinutes < 2400) {
      const loggedHours = (weeklyMinutes / 60).toFixed(1);
      const remainingHours = ((2400 - weeklyMinutes) / 60).toFixed(1);
      alerts.push({
        id: `alert-weekly-target-${context.weekSummary.from}`,
        type: "weekly_target",
        severity: "warning",
        title: "Weekly Target Behind (< 40h)",
        message: `Weekly logged time is ${loggedHours}h of 40h goal (${remainingHours}h remaining). Review your week to meet company target.`,
        timestamp: now.toISOString(),
        read: false,
        href: "/reports/week",
        actionLabel: "Weekly Report",
      });
    }
  }

  // 5. Forgotten Running Timer (> 3h)
  const activeEntry = context.daySummary.timeEntries.find((e) => e.status === "active");
  if (activeEntry) {
    const runningMs = now.getTime() - new Date(activeEntry.startedAt).getTime() - (activeEntry.pausedSeconds * 1000);
    const runningMinutes = Math.floor(runningMs / 60_000);
    if (runningMinutes >= 180) {
      const h = Math.floor(runningMinutes / 60);
      const m = runningMinutes % 60;
      alerts.push({
        id: `alert-long-timer-${activeEntry.id}`,
        type: "timer",
        severity: "reminder",
        title: "Running Timer Reminder",
        message: `Timer for "${activeEntry.taskName}" has been running for ${h}h ${m}m. Did you step away or take a break?`,
        timestamp: now.toISOString(),
        read: false,
        href: "/",
        actionLabel: "Check Timer",
      });
    }
  }

  // 6. Extended Break Reminder (> 60m)
  if (isAttendanceOpen) {
    const activeBreak =
      context.daySummary.attendance?.activeBreak ??
      (context.daySummary.attendance?.breaks ?? context.daySummary.breaks ?? []).find(
        (b) => !b.endedAt,
      );
    if (activeBreak) {
      const breakMinutes = Math.floor((now.getTime() - new Date(activeBreak.startedAt).getTime()) / 60_000);
      if (breakMinutes >= 60) {
        const h = Math.floor(breakMinutes / 60);
        const m = breakMinutes % 60;
        alerts.push({
          id: `alert-long-break-${context.daySummary.workDate}`,
          type: "attendance",
          severity: "reminder",
          title: "Extended Break Reminder",
          message: `You have been on break for ${h}h ${m}m. Remember to resume your shift when back.`,
          timestamp: now.toISOString(),
          read: false,
          href: "/",
          actionLabel: "Resume Shift",
        });
      }
    }
  }

  // 7. Unsynced Yesterday Report
  if (context.hasUnsyncedYesterday && context.yesterdayKey) {
    alerts.push({
      id: `alert-unsynced-${context.yesterdayKey}`,
      type: "sync",
      severity: "warning",
      title: "Unsynced Daily Report",
      message: `Yesterday's daily summary (${context.yesterdayKey}) has not been synced to the official Google Sheet.`,
      timestamp: now.toISOString(),
      read: false,
      href: `/days/${context.yesterdayKey}`,
      actionLabel: "Review & Sync",
    });
  }

  return alerts;
}

/**
 * Merges server-generated alerts with existing user notifications.
 * Preserves user read state and dismissals without duplicating active alerts.
 */
export function mergeCompanionAlerts(
  existing: readonly TetraNotification[],
  newAlerts: readonly TetraNotification[],
): TetraNotification[] {
  const existingMap = new Map(existing.map((n) => [n.id, n]));
  const result: TetraNotification[] = [];

  for (const alert of newAlerts) {
    const prev = existingMap.get(alert.id);
    if (prev) {
      result.push({
        ...alert,
        read: prev.read,
        timestamp: prev.read ? prev.timestamp : alert.timestamp,
      });
      existingMap.delete(alert.id);
    } else {
      result.push(alert);
    }
  }

  for (const [id, item] of existingMap) {
    if (!id.startsWith("alert-")) {
      result.push(item);
    }
  }

  return result;
}

/**
 * Determines whether the startup notification banner overlay should be suppressed
 * for the given calendar day key (e.g. "YYYY-MM-DD").
 */
export function isBannerSuppressedForDate(
  suppressedDate: string | null | undefined,
  currentDayKey: string,
): boolean {
  if (!suppressedDate || !currentDayKey) return false;
  return suppressedDate.trim() === currentDayKey.trim();
}

