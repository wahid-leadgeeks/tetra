"use client";

/**
 * Daily Review (DESIGN.md) — attendance/break/work totals, all 8 category
 * rows, human warnings, review gate, sync preview + sync, sync history.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TriangleAlert, Wrench, CalendarRange } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { formatHuman } from "@/lib/time";
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

  async function handleMarkReviewed() {
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

  const attendance = summary?.attendance ?? null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
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
        <div className="grid gap-6">
          {/* Totals */}
          <Card data-testid="review-totals">
            <CardHeader>
              <CardTitle>{formatDayShort(dayKey)}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-muted-foreground">Attendance</p>
                <p
                  className="font-heading font-semibold tabular-nums"
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
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-muted-foreground">Break</p>
                <p
                  className="font-heading font-semibold tabular-nums"
                  data-testid="review-break-total"
                >
                  {formatHuman(summary.totals.breakMinutes)}
                </p>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-muted-foreground">Work</p>
                <p
                  className="font-heading font-semibold tabular-nums"
                  data-testid="review-work-total"
                >
                  {formatHuman(summary.totals.workMinutes)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Category breakdown — all 8, zeros dimmed */}
          <Card>
            <CardHeader>
              <CardTitle>By category</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2.5">
              {summary.byCategory.map((category) => (
                <div
                  key={category.key}
                  className="flex items-baseline justify-between gap-4"
                >
                  <p
                    className={
                      category.minutes === 0
                        ? "text-muted-foreground/60"
                        : "text-foreground"
                    }
                  >
                    {category.name}
                  </p>
                  <p
                    className={`font-heading font-medium tabular-nums ${
                      category.minutes === 0
                        ? "text-muted-foreground/60"
                        : "font-semibold"
                    }`}
                  >
                    {formatHuman(category.minutes)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Warnings — human messages, fix path to the Timeline */}
          {summary.warnings.length > 0 && (
            <Card
              className="ring-amber-500/30"
              data-testid="review-warnings"
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
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
                      className="text-sm text-muted-foreground"
                    >
                      {warning.message}
                    </li>
                  ))}
                </ul>
                <Button asChild variant="outline" className="h-11 w-fit px-4">
                  <Link href={`/timeline?date=${dayKey}`}>
                    <Wrench aria-hidden />
                    Fix issues
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Review + sync actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="h-11 px-5"
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
            <Button
              variant="outline"
              className="h-11 px-4"
              onClick={() => setPreviewOpen(true)}
            >
              Preview sync
            </Button>
            <Button
              variant="outline"
              className="h-11 px-4"
              onClick={() => setFileSyncOpen(true)}
              data-testid="sync-file-button"
              title="No Google account needed — upload the report file, get it back updated"
            >
              Sync to file
            </Button>
            <Button
              variant="outline"
              className="h-11 px-4"
              onClick={() => void handleSync()}
              disabled={syncing}
              data-testid="sync-button"
            >
              {syncing ? "Syncing…" : "Sync to Google Sheet"}
            </Button>
          </div>

          {/* Sync history */}
          <Card>
            <CardHeader>
              <CardTitle>Sync history</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3" data-testid="sync-logs">
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
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
                        <p className="text-sm text-muted-foreground tabular-nums">
                          {formatDateTime(log.createdAt, timeZone)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          ·{" "}
                          {log.changedCells.length === 1
                            ? "1 cell"
                            : `${log.changedCells.length} cells`}{" "}
                          written
                        </p>
                      </div>
                      {log.errorMessage && (
                        <p className="text-sm text-destructive">
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
      ) : null}

      <SyncPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        dayKey={dayKey}
      />

      <FileSyncDialog
        open={fileSyncOpen}
        onOpenChange={setFileSyncOpen}
        dayKey={dayKey}
        onSynced={refresh}
      />
    </div>
  );
}
