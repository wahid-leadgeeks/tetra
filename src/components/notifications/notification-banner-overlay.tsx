"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BellOff,
  Calendar,
  CalendarX2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Info,
  Layers,
  Sparkles,
  Target,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatRelativeTime } from "@/features/notifications/domain";
import { useNotifications } from "@/features/notifications/store";
import type { TetraNotification } from "@/features/notifications/types";
import { todayKey } from "@/lib/time";
import { cn } from "@/lib/utils";

interface NotificationBannerOverlayProps {
  timezone: string;
}

function getAlertVisuals(notification: TetraNotification) {
  switch (notification.type) {
    case "missing_day":
      return {
        icon: <CalendarX2 className="size-4 shrink-0 text-rose-600 dark:text-rose-400" />,
        badgeText: "Missing Work Day",
        badgeClass: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
        containerClass: "border-rose-500/30 bg-rose-500/[0.04] dark:bg-rose-500/[0.07]",
      };
    case "meeting":
      return {
        icon: <Calendar className="size-4 shrink-0 text-indigo-600 dark:text-indigo-400" />,
        badgeText: "Unlogged Meeting",
        badgeClass: "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
        containerClass: "border-indigo-500/30 bg-indigo-500/[0.04] dark:bg-indigo-500/[0.07]",
      };
    case "gap":
      return {
        icon: <Clock className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />,
        badgeText: "Time Gap",
        badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        containerClass: "border-amber-500/30 bg-amber-500/[0.04] dark:bg-amber-500/[0.07]",
      };
    case "weekly_target":
      return {
        icon: <Target className="size-4 shrink-0 text-violet-600 dark:text-violet-400" />,
        badgeText: "Weekly Goal",
        badgeClass: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
        containerClass: "border-violet-500/30 bg-violet-500/[0.04] dark:bg-violet-500/[0.07]",
      };
    case "sync":
      return {
        icon: <Layers className="size-4 shrink-0 text-sky-600 dark:text-sky-400" />,
        badgeText: "Daily Sync",
        badgeClass: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
        containerClass: "border-sky-500/30 bg-sky-500/[0.04] dark:bg-sky-500/[0.07]",
      };
    case "timer":
      return {
        icon: <TriangleAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />,
        badgeText: "Timer Alert",
        badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        containerClass: "border-amber-500/30 bg-amber-500/[0.04] dark:bg-amber-500/[0.07]",
      };
    case "attendance":
      return {
        icon: <Clock className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />,
        badgeText: "Attendance",
        badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        containerClass: "border-emerald-500/30 bg-emerald-500/[0.04] dark:bg-emerald-500/[0.07]",
      };
    case "review":
      return {
        icon: <Sparkles className="size-4 shrink-0 text-primary" />,
        badgeText: "Review",
        badgeClass: "border-primary/30 bg-primary/10 text-primary",
        containerClass: "border-primary/25 bg-card",
      };
    default:
      return {
        icon: <Info className="size-4 shrink-0 text-muted-foreground" />,
        badgeText: "Notice",
        badgeClass: "border-border bg-muted text-muted-foreground",
        containerClass: "border-border/80 bg-card",
      };
  }
}

/**
 * Startup Notification Banner Overlay
 *
 * Prominently presents actionable companion notifications upon initial app startup
 * (e.g. unlogged meetings, missing days, weekly target deficits, unaccounted time gaps).
 *
 * Supports full user control:
 * - 1-click action navigation with auto-read
 * - Direct "Don't show again today" option that suppresses the banner for the rest of today
 * - Session dismissal ("Dismiss for now")
 * - Carousel navigation when multiple unread notifications are pending
 */
