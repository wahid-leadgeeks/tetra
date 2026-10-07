"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ClipboardList } from "lucide-react";

import { cn } from "@/lib/utils";

const COLLAPSE_THRESHOLD = 160;

interface TaskNotesProps {
  text: string;
  /**
   * `clamp`: 2-line clamp with a "More" control that calls `onOpen` (opens the task dialog).
   * `collapsible`: expands inline (Timeline cards).
   */
  variant: "clamp" | "collapsible";
  onOpen?: () => void;
  /** Line clamp for the `clamp` variant (default 2). */
  clampLines?: 1 | 2;
  className?: string;
}

/** Task description ("Notes") block. */
export function TaskNotes({ text, variant, onOpen, clampLines = 2, className }: TaskNotesProps) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > COLLAPSE_THRESHOLD || text.includes("\n");

  return (
    <div
      data-testid="task-notes"
      className={cn(
        "rounded-lg border border-border/60 bg-muted/30 dark:bg-muted/20 px-3 py-2 text-xs",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground/85 mb-1 select-none">
        <ClipboardList className="size-3 text-muted-foreground/70 shrink-0" aria-hidden />
        <span>Notes</span>
      </div>
      <p
        className={cn(
          "text-foreground/90 leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
          variant === "clamp" && (clampLines === 1 ? "line-clamp-1" : "line-clamp-2"),
          variant === "collapsible" && !expanded && isLong && "line-clamp-3",
        )}
      >
        {text}
      </p>
      {variant === "clamp" && onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="mt-1 text-[11px] font-medium text-primary hover:underline cursor-pointer select-none"
        >
          More
        </button>
      ) : null}
      {variant === "collapsible" && isLong ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline cursor-pointer select-none"
        >
          <span>{expanded ? "Show less" : "Show full notes"}</span>
          {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        </button>
      ) : null}
    </div>
  );
}
