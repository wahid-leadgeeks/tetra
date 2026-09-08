"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Calendar,
  CalendarDays,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CategoryBadge } from "@/components/ui/category-badge";
import { ImportCalendarDialog } from "@/components/today/import-calendar-dialog";
import type {
  CalendarConfigDTO,
  CalendarEventSuggestionDTO,
} from "@/features/calendar-sync/types";
import { cn } from "@/lib/utils";
import { todayKey } from "@/lib/time";

interface CalendarScheduleCardProps {
  timezone: string;
  dayKey?: string;
  onImportSuccess?: () => void;
  className?: string;
}

interface CalendarEventsApiResponse {
  events: CalendarEventSuggestionDTO[];
  config: CalendarConfigDTO;
  hasGoogleAuth: boolean;
  error?: string;
}

export function CalendarScheduleCard({
  timezone,
  dayKey,
  onImportSuccess,
  className,
}: CalendarScheduleCardProps) {
  const [events, setEvents] = useState<CalendarEventSuggestionDTO[]>([]);
  const [config, setConfig] = useState<CalendarConfigDTO | null>(null);
  const [hasGoogleAuth, setHasGoogleAuth] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const effectiveDayKey = dayKey || todayKey(timezone);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/calendar/events?date=${effectiveDayKey}`);
        if (cancelled) return;
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to load calendar events");
        }
        const data: CalendarEventsApiResponse = await res.json();
        if (cancelled) return;
        setEvents(data.events || []);
        setConfig(data.config || null);
        setHasGoogleAuth(data.hasGoogleAuth ?? false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load events");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [effectiveDayKey]);

  const refreshSchedule = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/calendar/events?date=${effectiveDayKey}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load calendar events");
      }
      const data: CalendarEventsApiResponse = await res.json();
      setEvents(data.events || []);
      setConfig(data.config || null);
      setHasGoogleAuth(data.hasGoogleAuth ?? false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  }, [effectiveDayKey]);

  const handleImportSuccess = () => {
    void refreshSchedule();
    onImportSuccess?.();
  };

  const nonOverlappingCount = events.filter((e) => !e.hasOverlap).length;

  return (
    <>
      <Card
        className={cn("border border-border/80 bg-card shadow-xs", className)}
        data-testid="calendar-schedule-card"
      >
        <CardHeader className="flex flex-row items-center justify-between pb-3 pt-5 px-5 space-y-0">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarDays className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading text-sm font-semibold tracking-tight text-foreground">
                  Today&apos;s Schedule
                </h3>
                {config?.calendarName && config.calendarName !== "Primary" && (
                  <span className="text-[11px] text-muted-foreground">
                    ({config.calendarName})
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Google Calendar events &amp; suggested categories
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {events.length > 0 && (
              <Badge variant="secondary" className="text-xs font-medium">
                {events.length} {events.length === 1 ? "event" : "events"}
              </Badge>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={() => void refreshSchedule()}
              disabled={loading}
              title="Refresh Google Calendar"
              data-testid="calendar-refresh-button"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="px-5 pb-5 pt-0">
          {loading && events.length === 0 ? (
            <div className="flex flex-col gap-2.5 py-2">
              <div className="h-12 w-full animate-pulse rounded-lg bg-muted/60" />
              <div className="h-12 w-full animate-pulse rounded-lg bg-muted/40" />
            </div>
          ) : error ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">Could not load schedule</p>
                <p className="text-muted-foreground mt-0.5">{error}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => void refreshSchedule()}
              >
                Retry
              </Button>
            </div>
          ) : !hasGoogleAuth ? (
            <div className="flex items-center justify-between gap-4 rounded-xl border border-dashed border-border/80 bg-muted/20 p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Calendar className="size-4" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-foreground">
                    Connect Google Calendar
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Link your Google account to surface your daily meetings and import them directly into TETRA.
                  </p>
                </div>
              </div>
              <Button asChild variant="outline" size="sm" className="h-8 shrink-0 text-xs gap-1">
                <Link href="/settings">
                  Connect <ExternalLink className="size-3" />
                </Link>
              </Button>
            </div>
          ) : config && !config.syncEnabled ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
              <span className="text-muted-foreground">
                Google Calendar suggestions are disabled in settings.
              </span>
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                <Link href="/settings">Settings</Link>
              </Button>
            </div>
          ) : events.length === 0 ? (
            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3.5 py-3 text-xs text-muted-foreground">
              <span>No scheduled events found for today.</span>
              <span className="text-[11px] text-muted-foreground/70">
                All clear!
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className={cn(
                      "flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border p-2.5 transition-all text-xs",
                      event.hasOverlap
                        ? "border-amber-500/25 bg-amber-500/[0.02]"
                        : "border-border/60 bg-card hover:bg-muted/30",
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono font-medium text-foreground shrink-0">
                        {event.formattedClock}
                      </span>
                      {event.durationMinutes > 0 && (
                        <span className="text-muted-foreground shrink-0 text-[11px]">
                          ({event.durationMinutes}m)
                        </span>
                      )}
                      <span
                        className="font-medium text-foreground truncate max-w-[200px] sm:max-w-[260px]"
                        title={event.title}
                      >
                        {event.title}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <CategoryBadge
                        categoryKey={event.suggestedCategoryKey}
                        categoryName={event.suggestedCategoryName}
                        size="sm"
                      />

                      {event.hasOverlap ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 font-normal"
                          title={`Overlaps with: ${event.overlappingTaskNames.join(", ")}`}
                        >
                          <AlertCircle className="size-2.5 shrink-0" />
                          Overlaps
                        </Badge>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                          New
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/50">
                <span className="text-xs text-muted-foreground">
                  {nonOverlappingCount > 0
                    ? `${nonOverlappingCount} new ${
                        nonOverlappingCount === 1 ? "activity" : "activities"
                      } ready to import`
                    : "All events overlap existing entries"}
                </span>

                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-medium shadow-xs"
                  onClick={() => setImportDialogOpen(true)}
                  data-testid="calendar-import-button"
                >
                  <Calendar className="size-3.5" />
                  Review &amp; Import
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ImportCalendarDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        events={events}
        onImportSuccess={handleImportSuccess}
      />
    </>
  );
}
