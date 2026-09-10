"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { TetraNotification } from "./types";

const STORAGE_KEY = "tetra_notifications_v1";
const BROWSER_NOTIF_KEY = "tetra_browser_notifications_v1";

const INITIAL_NOTIFICATIONS: TetraNotification[] = [
  {
    id: "welcome-system",
    type: "system",
    severity: "info",
    title: "Welcome to TETRA",
    message:
      "TETRA is your lightweight tracking companion. Start tasks as you work, then sync to your Google Sheet.",
    timestamp: "2026-01-01T00:00:00.000Z",
    read: false,
    href: "/timeline",
    actionLabel: "View Timeline",
  },
];

export function sendBrowserAlert(title: string, body: string): void {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return;
  }
  if (Notification.permission === "granted") {
    try {
      new Notification(`TETRA · ${title}`, {
        body,
        icon: "/icon.svg",
      });
    } catch {
      // Ignored if service worker or notification constructor is restricted
    }
  }
}

// Module-level in-memory cache and subscribers
let memoryNotifications: TetraNotification[] | null = null;
const notifListeners = new Set<() => void>();

function notifyNotifSubscribers() {
  for (const listener of notifListeners) {
    listener();
  }
}

function getNotificationsSnapshot(): TetraNotification[] {
  if (typeof window === "undefined") return INITIAL_NOTIFICATIONS;
  if (memoryNotifications !== null) return memoryNotifications;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryNotifications = parsed;
        return memoryNotifications;
      }
    }
    memoryNotifications = INITIAL_NOTIFICATIONS;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_NOTIFICATIONS));
  } catch {
    memoryNotifications = INITIAL_NOTIFICATIONS;
  }
  return memoryNotifications;
}

function getServerNotificationsSnapshot(): TetraNotification[] {
  return INITIAL_NOTIFICATIONS;
}

function setStoredNotifications(next: TetraNotification[]) {
  memoryNotifications = next;
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // Ignore storage quota error
  }
  notifyNotifSubscribers();
}

function subscribeToNotifications(callback: () => void) {
  notifListeners.add(callback);

  const handleCustomNotify = (e: Event) => {
    const detail = (e as CustomEvent<Omit<TetraNotification, "id" | "timestamp" | "read">>).detail;
    if (!detail) return;

    const newNotification: TetraNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      read: false,
      ...detail,
    };

    const current = getNotificationsSnapshot();
    const updated = [newNotification, ...current.filter((n) => n.id !== newNotification.id)].slice(0, 40);
    setStoredNotifications(updated);

    try {
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted" &&
        localStorage.getItem(BROWSER_NOTIF_KEY) === "true"
      ) {
        sendBrowserAlert(newNotification.title, newNotification.message);
      }
    } catch {
      // Ignore
    }
  };

  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (Array.isArray(parsed)) {
          memoryNotifications = parsed;
          notifyNotifSubscribers();
        }
      } catch {
        // Ignore
      }
    }
  };

  window.addEventListener("tetra:notify", handleCustomNotify);
  window.addEventListener("storage", handleStorageChange);

  return () => {
    notifListeners.delete(callback);
    window.removeEventListener("tetra:notify", handleCustomNotify);
    window.removeEventListener("storage", handleStorageChange);
  };
}

// Browser alerts preference state
let memoryBrowserAlerts: boolean | null = null;
const alertPrefListeners = new Set<() => void>();

function notifyAlertPrefSubscribers() {
  for (const listener of alertPrefListeners) {
    listener();
  }
}

function getBrowserAlertsSnapshot(): boolean {
  if (typeof window === "undefined" || typeof Notification === "undefined") return false;
  if (memoryBrowserAlerts !== null) return memoryBrowserAlerts;

  try {
    const pref = localStorage.getItem(BROWSER_NOTIF_KEY);
    memoryBrowserAlerts = pref === "true" && Notification.permission === "granted";
  } catch {
    memoryBrowserAlerts = false;
  }
  return memoryBrowserAlerts;
}

function getServerBrowserAlertsSnapshot(): boolean {
  return false;
}

function subscribeToBrowserAlerts(callback: () => void) {
  alertPrefListeners.add(callback);
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === BROWSER_NOTIF_KEY) {
      memoryBrowserAlerts = e.newValue === "true";
      notifyAlertPrefSubscribers();
    }
  };
  window.addEventListener("storage", handleStorageChange);
  return () => {
    alertPrefListeners.delete(callback);
    window.removeEventListener("storage", handleStorageChange);
  };
}

// Hydration helper
function subscribeHydration() {
  return () => {};
}
function getHydrationSnapshot() {
  return true;
}
function getServerHydrationSnapshot() {
  return false;
}

export function emitNotification(
  notification: Omit<TetraNotification, "id" | "timestamp" | "read">,
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("tetra:notify", {
      detail: notification,
    }),
  );
}

export function useNotifications() {
  const notifications = useSyncExternalStore(
    subscribeToNotifications,
    getNotificationsSnapshot,
    getServerNotificationsSnapshot,
  );

  const browserAlertsEnabled = useSyncExternalStore(
    subscribeToBrowserAlerts,
    getBrowserAlertsSnapshot,
    getServerBrowserAlertsSnapshot,
  );

  const isLoaded = useSyncExternalStore(
    subscribeHydration,
    getHydrationSnapshot,
    getServerHydrationSnapshot,
  );

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const markAsRead = useCallback((id: string) => {
    const current = getNotificationsSnapshot();
    setStoredNotifications(
      current.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    const current = getNotificationsSnapshot();
    setStoredNotifications(current.map((n) => ({ ...n, read: true })));
  }, []);

  const removeNotification = useCallback((id: string) => {
    const current = getNotificationsSnapshot();
    setStoredNotifications(current.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setStoredNotifications([]);
  }, []);

  const toggleBrowserAlerts = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      return false;
    }

    if (Notification.permission === "granted") {
      const nextState = !getBrowserAlertsSnapshot();
      memoryBrowserAlerts = nextState;
      localStorage.setItem(BROWSER_NOTIF_KEY, String(nextState));
      notifyAlertPrefSubscribers();
      return nextState;
    }

    if (Notification.permission === "denied") {
      return false;
    }

    const permission = await Notification.requestPermission();
    const granted = permission === "granted";
    memoryBrowserAlerts = granted;
    localStorage.setItem(BROWSER_NOTIF_KEY, String(granted));
    notifyAlertPrefSubscribers();
    if (granted) {
      sendBrowserAlert("Notifications Enabled", "Desktop alerts are now active for TETRA.");
    }
    return granted;
  }, []);

  return {
    notifications,
    unreadCount,
    isLoaded,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    browserAlertsEnabled,
    toggleBrowserAlerts,
  };
}
