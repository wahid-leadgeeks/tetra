"use client";

import { useState, type ComponentType } from "react";
import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileText,
  ListChecks,
  Pencil,
  Scissors,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TaskMetaBadges } from "@/components/tasks/task-meta-badges";
import { CategoryBadge } from "@/components/ui/category-badge";
import { formatClock } from "@/components/timeline/time";
import type { TimelineItem } from "@/components/timeline/timeline-items";
import { getCategoryTheme } from "@/lib/categories";
import { durationLabel } from "@/components/timeline/timeline-items";
import type { TimeEntryDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

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

function CollapsibleText({
  label,
  icon: Icon,
  text,
  expandLabel,
  testId,
}: {
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  text: string;
  expandLabel: string;
  testId?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 160 || (text.match(/\n/g) || []).length >= 2;

  return (
    <div
      data-testid={testId}
      className="mt-2.5 rounded-lg border border-border/60 bg-muted/30 dark:bg-muted/20 px-3.5 py-2.5 text-xs sm:text-sm transition-colors"
    >
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground/85 mb-1 select-none">
        <Icon className="size-3 text-muted-foreground/70 shrink-0" aria-hidden />
        <span>{label}</span>
      </div>
      <p
        className={cn(
          "text-foreground/90 leading-relaxed font-normal whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
          !expanded && isLong && "line-clamp-3",
        )}
      >
        {text}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline cursor-pointer select-none"
        >
          {expanded ? (
            <>
              <span>Show less</span>
              <ChevronUp className="size-3" />
            </>
          ) : (
            <>
              <span>{expandLabel}</span>
              <ChevronDown className="size-3" />
            </>
          )}
        </button>
      )}
    </div>
  );
}

interface TimelineEntryCardProps {
  item: Extract<TimelineItem, { kind: "entry" }>;
  timeZone: string;
  setSplitEntry: (entry: TimeEntryDTO) => void;
  setEditEntry: (entry: TimeEntryDTO) => void;
  setDeleteEntry: (entry: TimeEntryDTO) => void;
  setTaskEntry: (entry: TimeEntryDTO) => void;
}

export function TimelineEntryCard({
  item,
  timeZone,
  setSplitEntry,
  setEditEntry,
  setDeleteEntry,
  setTaskEntry,
}: TimelineEntryCardProps) {
  const theme = getCategoryTheme(
    item.entry.categoryKey || item.entry.categoryName,
  );
  return (
    <Card
      size="sm"
      className={cn(
        "gap-0 border-l-4 px-4 py-4 sm:px-5 shadow-xs transition-colors min-w-0 w-full overflow-hidden",
        theme.borderClass,
      )}
    >
      <div className="flex w-full min-w-0 items-start gap-3 sm:gap-4">
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
          <p className="font-heading text-base font-semibold text-foreground break-words [overflow-wrap:anywhere]">
            {item.entry.taskName}
          </p>
          <TaskMetaBadges details={item.entry.taskDetails} timezone={timeZone} />
          {item.entry.taskDetails?.description ? (
            <CollapsibleText
              label="Notes"
              icon={ClipboardList}
              text={item.entry.taskDetails.description}
              expandLabel="Show full notes"
              testId="task-notes"
            />
          ) : null}
          {item.entry.notes && (
            <CollapsibleText
              label="Entry notes"
              icon={FileText}
              text={item.entry.notes}
              expandLabel="Show full notes"
            />
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          {item.entry.status === "completed" ? (
            <>
              <p className="font-heading text-base font-semibold tabular-nums text-foreground">
                {item.entry.durationMinutes !== null
                  ? durationLabel(item.entry.durationMinutes)
                  : "—"}
              </p>
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
        {item.entry.taskDetails ? (
          <Button
            variant="ghost"
            className="h-10 px-3 text-xs"
            onClick={() => setTaskEntry(item.entry)}
            aria-label={`Open task details for ${item.entry.taskName}`}
            data-testid="open-task-details"
          >
            <ListChecks aria-hidden className="size-3.5" />
            Task
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
}
