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
