"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true;
}

/**
 * Offline & Reconnection Banner.
 *
 * Subscribes to browser online/offline status via useSyncExternalStore,
 * presents an accessible banner when disconnected, and notifies / triggers
 * data resync when connection is restored.
 */
export function NetworkStatusBanner() {
  const isOnline = useSyncExternalStore(
    subscribeOnline,
    getSnapshot,
    getServerSnapshot,
  );
  const [recentlyRestored, setRecentlyRestored] = useState<boolean>(false);

  useEffect(() => {
    function handleOnline() {
      setRecentlyRestored(true);
      toast.success("Internet connection restored", {
        description: "Synced with server.",
      });

      // Dispatch global custom event for views to refresh server state
      window.dispatchEvent(new CustomEvent("tetra:network-online"));

      const timer = setTimeout(() => {
        setRecentlyRestored(false);
      }, 4000);
      return () => clearTimeout(timer);
    }

    function handleOffline() {
      setRecentlyRestored(false);
      toast.error("Internet connection lost", {
        description: "Active timers continue locally. Changes will sync when reconnected.",
      });
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline && !recentlyRestored) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="offline-banner"
      className={cn(
        "relative z-50 flex items-center justify-center gap-2.5 px-4 py-2.5 text-xs font-medium transition-all",
        !isOnline
          ? "bg-amber-500/15 border-b border-amber-500/30 text-amber-900 dark:text-amber-200"
          : "bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-900 dark:text-emerald-200",
      )}
    >
      {!isOnline ? (
        <>
          <WifiOff className="size-4 shrink-0 text-amber-600 dark:text-amber-400 animate-pulse" />
          <span>
            <strong>Offline mode:</strong> You are currently disconnected. Your
            timer keeps ticking locally, but actions cannot be saved until
            connection is restored.
          </span>
        </>
      ) : (
        <>
          <Wifi className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>
            <strong>Back online!</strong> Connection restored. All active tasks
            and timers are synced.
          </span>
        </>
      )}
    </div>
  );
}
