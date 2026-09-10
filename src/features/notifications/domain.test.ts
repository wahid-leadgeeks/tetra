import { describe, expect, it } from "vitest";

import {
  calculateUnreadCount,
  createNotification,
  filterNotifications,
  formatRelativeTime,
  markAllNotificationsRead,
  markNotificationRead,
  removeNotificationById,
} from "./domain";
import type { TetraNotification } from "./types";

describe("Notifications domain logic", () => {
  describe("formatRelativeTime", () => {
    const baseNow = new Date("2026-09-10T12:00:00Z");

    it("formats just now for events less than a minute ago", () => {
      const recent = new Date("2026-09-10T11:59:30Z").toISOString();
      expect(formatRelativeTime(recent, baseNow)).toBe("Just now");
    });

    it("formats minutes ago", () => {
      const fiveAgo = new Date("2026-09-10T11:55:00Z").toISOString();
      expect(formatRelativeTime(fiveAgo, baseNow)).toBe("5m ago");
    });

    it("formats hours ago", () => {
      const threeHoursAgo = new Date("2026-09-10T09:00:00Z").toISOString();
      expect(formatRelativeTime(threeHoursAgo, baseNow)).toBe("3h ago");
    });

    it("formats yesterday", () => {
      const yesterday = new Date("2026-09-09T10:00:00Z").toISOString();
      expect(formatRelativeTime(yesterday, baseNow)).toBe("Yesterday");
    });
  });

  describe("calculateUnreadCount", () => {
    it("returns 0 when all are read", () => {
      const list: TetraNotification[] = [
        {
          id: "1",
          type: "system",
          severity: "info",
          title: "A",
          message: "A",
          timestamp: "",
          read: true,
        },
      ];
      expect(calculateUnreadCount(list)).toBe(0);
    });

    it("counts unread notifications accurately", () => {
      const list: TetraNotification[] = [
        {
          id: "1",
          type: "system",
          severity: "info",
          title: "A",
          message: "A",
          timestamp: "",
          read: false,
        },
        {
          id: "2",
          type: "attendance",
          severity: "reminder",
          title: "B",
          message: "B",
          timestamp: "",
          read: true,
        },
        {
          id: "3",
          type: "sync",
          severity: "success",
          title: "C",
          message: "C",
          timestamp: "",
          read: false,
        },
      ];
      expect(calculateUnreadCount(list)).toBe(2);
    });
  });

  describe("filterNotifications", () => {
    const list: TetraNotification[] = [
      {
        id: "1",
        type: "system",
        severity: "info",
        title: "A",
        message: "A",
        timestamp: "",
        read: false,
      },
      {
        id: "2",
        type: "attendance",
        severity: "reminder",
        title: "B",
        message: "B",
        timestamp: "",
        read: true,
      },
    ];

    it("returns all items when tab is all", () => {
      expect(filterNotifications(list, "all")).toHaveLength(2);
    });

    it("filters only unread items when tab is unread", () => {
      const unread = filterNotifications(list, "unread");
      expect(unread).toHaveLength(1);
      expect(unread[0].id).toBe("1");
    });
  });

  describe("markNotificationRead & markAllNotificationsRead", () => {
    const list: TetraNotification[] = [
      {
        id: "1",
        type: "system",
        severity: "info",
        title: "A",
        message: "A",
        timestamp: "",
        read: false,
      },
      {
        id: "2",
        type: "attendance",
        severity: "reminder",
        title: "B",
        message: "B",
        timestamp: "",
        read: false,
      },
    ];

    it("marks single notification as read without mutating original", () => {
      const updated = markNotificationRead(list, "1");
      expect(updated[0].read).toBe(true);
      expect(updated[1].read).toBe(false);
      expect(list[0].read).toBe(false);
    });

    it("marks all notifications as read", () => {
      const updated = markAllNotificationsRead(list);
      expect(updated.every((n) => n.read)).toBe(true);
    });
  });

  describe("removeNotificationById", () => {
    const list: TetraNotification[] = [
      {
        id: "1",
        type: "system",
        severity: "info",
        title: "A",
        message: "A",
        timestamp: "",
        read: false,
      },
      {
        id: "2",
        type: "attendance",
        severity: "reminder",
        title: "B",
        message: "B",
        timestamp: "",
        read: false,
      },
    ];

    it("removes specified notification by id", () => {
      const updated = removeNotificationById(list, "1");
      expect(updated).toHaveLength(1);
      expect(updated[0].id).toBe("2");
    });
  });

  describe("createNotification", () => {
    it("generates a new notification with unique id, ISO timestamp and unread status", () => {
      const now = new Date("2026-09-10T12:00:00Z");
      const notif = createNotification(
        {
          type: "sync",
          severity: "success",
          title: "Google Sheet Synced",
          message: "All 5 cells updated successfully.",
          href: "/timeline",
          actionLabel: "View",
        },
        now,
      );

      expect(notif.id).toMatch(/^notif-\d+/);
      expect(notif.type).toBe("sync");
      expect(notif.severity).toBe("success");
      expect(notif.title).toBe("Google Sheet Synced");
      expect(notif.timestamp).toBe(now.toISOString());
      expect(notif.read).toBe(false);
      expect(notif.href).toBe("/timeline");
      expect(notif.actionLabel).toBe("View");
    });
  });
});
