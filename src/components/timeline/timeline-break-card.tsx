"use client";

import { Coffee, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatClock } from "@/components/timeline/time";
import { durationLabel, type TimelineItem } from "@/components/timeline/timeline-items";
import { cn } from "@/lib/utils";
import type { BreakDTO } from "@/lib/types";

interface TimelineBreakCardProps {
  item: Extract<TimelineItem, { kind: "break" }>;
  timeZone: string;
  setEditBreak: (breakItem: BreakDTO) => void;
  setDeleteBreak: (breakItem: BreakDTO) => void;
}

export function TimelineBreakCard({
  item,
  timeZone,
  setEditBreak,
  setDeleteBreak,
}: TimelineBreakCardProps) {
  const subMinute =
    item.breakItem.endedAt !== null && item.breakItem.durationMinutes === 0;
  return (
    <Card
      size="sm"
      className={cn(
        "gap-0 border-l-4 border-l-sky-500 bg-sky-500/[0.04] border-sky-500/20 px-4 py-3 sm:px-5 shadow-xs transition-colors min-w-0 w-full overflow-hidden",
        subMinute && "py-1.5 opacity-60",
      )}
    >
      <div className="flex w-full min-w-0 items-center gap-3 sm:gap-4">
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
          <p
            className="text-sm font-semibold tabular-nums text-foreground"
            title={subMinute ? "Break shorter than one minute" : undefined}
          >
            {item.breakItem.endedAt === null
              ? "On break"
              : item.breakItem.durationMinutes !== null
                ? durationLabel(item.breakItem.durationMinutes)
                : "—"}
          </p>
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
  );
}
