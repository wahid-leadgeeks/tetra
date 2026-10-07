"use client";

import { Fragment } from "react";
import { Plus, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { EntryPrefill } from "@/components/timeline/entry-dialog";
import { TimelineBreakCard } from "@/components/timeline/timeline-break-card";
import { TimelineEntryCard } from "@/components/timeline/timeline-entry-card";
import { gapsBetweenItems, interleave } from "@/components/timeline/timeline-items";
import { formatHuman } from "@/lib/time";
import type { BreakDTO, DaySummaryDTO, TimeEntryDTO } from "@/lib/types";

function TimelineSkeleton() {
  return (
    <div className="grid gap-3" aria-hidden data-loading="true">
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

interface TimelineListProps {
  loading: boolean;
  error: string | null;
  summary: DaySummaryDTO | null;
  timeZone: string;
  refresh: () => void;
  openAddDialog: (
    prefill: EntryPrefill | null,
    kind?: "entry" | "break",
  ) => void;
  setSplitEntry: (entry: TimeEntryDTO) => void;
  setEditEntry: (entry: TimeEntryDTO) => void;
  setDeleteEntry: (entry: TimeEntryDTO) => void;
  setTaskEntry: (entry: TimeEntryDTO) => void;
  setEditBreak: (breakItem: BreakDTO) => void;
  setDeleteBreak: (breakItem: BreakDTO) => void;
}

export function TimelineList({
  loading,
  error,
  summary,
  timeZone,
  refresh,
  openAddDialog,
  setSplitEntry,
  setEditEntry,
  setDeleteEntry,
  setTaskEntry,
  setEditBreak,
  setDeleteBreak,
}: TimelineListProps) {
  const items = summary ? interleave(summary) : [];
  const gaps = items.length > 1 ? gapsBetweenItems(items, timeZone) : [];
  const gapAfter = new Map(gaps.map((gap) => [gap.afterIndex, gap]));
  const hasActivity = items.length > 0;

  return loading ? (
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
    <ol className="grid gap-3 min-w-0 w-full" data-testid="timeline">
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
              <li className="flex items-center gap-3 py-1 min-w-0 w-full">
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
            <li className="min-w-0 w-full">
              <TimelineEntryCard
                item={item}
                timeZone={timeZone}
                setSplitEntry={setSplitEntry}
                setEditEntry={setEditEntry}
                setDeleteEntry={setDeleteEntry}
                setTaskEntry={setTaskEntry}
              />
            </li>
          ) : (
            <li className="min-w-0 w-full">
              <TimelineBreakCard
                item={item}
                timeZone={timeZone}
                setEditBreak={setEditBreak}
                setDeleteBreak={setDeleteBreak}
              />
            </li>
          )}
          </Fragment>
        );
      })}
    </ol>
  );
}
