export type NotificationType =
  | "attendance"
  | "timer"
  | "review"
  | "sync"
  | "system";

export type NotificationSeverity =
  | "info"
  | "warning"
  | "success"
  | "reminder";

export interface TetraNotification {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  href?: string;
  actionLabel?: string;
}
