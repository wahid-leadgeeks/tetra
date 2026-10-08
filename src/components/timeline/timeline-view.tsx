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
import { useEffect, useState } from "react";
import { Coffee, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { apiFetch } from "@/components/timeline/api";
import { syncDayToSheet } from "@/lib/auto-sync";
import { CalendarScheduleCard } from "@/components/calendar/calendar-schedule-card";
import { DayNavigator } from "@/components/timeline/day-navigator";
import { DayOverviewCard } from "@/components/timeline/day-overview-card";
import { EditAttendanceDialog } from "@/components/timeline/edit-attendance-dialog";
import { EntryDialog, type EntryPrefill } from "@/components/timeline/entry-dialog";
import { EntryTaskDialog } from "@/components/tasks/entry-task-dialog";
import { SplitEntryDialog } from "@/components/timeline/split-entry-dialog";
import {
  DeleteBreakDialog,
  DeleteEntryDialog,
} from "@/components/timeline/timeline-delete-dialogs";
import { TimelineList } from "@/components/timeline/timeline-list";
import { useTimelineDay } from "@/components/timeline/use-timeline-day";
import { formatHuman } from "@/lib/time";
import type { BreakDTO, TimeEntryDTO } from "@/lib/types";

interface TimelineViewProps {
  timeZone: string;
  initialDay: string;
}

export function TimelineView({ timeZone, initialDay }: TimelineViewProps) {
  const {
    dayKey,
    summary,
    loading,
    error,
    categories,
    categoriesError,
    handleDayChange,
    markSyncedLocally,
    refresh,
  } = useTimelineDay(initialDay);

  const [addOpen, setAddOpen] = useState(false);
  const [addPrefill, setAddPrefill] = useState<EntryPrefill | null>(null);
  const [addInitialKind, setAddInitialKind] = useState<"entry" | "break">("entry");
  const [editEntry, setEditEntry] = useState<TimeEntryDTO | null>(null);
  const [splitEntry, setSplitEntry] = useState<TimeEntryDTO | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<TimeEntryDTO | null>(null);
  const [taskEntry, setTaskEntry] = useState<TimeEntryDTO | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editBreak, setEditBreak] = useState<BreakDTO | null>(null);
  const [deleteBreak, setDeleteBreak] = useState<BreakDTO | null>(null);
  const [deletingBreak, setDeletingBreak] = useState(false);
  const [autoSyncTasks, setAutoSyncTasks] = useState(true);
  const [syncConfigured, setSyncConfigured] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [clockingOut, setClockingOut] = useState(false);

  async function handleQuickClockOut() {
    setClockingOut(true);
    try {
      await apiFetch(`/api/days/${dayKey}/attendance`, {
        method: "POST",
        body: JSON.stringify({ action: "clock_out" }),
      });
      toast.success("Workday closed.");
      refresh();
      if (autoSyncTasks && syncConfigured) {
        void syncTasksBackground();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clock out.");
    } finally {
      setClockingOut(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    apiFetch<{
      id?: string;
      spreadsheetId?: string;
      mapping?: { autoSyncTasks?: boolean };
    } | null>("/api/sync-config")
      .then((config) => {
        if (cancelled) return;
        setSyncConfigured(
          config !== null &&
            config !== undefined &&
            typeof config.id === "string" &&
            config.spreadsheetId !== "file",
        );
        if (config?.mapping?.autoSyncTasks !== undefined) {
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

  async function syncTasksBackground() {
    const syncedDay = dayKey;
    await syncDayToSheet(syncedDay, {
      auto: true,
      successMessage: (n) => `Auto-synced to Google Sheet (${n} cells)`,
      onSuccess: () => markSyncedLocally(syncedDay),
    });
  }

  async function handleSyncNow() {
    setSyncing(true);
    try {
      const res = await syncDayToSheet(dayKey, {
        notifyIdempotent: true,
        successMessage: (n) =>
          `Synced to Google Sheet (${n} ${n === 1 ? "cell" : "cells"})`,
      });
      if (res) refresh();
    } finally {
      setSyncing(false);
    }
  }

  function handleSaved() {
    refresh();
    if (autoSyncTasks && syncConfigured) {
      void syncTasksBackground();
    }
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
      if (autoSyncTasks && syncConfigured) {
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
      if (autoSyncTasks && syncConfigured) {
        void syncTasksBackground();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete break.");
    } finally {
      setDeletingBreak(false);
    }
  }

  function openAddDialog(
    prefill: EntryPrefill | null,
    kind: "entry" | "break" = "entry",
  ) {
    setAddPrefill(prefill);
    setAddInitialKind(kind);
    setAddOpen(true);
  }

  return (
    <div className="w-full min-w-0">
      <header className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Timeline
          </h1>
          <div className="flex flex-wrap items-center gap-2">
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
              {formatHuman(summary.totals.workMinutes)}
            </span>{" "}
            · Break{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatHuman(summary.totals.breakMinutes)}
            </span>{" "}
            · {summary.timeEntries.length}{" "}
            {summary.timeEntries.length === 1 ? "activity" : "activities"}
          </p>
        )}
      </header>

      <Separator className="my-6" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full min-w-0">
        {/* Main timeline column */}
        <div className="lg:col-span-8 min-w-0 w-full flex flex-col gap-6" data-tour="timeline-main">
          <TimelineList
            loading={loading}
            error={error}
            summary={summary}
            timeZone={timeZone}
            refresh={refresh}
            openAddDialog={openAddDialog}
            setSplitEntry={setSplitEntry}
            setEditEntry={setEditEntry}
            setDeleteEntry={setDeleteEntry}
            setTaskEntry={setTaskEntry}
            setEditBreak={setEditBreak}
            setDeleteBreak={setDeleteBreak}
          />
        </div>

        {/* Right column: Day Overview Card */}
        <div className="lg:col-span-4 min-w-0 w-full flex flex-col gap-6 lg:sticky lg:top-8">
          <DayOverviewCard
            summary={summary}
            timeZone={timeZone}
            dayKey={dayKey}
            clockingOut={clockingOut}
            handleQuickClockOut={handleQuickClockOut}
            setAttendanceDialogOpen={setAttendanceDialogOpen}
            needsSync={syncConfigured && (summary?.needsSync ?? false)}
            syncing={syncing}
            onSyncNow={handleSyncNow}
          />
          <div data-testid="timeline-schedule-card">
            <CalendarScheduleCard
              key={dayKey}
              timezone={timeZone}
              dayKey={dayKey}
              title="Schedule"
              emptyMessage="No calendar events found for this day."
              syncAfterImport={false}
              onImportSuccess={(r) => {
                if (r.importedCount > 0) handleSaved();
                else refresh();
              }}
            />
          </div>
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

      <EntryTaskDialog
        entry={taskEntry}
        categories={categories}
        onOpenChange={(o) => {
          if (!o) setTaskEntry(null);
        }}
        onSaved={() => {
          setTaskEntry(null);
          refresh();
        }}
      />

      <DeleteEntryDialog
        deleteEntry={deleteEntry}
        setDeleteEntry={setDeleteEntry}
        deleting={deleting}
        handleDelete={handleDelete}
        timeZone={timeZone}
      />

      <DeleteBreakDialog
        deleteBreak={deleteBreak}
        setDeleteBreak={setDeleteBreak}
        deletingBreak={deletingBreak}
        handleDeleteBreak={handleDeleteBreak}
        timeZone={timeZone}
      />

      <EditAttendanceDialog
        open={attendanceDialogOpen}
        onOpenChange={setAttendanceDialogOpen}
        dayKey={dayKey}
        timeZone={timeZone}
        attendance={summary?.attendance ?? null}
        timeEntries={summary?.timeEntries ?? []}
        onSuccess={refresh}
      />
    </div>
  );
}