export function NotificationBannerOverlay({ timezone }: NotificationBannerOverlayProps) {
  const {
    notifications,
    isBannerMutedToday,
    muteBannerToday,
    unmuteBannerToday,
    markAsRead,
    refreshAlerts,
  } = useNotifications();

  const [sessionDismissed, setSessionDismissed] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentTodayKey = todayKey(timezone);
  const isMutedToday = isBannerMutedToday(currentTodayKey);

  useEffect(() => {
    void refreshAlerts();
  }, [refreshAlerts]);

  const unreadAlerts = useMemo(() => {
    return notifications.filter((n) => !n.read);
  }, [notifications]);

  // Adjust pagination index if list shortens
  const safeIndex = Math.min(currentIndex, Math.max(0, unreadAlerts.length - 1));
  const activeAlert = unreadAlerts[safeIndex];

  if (sessionDismissed || isMutedToday || unreadAlerts.length === 0 || !activeAlert) {
    return null;
  }

  const visuals = getAlertVisuals(activeAlert);

  const handleMuteToday = () => {
    muteBannerToday(currentTodayKey);
    toast.info("Startup notifications banner muted for today", {
      description: "You can still view and manage all alerts in the header bell menu.",
      action: {
        label: "Undo",
        onClick: () => unmuteBannerToday(),
      },
    });
  };

  const handleAction = () => {
    markAsRead(activeAlert.id);
  };

  return (
    <aside
      role="region"
      aria-label="Startup notifications banner"
      data-testid="notification-banner-overlay"
      className="sticky top-14 z-20 w-full px-4 sm:px-6 md:px-8 pt-2.5 pb-1 pointer-events-none transition-all duration-300"
    >
      <div className="pointer-events-auto mx-auto max-w-5xl lg:max-w-6xl xl:max-w-7xl">
        <div
          className={cn(
            "relative flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border p-3 sm:p-3.5 shadow-md backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-2",
            visuals.containerClass,
          )}
        >
          {/* Left section: Icon, Badge, Content */}
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="mt-0.5 rounded-lg border border-border/60 bg-background/80 p-2 shadow-2xs shrink-0">
              {visuals.icon}
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn("text-[10px] uppercase font-semibold tracking-wider", visuals.badgeClass)}
                >
                  {visuals.badgeText}
                </Badge>

                <span className="text-xs font-semibold text-foreground truncate">
                  {activeAlert.title}
                </span>

                <span className="text-[11px] font-mono text-muted-foreground/70 shrink-0">
                  {formatRelativeTime(activeAlert.timestamp)}
                </span>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                {activeAlert.message}
              </p>
            </div>
          </div>

          {/* Right section: Pager, Actions, Don't show today, Dismiss */}
          <div className="flex flex-wrap items-center justify-between md:justify-end gap-2 shrink-0 pt-1 md:pt-0 border-t md:border-t-0 border-border/40">
            {unreadAlerts.length > 1 && (
              <div
                className="flex items-center gap-1 rounded-lg border border-border/60 bg-background/80 px-2 py-1 text-xs text-muted-foreground shadow-2xs"
                data-testid="banner-pager"
              >
                <button
                  type="button"
                  onClick={() => setCurrentIndex((i) => (i > 0 ? i - 1 : unreadAlerts.length - 1))}
                  className="rounded p-0.5 hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                  aria-label="Previous notification"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                <span className="px-1 text-[11px] font-mono font-medium text-foreground">
                  {safeIndex + 1} of {unreadAlerts.length}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentIndex((i) => (i < unreadAlerts.length - 1 ? i + 1 : 0))}
                  className="rounded p-0.5 hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                  aria-label="Next notification"
                >
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-1.5 ml-auto md:ml-0">
              {activeAlert.actionLabel && activeAlert.href && (
                <Button
                  size="sm"
                  className="h-8 text-xs font-medium gap-1.5 shadow-xs cursor-pointer"
                  asChild
                  onClick={handleAction}
                  data-testid="banner-action-button"
                >
                  <Link href={activeAlert.href}>
                    <span>{activeAlert.actionLabel}</span>
                    <ExternalLink className="size-3 shrink-0" />
                  </Link>
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={handleMuteToday}
                className="h-8 text-xs font-medium text-muted-foreground hover:text-foreground gap-1.5 border-border/70 hover:bg-background/80 cursor-pointer"
                title="Don't show this notification banner again today"
                data-testid="banner-dont-show-today-button"
              >
                <BellOff className="size-3.5 shrink-0" />
                <span className="hidden sm:inline">Don&apos;t show again today</span>
                <span className="sm:hidden">Mute today</span>
              </Button>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSessionDismissed(true)}
                    className="size-8 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
                    aria-label="Dismiss banner"
                    data-testid="banner-dismiss-button"
                  >
                    <X className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Dismiss for now</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
