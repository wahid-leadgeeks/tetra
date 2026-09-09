"use client";

/**
 * Timeline — the day's activities and breaks as calm cards, interleaved by
 * time (DESIGN.md "Timeline"). GET /api/days/:date is the single source;
 * every mutation refetches it and refreshes the router.
 *
 * Gaps between consecutive items render an inline "Fill gap" action that
 * opens the entry dialog pre-filled with the gap's exact boundaries;
 * completed entry cards offer Split (DESIGN.md timeline actions).
 */
import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CloudUpload,
  Coffee,
  Download,
  Loader2,
  Pencil,
  Plus,
  Scissors,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryBadge } from "@/components/ui/category-badge";
import { CategoryPieChart } from "@/components/ui/category-pie-chart";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getCategoryTheme } from "@/lib/categories";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { apiFetch } from "@/components/timeline/api";
import { DayNavigator } from "@/components/timeline/day-navigator";
import { EntryDialog, type EntryPrefill } from "@/components/timeline/entry-dialog";
import { SplitEntryDialog } from "@/components/timeline/split-entry-dialog";
import { formatClock } from "@/components/timeline/time";
import { formatHMM, formatHuman } from "@/lib/time";
import type {
  BreakDTO,
  CategoryDTO,
  DaySummaryDTO,
  TimeEntryDTO,
} from "@/lib/types";

type TimelineItem =
  | { kind: "entry"; entry: TimeEntryDTO }
  | { kind: "break"; breakItem: BreakDTO };

/** Matches the daily summary's gap-warning threshold (5 minutes). */
const GAP_THRESHOLD_MINUTES = 5;

interface TimelineGap {
  /** Index of the item the gap follows. */
  afterIndex: number;
  fromIso: string;
  toIso: string;
  fromClock: string;
  toClock: string;
  minutes: number;
}

function itemStart(item: TimelineItem): string {
  return item.kind === "entry" ? item.entry.startedAt : item.breakItem.startedAt;
}

function itemEnd(item: TimelineItem): string | null {
  return item.kind === "entry" ? item.entry.endedAt : item.breakItem.endedAt;
}

/**
 * Gaps between consecutive items (activities and breaks alike) wider than
 * the threshold — exactly the spans a "fill this gap" backfill should cover.
 * Items with no end yet (running task / open break) never bound a gap.
 */
function gapsBetweenItems(
  items: TimelineItem[],
  timeZone: string,
): TimelineGap[] {
  const gaps: TimelineGap[] = [];
  for (let i = 0; i + 1 < items.length; i += 1) {
    const prevEnd = itemEnd(items[i]!);
    const nextStart = itemStart(items[i + 1]!);
    if (prevEnd === null) continue;
    const minutes = Math.floor(
      (Date.parse(nextStart) - Date.parse(prevEnd)) / 60_000,
    );
    if (minutes <= GAP_THRESHOLD_MINUTES) continue;
    gaps.push({
      afterIndex: i,
      fromIso: prevEnd,
      toIso: nextStart,
      fromClock: formatClock(prevEnd, timeZone),
      toClock: formatClock(nextStart, timeZone),
      minutes,
    });
  }
  return gaps;
}

function interleave(summary: DaySummaryDTO): TimelineItem[] {
  const items: TimelineItem[] = [
    ...summary.timeEntries.map<TimelineItem>((entry) => ({
      kind: "entry",
      entry,
    })),
    ...(summary.attendance?.breaks ?? []).map<TimelineItem>((breakItem) => ({
      kind: "break",
      breakItem,
    })),
  ];
  return items.sort((a, b) => {
    const aStart = a.kind === "entry" ? a.entry.startedAt : a.breakItem.startedAt;
    const bStart = b.kind === "entry" ? b.entry.startedAt : b.breakItem.startedAt;
    return aStart.localeCompare(bStart);
  });
}

function StatusBadge({ status }: { status: TimeEntryDTO["status"] }) {
  if (status === "active") {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
        Running
      </Badge>
    );
  }
  if (status === "paused") {
    return (
      <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400">
        Paused
      </Badge>
    );
  }
  return null;
}

function TimelineSkeleton() {
  return (
    <div className="grid gap-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-20 animate-pulse rounded-xl bg-muted"
          style={{ opacity: 1 - i * 0.2 }}
        />
      ))}
    </div>
  );
}

