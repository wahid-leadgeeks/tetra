"use client";

/**
 * Daily Review (DESIGN.md) — attendance/break/work totals, all 8 category
 * rows, human warnings, review gate, sync preview + sync, sync history.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarRange,
  Clock,
  Download,
  LogOut,
  Pencil,
  TriangleAlert,
  Upload,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CategoryPieChart } from "@/components/ui/category-pie-chart";
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
import {
  formatClock,
  formatDateTime,
  formatDayShort,
} from "@/components/timeline/time";
import { SyncPreviewDialog } from "@/components/reports/sync-preview-dialog";
import { FileSyncDialog } from "@/components/reports/file-sync-dialog";
import { EditAttendanceDialog } from "@/components/timeline/edit-attendance-dialog";
import { getCategoryTheme } from "@/lib/categories";
import { formatHuman } from "@/lib/time";
import { cn } from "@/lib/utils";
import type {
  DaySummaryDTO,
  ReviewState,
  SyncLogDTO,
} from "@/lib/types";

const REVIEW_STATE_LABELS: Record<ReviewState, string> = {
  draft: "Draft",
  ready: "Ready",
  reviewed: "Reviewed",
  synced: "Synced",
  changed_after_sync: "Changed after sync",
};

function ReviewStateBadge({ state }: { state: ReviewState }) {
  switch (state) {
    case "synced":
      return (
        <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
          {REVIEW_STATE_LABELS[state]}
        </Badge>
      );
    case "changed_after_sync":
      return (
        <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400">
          {REVIEW_STATE_LABELS[state]}
        </Badge>
      );
    case "reviewed":
      return <Badge>{REVIEW_STATE_LABELS[state]}</Badge>;
    default:
      return <Badge variant="outline">{REVIEW_STATE_LABELS[state]}</Badge>;
  }
}

function SyncLogStatus({ status }: { status: SyncLogDTO["status"] }) {
  switch (status) {
    case "success":
      return (
        <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
          Success
        </Badge>
      );
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    default:
      return <Badge variant="outline">Pending</Badge>;
  }
}

interface SyncResultDTO {
  status: string;
  changedCells: { a1: string; value: string }[];
  idempotent: boolean;
}

interface ReviewViewProps {
  timeZone: string;
  initialDay: string;
}

export function ReviewView({ timeZone, initialDay }: ReviewViewProps) {
  const router = useRouter();
  const [dayKey, setDayKey] = useState(initialDay);
  const [summary, setSummary] = useState<DaySummaryDTO | null>(null);
  const [logs, setLogs] = useState<SyncLogDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [fileSyncOpen, setFileSyncOpen] = useState(false);
  const [marking, setMarking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [clockingOut, setClockingOut] = useState(false);
  const [clockOutConfirmOpen, setClockOutConfirmOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch<DaySummaryDTO>(`/api/days/${dayKey}`),
      apiFetch<SyncLogDTO[]>(`/api/sync-logs?date=${dayKey}`),
    ])
      .then(([daySummary, syncLogs]) => {
        if (cancelled) return;
        setSummary(daySummary);
        setLogs(syncLogs);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSummary(null);
        setLogs([]);
        setError(err instanceof Error ? err.message : "Could not load the day.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dayKey, fetchKey]);

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

  const canMarkReviewed =
    summary?.reviewState === "draft" ||
    summary?.reviewState === "ready" ||
    summary?.reviewState === "changed_after_sync";

  async function handleQuickClockOut() {
    setClockingOut(true);
    try {
      await apiFetch(`/api/days/${dayKey}/attendance`, {
        method: "POST",
        body: JSON.stringify({ action: "clock_out" }),
      });
      toast.success("Workday closed.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clock out.");
    } finally {
      setClockingOut(false);
    }
  }

  async function handleClockOutAndReview() {
    setClockingOut(true);
    try {
      await apiFetch(`/api/days/${dayKey}/attendance`, {
        method: "POST",
        body: JSON.stringify({ action: "clock_out" }),
      });
      await apiFetch<{ reviewState: ReviewState }>(
        `/api/days/${dayKey}/review`,
        { method: "POST" },
      );
      toast.success("Workday closed and marked reviewed.");
      setClockOutConfirmOpen(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not review.");
    } finally {
      setClockingOut(false);
    }
  }

  async function handleMarkReviewed() {
    if (summary?.attendance && !summary.attendance.clockOutAt) {
      setClockOutConfirmOpen(true);
      return;
    }
    setMarking(true);
    try {
      await apiFetch<{ reviewState: ReviewState }>(
        `/api/days/${dayKey}/review`,
        { method: "POST" },
      );
      toast.success("Marked reviewed.");
      refresh();
    } catch (err) {
      // e.g. "Clock out first" (409) — show the server's human message.
      toast.error(err instanceof Error ? err.message : "Could not review.");
    } finally {
      setMarking(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await apiFetch<SyncResultDTO>(
        `/api/days/${dayKey}/sync`,
        { method: "POST" },
      );
      if (result.idempotent) {
        toast.success("Sheet already up to date — nothing to write.");
      } else {
        toast.success(
          `Synced ${result.changedCells.length} ${
            result.changedCells.length === 1 ? "cell" : "cells"
          } to Google Sheets.`,
        );
      }
      refresh();
    } catch (err) {
      // 400 (not reviewed / not configured / row not found) and 502 (Google
      // failure) both arrive as { error } with a human message.
      toast.error(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncing(false);
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

  const attendance = summary?.attendance ?? null;

  return (
    <div className="w-full">
      <header className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Daily Review
          </h1>
          {summary && <ReviewStateBadge state={summary.reviewState} />}
        </div>
        <DayNavigator
          dayKey={dayKey}
          timeZone={timeZone}
          onChange={handleDayChange}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" className="h-11 px-4">
            <Link
              href={`/reports/week?date=${dayKey}`}
              aria-label="Weekly summary"
              data-testid="week-link"
            >
              <CalendarRange aria-hidden />
              Week
            </Link>
          </Button>
        </div>
      </header>

      <Separator className="my-6" />

      {loading ? (
        <div className="grid gap-3" aria-label="Loading daily review">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl bg-muted"
              aria-hidden
            />
          ))}
        </div>
      ) : error ? (
        <Card className="items-start gap-3 p-6" data-testid="review-error">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TriangleAlert aria-hidden />
            <p>{error}</p>
          </div>
          <Button variant="outline" className="h-11 px-4" onClick={refresh}>
            Try again
          </Button>
        </Card>
      ) : summary ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full min-w-0">
          {/* Left Column: Totals + Category breakdown */}
          <div className="lg:col-span-7 min-w-0 w-full flex flex-col gap-6">
            {/* Totals */}
            <Card data-testid="review-totals" data-tour="review-totals" className="shadow-xs border-border/80">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-bold">{formatDayShort(dayKey)}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                {/* 2-column KPI grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-muted/30 p-4 shadow-xs">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Total Work
                    </p>
                    <p
                      className="font-heading text-3xl font-bold tracking-tight text-foreground tabular-nums"
                      data-testid="review-work-total"
                    >
                      {formatHuman(summary.totals.workMinutes)}
                    </p>
                    <span className="text-[11px] text-muted-foreground">Logged tasks</span>
                  </div>

                  <div className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-muted/30 p-4 shadow-xs">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Total Break
                    </p>
                    <p
                      className="font-heading text-3xl font-bold tracking-tight text-foreground tabular-nums"
                      data-testid="review-break-total"
                    >
                      {formatHuman(summary.totals.breakMinutes)}
                    </p>
                    <span className="text-[11px] text-muted-foreground">Rest & pauses</span>
                  </div>
                </div>

                {/* Attendance row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Attendance
                    </p>
                    {attendance && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] px-1.5 py-0 h-4.5 font-medium",
                          !attendance.clockOutAt
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
                        )}
                      >
                        {!attendance.clockOutAt ? "Open" : "Closed"}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <p
                      className="font-heading text-sm sm:text-base font-semibold tabular-nums text-foreground"
                      data-testid="review-attendance"
                    >
                      {attendance
                        ? `${formatClock(attendance.clockInAt, timeZone)} → ${
                            attendance.clockOutAt
                              ? formatClock(attendance.clockOutAt, timeZone)
                              : "Open"
                          }`
                        : "No attendance recorded"}
                    </p>
                    {attendance && !attendance.clockOutAt && (
                      <Button
                        size="sm"
                        className="h-7 px-2 text-xs font-medium cursor-pointer"
                        onClick={() => void handleQuickClockOut()}
                        disabled={clockingOut}
                        data-testid="review-quick-clockout"
                      >
                        <LogOut className="size-3 mr-1" />
                        {clockingOut ? "Closing…" : "Clock out"}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                      onClick={() => setAttendanceDialogOpen(true)}
                      title={attendance ? "Edit attendance" : "Set attendance"}
                      aria-label="Manage attendance"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Category breakdown — with visual distribution bar and category dots */}
            <Card className="shadow-xs border-border/80">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle>By category</CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {summary.byCategory.filter((c) => c.minutes > 0).length} active of 8 categories
                  </span>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="flex justify-center py-2">
                  <CategoryPieChart
                    categories={summary.byCategory}
                    totalMinutes={summary.totals.workMinutes}
                    size="md"
                    centerTitle="Work Time"
                    ariaLabel="Category time distribution pie chart"
                    testId="review-category-pie-chart"
                  />
                </div>

                <div className="grid gap-2.5">
                  {summary.byCategory.map((category) => {
                    const theme = getCategoryTheme(category.key);
                    const isZero = category.minutes === 0;
                    const pct =
                      summary.totals.workMinutes > 0
                        ? Math.round((category.minutes / summary.totals.workMinutes) * 100)
                        : 0;

                    return (
                      <div
                        key={category.key}
                        className={cn(
                          "flex items-center justify-between gap-4 py-1.5 rounded-md px-2 transition-colors",
                          !isZero && "hover:bg-muted/40",
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            aria-hidden
                            className={cn(
                              "size-2.5 rounded-full shrink-0 transition-opacity",
                              theme.dotClass,
                              isZero && "opacity-30",
                            )}
                          />
                          <p
                            className={cn(
                              "truncate text-sm font-medium",
                              isZero ? "text-muted-foreground/50" : "text-foreground",
                            )}
                          >
                            {category.name}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {!isZero && (
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {pct}%
                            </span>
                          )}
                          <p
                            className={cn(
                              "font-heading tabular-nums text-sm",
                              isZero
                                ? "text-muted-foreground/50"
                                : "font-semibold text-foreground",
                            )}
                          >
                            {formatHuman(category.minutes)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Actions & Sync + Warnings + Sync history */}
          <div className="lg:col-span-5 min-w-0 w-full flex flex-col gap-6">
            {/* Review & Sync Actions Card */}
            <Card className="shadow-xs border-border/80" data-tour="review-sync">
              <CardHeader className="pb-3">
                <CardTitle>Review &amp; Sync</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Mark the day reviewed once numbers look good, then sync to your Google Sheet or export an updated spreadsheet.
                </p>
                <div className="grid gap-2.5 pt-1">
                  <Button
                    className="h-11 w-full font-medium shadow-xs"
                    onClick={() => void handleMarkReviewed()}
                    disabled={!canMarkReviewed || marking}
                    title={
                      canMarkReviewed
                        ? undefined
                        : "This day is already reviewed."
                    }
                    data-testid="review-submit"
                  >
                    {marking ? "Reviewing…" : "Mark reviewed"}
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="h-11 font-medium shadow-xs"
                      onClick={() => setPreviewOpen(true)}
                    >
                      Preview sync
                    </Button>
                    <Button
                      variant="outline"
                      className="h-11 font-medium shadow-xs"
                      onClick={() => setFileSyncOpen(true)}
                      data-testid="sync-file-button"
                      title="No Google account needed — upload the report file, get it back updated"
                    >
                      Sync to file
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="h-11 font-medium shadow-xs"
                      onClick={() => void handlePull()}
                      disabled={pulling}
                      data-testid="pull-button"
                      title="Read IN, OUT, breaks, categories & notes from Google Sheet for this day"
                    >
                      <Download className="mr-1.5 size-4" />
                      {pulling ? "Pulling…" : "Pull from Sheet"}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-11 font-medium shadow-xs"
                      onClick={() => void handleSync()}
                      disabled={syncing}
                      data-testid="sync-button"
                    >
                      <Upload className="mr-1.5 size-4" />
                      {syncing ? "Syncing…" : "Sync to Sheet"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Warnings — human messages, fix path to the Timeline */}
            {summary.warnings.length > 0 && (
              <Card
                className="ring-amber-500/30 border-amber-500/40 bg-amber-500/[0.02] shadow-xs"
                data-testid="review-warnings"
              >
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TriangleAlert
                      aria-hidden
                      className="size-4 text-amber-600 dark:text-amber-400"
                    />
                    Needs attention
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <ul className="grid gap-2">
                    {summary.warnings.map((warning, index) => (
                      <li
                        key={`${warning.type}-${index}`}
                        className="text-xs text-muted-foreground leading-relaxed"
                      >
                        {warning.message}
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {summary.warnings.some((w) => w.type === "missing_clock_out") && (
                      <Button
                        size="sm"
                        className="h-9 px-3 text-xs font-medium cursor-pointer"
                        onClick={() => void handleQuickClockOut()}
                        disabled={clockingOut}
                        data-testid="review-clockout-action"
                      >
                        <LogOut aria-hidden className="size-3.5 mr-1.5" />
                        {clockingOut ? "Closing…" : "Clock out now"}
                      </Button>
                    )}
                    <Button asChild variant="outline" className="h-9 px-3 text-xs font-medium">
                      <Link href={`/timeline?date=${dayKey}`}>
                        <Wrench aria-hidden className="size-3.5 mr-1.5" />
                        Fix issues on Timeline
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sync history */}
            <Card className="shadow-xs border-border/80">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Sync history</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3" data-testid="sync-logs">
                {logs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No sync attempts for this day yet.
                  </p>
                ) : (
                  <ul className="grid gap-3">
                    {logs.map((log) => (
                      <li
                        key={log.id}
                        className="grid gap-1 border-b pb-3 last:border-b-0 last:pb-0"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <SyncLogStatus status={log.status} />
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {formatDateTime(log.createdAt, timeZone)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ·{" "}
                            {log.changedCells.length === 1
                              ? "1 cell"
                              : `${log.changedCells.length} cells`}{" "}
                            written
                          </p>
                        </div>
                        {log.errorMessage && (
                          <p className="text-xs text-destructive">
                            {log.errorMessage}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      <SyncPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        dayKey={dayKey}
        onSynced={refresh}
      />

      <FileSyncDialog
        open={fileSyncOpen}
        onOpenChange={setFileSyncOpen}
        dayKey={dayKey}
        onSynced={refresh}
      />

      {/* Clock out before reviewing confirmation */}
      <Dialog open={clockOutConfirmOpen} onOpenChange={setClockOutConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="size-5 text-primary" />
              Clock out before reviewing?
            </DialogTitle>
            <DialogDescription>
              Your attendance for this day is currently open (
              {attendance ? formatClock(attendance.clockInAt, timeZone) : "08:00"} → Open).
              To review and sync this day, the shift must be closed.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-xs text-muted-foreground leading-relaxed">
            Would you like to clock out now at the end of your activities and mark the day reviewed?
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setClockOutConfirmOpen(false);
                setAttendanceDialogOpen(true);
              }}
            >
              Set Custom Times
            </Button>
            <Button
              onClick={() => void handleClockOutAndReview()}
              disabled={clockingOut}
            >
              {clockingOut ? "Closing…" : "Clock Out & Review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditAttendanceDialog
        open={attendanceDialogOpen}
        onOpenChange={setAttendanceDialogOpen}
        dayKey={dayKey}
        timeZone={timeZone}
        attendance={attendance}
        timeEntries={summary?.timeEntries ?? []}
        onSuccess={refresh}
      />
    </div>
  );
}