interface TimelineViewProps {
  timeZone: string;
  initialDay: string;
}

export function TimelineView({ timeZone, initialDay }: TimelineViewProps) {
  const router = useRouter();
  const [dayKey, setDayKey] = useState(initialDay);
  const [summary, setSummary] = useState<DaySummaryDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addPrefill, setAddPrefill] = useState<EntryPrefill | null>(null);
  const [addInitialKind, setAddInitialKind] = useState<"entry" | "break">("entry");
  const [editEntry, setEditEntry] = useState<TimeEntryDTO | null>(null);
  const [splitEntry, setSplitEntry] = useState<TimeEntryDTO | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<TimeEntryDTO | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editBreak, setEditBreak] = useState<BreakDTO | null>(null);
  const [deleteBreak, setDeleteBreak] = useState<BreakDTO | null>(null);
  const [deletingBreak, setDeletingBreak] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [autoSyncTasks, setAutoSyncTasks] = useState(true);
  const [togglingAutoSync, setTogglingAutoSync] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ id?: string; mapping?: { autoSyncTasks?: boolean } }>("/api/sync-config")
      .then((config) => {
        if (!cancelled && config?.mapping?.autoSyncTasks !== undefined) {
          setAutoSyncTasks(Boolean(config.mapping.autoSyncTasks));
        }
      })
      .catch(() => {
        // Silently ignore if sync is not configured yet
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleToggleAutoSync(checked: boolean) {
    setAutoSyncTasks(checked);
    setTogglingAutoSync(true);
    try {
      await apiFetch("/api/sync-config", {
        method: "PATCH",
        body: JSON.stringify({ autoSyncTasks: checked }),
      });
      toast.success(checked ? "Auto-sync tasks enabled" : "Auto-sync tasks disabled");
    } catch (err) {
      setAutoSyncTasks(!checked);
      toast.error(err instanceof Error ? err.message : "Could not update sync setting");
    } finally {
      setTogglingAutoSync(false);
    }
  }

  async function syncTasksBackground() {
    try {
      const res = await apiFetch<{ status: string; changedCells: { a1: string; value: string }[]; idempotent: boolean }>(
        `/api/days/${dayKey}/sync`,
        {
          method: "POST",
          body: JSON.stringify({ allowUnreviewed: true, tasksOnly: true }),
        },
      );
      if (!res.idempotent && res.changedCells && res.changedCells.length > 0) {
        toast.success(`Tasks auto-synced to Google Sheet (${res.changedCells.length} cells)`);
      }
    } catch {
      // Non-blocking background sync; keep quiet on routine errors
    }
  }

  function handleSaved() {
    refresh();
    if (autoSyncTasks) {
      void syncTasksBackground();
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await apiFetch<{ status: string; changedCells: { a1: string; value: string }[]; idempotent: boolean }>(
        `/api/days/${dayKey}/sync`,
        {
          method: "POST",
          body: JSON.stringify({ allowUnreviewed: true }),
        },
      );
      if (res.idempotent || !res.changedCells || res.changedCells.length === 0) {
        toast.info("Spreadsheet is already up to date.");
      } else {
        toast.success(`Synced ${res.changedCells.length} cells to Google Sheet!`);
      }
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    apiFetch<DaySummaryDTO>(`/api/days/${dayKey}`)
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSummary(null);
        setError(err instanceof Error ? err.message : "Could not load the day.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dayKey, fetchKey]);

  useEffect(() => {
    let cancelled = false;
    apiFetch<CategoryDTO[]>("/api/categories")
      .then((data) => {
        if (!cancelled) setCategories(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setCategoriesError(
            err instanceof Error ? err.message : "Could not load categories.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleDayChange(nextDay: string) {
    setDayKey(nextDay);
    setLoading(true);
    setError(null);
  }

  function refresh() {
    setLoading(true);
    setError(null);
    setFetchKey((key) => key + 1);
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteEntry) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/time-entries/${deleteEntry.id}`, {
        method: "DELETE",
      });
      toast.success("Entry deleted.");
      setDeleteEntry(null);
      refresh();
      if (autoSyncTasks) {
        void syncTasksBackground();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeleteBreak() {
    if (!deleteBreak) return;
    setDeletingBreak(true);
    try {
      await apiFetch(`/api/breaks/${deleteBreak.id}`, {
        method: "DELETE",
      });
      toast.success("Break deleted.");
      setDeleteBreak(null);
      refresh();
      if (autoSyncTasks) {
        void syncTasksBackground();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete break.");
    } finally {
      setDeletingBreak(false);
    }
  }

  async function handlePull() {
    setPulling(true);
    try {
      await apiFetch<DaySummaryDTO>(`/api/days/${dayKey}/pull`, {
        method: "POST",
      });
      toast.success("Tracking data pulled from Google Sheet!");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Pull failed.");
    } finally {
      setPulling(false);
    }
  }

  const items = summary ? interleave(summary) : [];
  const gaps = items.length > 1 ? gapsBetweenItems(items, timeZone) : [];
  const gapAfter = new Map(gaps.map((gap) => [gap.afterIndex, gap]));
  const hasActivity = items.length > 0;

  function openAddDialog(
    prefill: EntryPrefill | null,
    kind: "entry" | "break" = "entry",
  ) {
    setAddPrefill(prefill);
    setAddInitialKind(kind);
    setAddOpen(true);
  }

  return (
    <div className="w-full">
      <header className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Timeline
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 h-11"
              title="Automatically sync task changes and notes to your Google Sheet"
            >
              <Switch
                id="auto-sync-tasks-switch"
                checked={autoSyncTasks}
                disabled={togglingAutoSync}
                onCheckedChange={handleToggleAutoSync}
                data-testid="auto-sync-switch"
              />
              <Label
                htmlFor="auto-sync-tasks-switch"
                className="text-xs font-medium cursor-pointer select-none text-muted-foreground whitespace-nowrap"
              >
                Auto-sync
              </Label>
            </div>

            <Button
              variant="outline"
              className="h-11 px-4"
              onClick={() => void handleSync()}
              disabled={syncing}
              data-testid="sync-to-sheet-button"
              title="Sync this day's tasks, notes, and times directly to your Google Sheet"
            >
              {syncing ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <CloudUpload className="mr-2 size-4 text-emerald-600 dark:text-emerald-400" />
              )}
              {syncing ? "Syncing…" : "Sync to Sheet"}
            </Button>

            <Button
              variant="outline"
              className="h-11 px-4"
              onClick={() => void handlePull()}
              disabled={pulling}
              data-testid="pull-from-sheet"
              title="Pull this day's entries and times directly from your Google Sheet"
            >
              <Download className="mr-2 size-4" />
              {pulling ? "Pulling…" : "Pull from Sheet"}
            </Button>
            <Button
              variant="outline"
              className="h-11 px-4"
              onClick={() => openAddDialog(null, "break")}
              data-testid="add-break-button"
            >
              <Coffee className="mr-2 size-4 text-sky-600 dark:text-sky-400" />
              Add break
            </Button>
            <Button
              className="h-11 px-4"
              onClick={() => openAddDialog(null, "entry")}
              data-testid="add-missing-entry"
            >
              <Plus aria-hidden />
              Add activity
            </Button>
          </div>
        </div>
        <DayNavigator
          dayKey={dayKey}
          timeZone={timeZone}
          onChange={handleDayChange}
        />
        {summary && (
          <p className="text-sm text-muted-foreground">
            Work{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatHMM(summary.totals.workMinutes)}
            </span>{" "}
            <span className="text-xs text-muted-foreground">
              ({formatHuman(summary.totals.workMinutes)})
            </span>{" "}
            · Break{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatHMM(summary.totals.breakMinutes)}
            </span>{" "}
            <span className="text-xs text-muted-foreground">
              ({formatHuman(summary.totals.breakMinutes)})
            </span>{" "}
            · {summary.timeEntries.length}{" "}
            {summary.timeEntries.length === 1 ? "activity" : "activities"}
          </p>
        )}
      </header>

      <Separator className="my-6" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main timeline column */}
        <div className="lg:col-span-8 flex flex-col gap-6" data-tour="timeline-main">
          {loading ? (
        <TimelineSkeleton />
      ) : error ? (
        <Card className="items-start gap-3 p-6" data-testid="timeline-error">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TriangleAlert aria-hidden />
            <p>{error}</p>
          </div>
          <Button
            variant="outline"
            className="h-11 px-4"
            onClick={refresh}
          >
            Try again
          </Button>
        </Card>
      ) : !hasActivity ? (
        <Card
          className="items-start gap-3 p-8 text-center sm:p-10"
          data-testid="timeline"
        >
          <p className="font-heading text-base font-medium">
            Nothing tracked on this day
          </p>
          <p className="text-sm text-muted-foreground">
            Missed something? Add it manually and TETRA will fit it into the
            day.
          </p>
          <Button
            className="h-11 px-4"
            onClick={() => openAddDialog(null)}
            data-testid="add-missing-entry"
          >
            <Plus aria-hidden />
            Add missing entry
          </Button>
        </Card>
      ) : (
        <ol className="grid gap-3" data-testid="timeline">
          {items.map((item, index) => {
            const gapBefore = gapAfter.get(index - 1) ?? null;
            return (
              <Fragment
                key={
                  item.kind === "entry"
                    ? `entry-${item.entry.id}`
                    : `break-${item.breakItem.id}`
                }
              >
                {gapBefore ? (
                  <li className="flex items-center gap-3 py-1">
                    <div
                      aria-hidden
                      className="h-px flex-1 border-t border-dashed border-border"
                    />
                    <button
                      type="button"
                      data-testid="fill-gap-button"
                      className="inline-flex h-10 items-center gap-1.5 rounded-full border border-dashed border-amber-500/40 bg-amber-500/[0.06] px-4 text-xs font-medium text-amber-700 dark:text-amber-300 outline-none transition-all select-none hover:bg-amber-500/15 focus-visible:ring-3 focus-visible:ring-ring/50 cursor-pointer"
                      title={`Fill the ${formatHuman(gapBefore.minutes)} gap from ${gapBefore.fromClock} to ${gapBefore.toClock}`}
                      aria-label={`Fill the ${formatHuman(gapBefore.minutes)} gap from ${gapBefore.fromClock} to ${gapBefore.toClock}`}
                      onClick={() =>
                        openAddDialog({
                          start: gapBefore.fromClock,
                          end: gapBefore.toClock,
                        })
                      }
                    >
                      <Plus aria-hidden className="size-3.5" />
                      Fill {formatHuman(gapBefore.minutes)} gap
                    </button>
                    <div
                      aria-hidden
                      className="h-px flex-1 border-t border-dashed border-border"
                    />
                  </li>
                ) : null}
              {item.kind === "entry" ? (
                <li>
                  {(() => {
                    const theme = getCategoryTheme(
                      item.entry.categoryKey || item.entry.categoryName,
                    );
                    return (
                      <Card
                        size="sm"
                        className={cn(
                          "gap-0 border-l-4 px-4 py-4 sm:px-5 shadow-xs transition-colors",
                          theme.borderClass,
                        )}
                      >
                        <div className="flex items-start gap-3 sm:gap-4">
                          <p className="w-12 shrink-0 pt-0.5 text-sm font-medium tabular-nums text-muted-foreground">
                            {formatClock(item.entry.startedAt, timeZone)}
                          </p>
                          <div className="min-w-0 flex-1 flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <CategoryBadge
                                categoryKey={item.entry.categoryKey}
                                categoryName={item.entry.categoryName}
                                size="sm"
                              />
                            </div>
                            <p className="truncate font-heading text-base font-semibold text-foreground">
                              {item.entry.taskName}
                            </p>
                            {item.entry.notes && (
                              <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                                {item.entry.notes}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-0.5">
                            {item.entry.status === "completed" ? (
                              <>
                                <p className="font-heading text-base font-semibold tabular-nums text-foreground">
                                  {item.entry.durationMinutes !== null
                                    ? formatHMM(item.entry.durationMinutes)
                                    : "—"}
                                </p>
                                {item.entry.durationMinutes !== null && (
                                  <span className="text-xs text-muted-foreground tabular-nums">
                                    {formatHuman(item.entry.durationMinutes)}
                                  </span>
                                )}
                              </>
                            ) : (
                              <StatusBadge status={item.entry.status} />
                            )}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-end gap-1 border-t border-border/70 pt-2.5">
                          {item.entry.status === "completed" ? (
                            <Button
                              variant="ghost"
                              className="h-10 px-3 text-xs"
                              onClick={() => setSplitEntry(item.entry)}
                              aria-label={`Split ${item.entry.taskName}`}
                              data-testid="split-entry-button"
                            >
                              <Scissors aria-hidden className="size-3.5" />
                              Split
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            className="h-10 px-3 text-xs"
                            onClick={() => setEditEntry(item.entry)}
                            aria-label={`Edit ${item.entry.taskName}`}
                          >
                            <Pencil aria-hidden className="size-3.5" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            className="h-10 px-3 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleteEntry(item.entry)}
                            aria-label={`Delete ${item.entry.taskName}`}
                          >
                            <Trash2 aria-hidden className="size-3.5" />
                            Delete
                          </Button>
                        </div>
                      </Card>
                    );
                  })()}
                </li>
              ) : (
                <li>
                  <Card
                    size="sm"
                    className="gap-0 border-l-4 border-l-sky-500 bg-sky-500/[0.04] border-sky-500/20 px-4 py-3 sm:px-5 shadow-xs transition-colors"
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <p className="w-12 shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
                        {formatClock(item.breakItem.startedAt, timeZone)}
                      </p>
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 px-2.5 py-0.5 text-xs font-semibold text-sky-700 dark:text-sky-300 border border-sky-500/20">
                          <Coffee aria-hidden className="size-3 shrink-0" />
                          Break
                        </span>
                        {item.breakItem.endedAt && (
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {formatClock(item.breakItem.startedAt, timeZone)} – {formatClock(item.breakItem.endedAt, timeZone)}
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-0.5">
                        <p className="text-sm font-semibold tabular-nums text-foreground">
                          {item.breakItem.endedAt === null
                            ? "On break"
                            : item.breakItem.durationMinutes !== null
                              ? formatHMM(item.breakItem.durationMinutes)
                              : "—"}
                        </p>
                        {item.breakItem.endedAt !== null && item.breakItem.durationMinutes !== null && (
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {formatHuman(item.breakItem.durationMinutes)}
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1 border-l border-border/50 pl-2 ml-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-foreground"
                          onClick={() => setEditBreak(item.breakItem)}
                          title="Edit break"
                          aria-label="Edit break"
                        >
                          <Pencil aria-hidden className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteBreak(item.breakItem)}
                          title="Delete break"
                          aria-label="Delete break"
                        >
                          <Trash2 aria-hidden className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                </li>
              )}
              </Fragment>
            );
          })}
        </ol>
      )}
        </div>

        {/* Right column: Day Overview Card */}
        <div className="lg:col-span-4 flex flex-col gap-6 lg:sticky lg:top-8">
          <Card className="shadow-xs border-border/80" data-testid="timeline-summary">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold">Day Overview</CardTitle>
                {summary && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {summary.timeEntries.length} {summary.timeEntries.length === 1 ? "task" : "tasks"}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-0.5 rounded-xl border border-border/60 bg-muted/30 p-3 shadow-xs">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Work Time
                  </span>
                  <p className="font-heading text-2xl font-bold tracking-tight text-foreground tabular-nums">
                    {formatHMM(summary?.totals.workMinutes ?? 0)}
                  </p>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatHuman(summary?.totals.workMinutes ?? 0)}
                  </span>
                </div>

                <div className="flex flex-col gap-0.5 rounded-xl border border-border/60 bg-muted/30 p-3 shadow-xs">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Break Time
                  </span>
                  <p className="font-heading text-2xl font-bold tracking-tight text-foreground tabular-nums">
                    {formatHMM(summary?.totals.breakMinutes ?? 0)}
                  </p>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatHuman(summary?.totals.breakMinutes ?? 0)}
                  </span>
                </div>
              </div>

              {/* Attendance */}
              <div className="flex items-center justify-between text-xs py-2 px-3 rounded-lg border border-border/60 bg-muted/20">
                <span className="font-medium text-muted-foreground">Attendance</span>
                <span className="font-semibold text-foreground tabular-nums">
                  {summary?.attendance
                    ? `${formatClock(summary.attendance.clockInAt, timeZone)} → ${
                        summary.attendance.clockOutAt
                          ? formatClock(summary.attendance.clockOutAt, timeZone)
                          : "Open"
                      }`
                    : "No attendance"}
                </span>
              </div>

              {/* Day's Categories */}
              {summary && summary.byCategory.some((c) => c.minutes > 0) ? (
                <div className="flex flex-col gap-2.5 pt-2 border-t border-border/50">
                  <span className="text-xs font-semibold text-foreground">Categories</span>
                  <div className="flex justify-center py-2">
                    <CategoryPieChart
                      categories={summary.byCategory}
                      totalMinutes={summary.totals.workMinutes}
                      size="sm"
                      centerTitle="Day Total"
                      ariaLabel="Day category time distribution pie chart"
                      testId="timeline-category-pie-chart"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    {summary.byCategory
                      .filter((c) => c.minutes > 0)
                      .map((category) => {
                        const theme = getCategoryTheme(category.key);
                        return (
                          <div
                            key={category.key}
                            className="flex items-center justify-between text-xs py-0.5"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                aria-hidden
                                className={cn("size-2 rounded-full shrink-0", theme.dotClass)}
                              />
                              <span className="truncate text-muted-foreground font-medium">
                                {category.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 tabular-nums">
                              <span className="font-semibold text-foreground">
                                {formatHMM(category.minutes)}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                ({formatHuman(category.minutes)})
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : null}

              <Button asChild variant="outline" size="sm" className="w-full mt-1">
                <Link href={`/reports?date=${dayKey}`} className="gap-1.5 text-xs">
                  Review this day
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <EntryDialog
        open={addOpen}
        onOpenChange={(open) => {
          if (!open) {
            setAddPrefill(null);
            setAddInitialKind("entry");
          }
          setAddOpen(open);
        }}
        mode="create"
        dayKey={dayKey}
        timeZone={timeZone}
        categories={categories}
        categoriesError={categoriesError}
        prefill={addPrefill}
        initialKind={addInitialKind}
        onSaved={handleSaved}
      />

      <EntryDialog
        open={editEntry !== null}
        onOpenChange={(open) => {
          if (!open) setEditEntry(null);
        }}
        mode="edit"
        dayKey={dayKey}
        timeZone={timeZone}
        categories={categories}
        categoriesError={categoriesError}
        entry={editEntry}
        initialKind="entry"
        onSaved={handleSaved}
      />

      <EntryDialog
        open={editBreak !== null}
        onOpenChange={(open) => {
          if (!open) setEditBreak(null);
        }}
        mode="edit"
        dayKey={dayKey}
        timeZone={timeZone}
        categories={categories}
        categoriesError={categoriesError}
        breakItem={editBreak}
        initialKind="break"
        onSaved={handleSaved}
      />

      <SplitEntryDialog
        open={splitEntry !== null}
        onOpenChange={(open) => {
          if (!open) setSplitEntry(null);
        }}
        entry={splitEntry}
        dayKey={dayKey}
        timeZone={timeZone}
        categories={categories}
        onSaved={handleSaved}
      />

      <Dialog
        open={deleteEntry !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteEntry(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this entry?</DialogTitle>
            <DialogDescription>
              {deleteEntry
                ? `${deleteEntry.taskName} · ${formatClock(deleteEntry.startedAt, timeZone)}${
                    deleteEntry.endedAt
                      ? ` – ${formatClock(deleteEntry.endedAt, timeZone)}`
                      : ""
                  } will be removed. This cannot be undone.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="h-11 px-4"
              onClick={() => setDeleteEntry(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="h-11 px-5"
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteBreak !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteBreak(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this break?</DialogTitle>
            <DialogDescription>
              {deleteBreak
                ? `Break · ${formatClock(deleteBreak.startedAt, timeZone)}${
                    deleteBreak.endedAt
                      ? ` – ${formatClock(deleteBreak.endedAt, timeZone)}`
                      : ""
                  } will be removed. This cannot be undone.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="h-11 px-4"
              onClick={() => setDeleteBreak(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="h-11 px-5"
              onClick={() => void handleDeleteBreak()}
              disabled={deletingBreak}
            >
              {deletingBreak ? "Deleting…" : "Delete break"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
