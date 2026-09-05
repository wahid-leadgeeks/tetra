"use client";

/**
 * Split entry dialog (DESIGN.md "Split entry"): pick the split time on a
 * completed entry and optionally reassign the second segment to another
 * task/category. The first segment keeps the original entry; the server
 * re-validates overlaps and preserves the total duration.
 */
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/components/timeline/api";
import { formatClock, isoToTime, timeToISO } from "@/components/timeline/time";
import type { CategoryDTO, TimeEntryDTO } from "@/lib/types";

interface SplitEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: TimeEntryDTO | null;
  dayKey: string;
  timeZone: string;
  categories: CategoryDTO[];
  onSaved: () => void;
}

function minutesOf(time: string): number {
  const [h, m] = time.split(":").map((p) => Number.parseInt(p, 10));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

export function SplitEntryDialog({
  open,
  onOpenChange,
  entry,
  dayKey,
  timeZone,
  categories,
  onSaved,
}: SplitEntryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && entry ? (
          <SplitEntryForm
            key={entry.id}
            entry={entry}
            dayKey={dayKey}
            timeZone={timeZone}
            categories={categories}
            onDone={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SplitEntryForm({
  entry,
  dayKey,
  timeZone,
  categories,
  onDone,
  onSaved,
}: {
  entry: TimeEntryDTO;
  dayKey: string;
  timeZone: string;
  categories: CategoryDTO[];
  onDone: () => void;
  onSaved: () => void;
}) {
  const startClock = isoToTime(entry.startedAt, timeZone);
  const endClock = entry.endedAt ? isoToTime(entry.endedAt, timeZone) : "";
  const midpointClock = entry.endedAt
    ? isoToTime(
        new Date(
          (Date.parse(entry.startedAt) + Date.parse(entry.endedAt)) / 2,
        ).toISOString(),
        timeZone,
      )
    : "";

  const [splitTime, setSplitTime] = useState(midpointClock);
  const [taskName, setTaskName] = useState(entry.taskName);
  const [categoryId, setCategoryId] = useState(entry.categoryId);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate(): string | null {
    if (!splitTime) return "Choose a split time.";
    if (minutesOf(splitTime) <= minutesOf(startClock)) {
      return "Split time must be after the start time.";
    }
    if (endClock && minutesOf(splitTime) >= minutesOf(endClock)) {
      return "Split time must be before the end time.";
    }
    if (taskName.trim().length === 0) return "Give the second part a task name.";
    if (!categoryId) return "Choose a category.";
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const invalid = validate();
    if (invalid) {
      setFieldError(invalid);
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch(`/api/time-entries/${entry.id}/split`, {
        method: "POST",
        body: JSON.stringify({
          splitAt: timeToISO(dayKey, splitTime, timeZone),
          secondTaskName: taskName.trim(),
          secondCategoryId: categoryId,
        }),
      });
      toast.success("Entry split into two.");
      onDone();
      onSaved();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Split this entry?</DialogTitle>
        <DialogDescription>
          {entry.taskName} runs {formatClock(entry.startedAt, timeZone)}
          {endClock ? ` → ${endClock}` : ""}. It becomes two consecutive
          entries at the split time — the first keeps its details, the second
          can be reassigned below.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="split-time">Split time</Label>
          <Input
            id="split-time"
            type="time"
            className="h-11"
            data-testid="split-time-input"
            value={splitTime}
            onChange={(e) => setSplitTime(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="split-task">Second part&apos;s task</Label>
          <Input
            id="split-task"
            className="h-11"
            data-testid="split-task-input"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            required
            maxLength={200}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="split-category">Second part&apos;s category</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger id="split-category" className="h-11 w-full">
              <SelectValue placeholder="Choose a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {fieldError && (
          <p role="alert" className="text-sm text-destructive">
            {fieldError}
          </p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="h-11 px-4"
            onClick={onDone}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="h-11 px-5"
            data-testid="split-submit"
            disabled={submitting}
          >
            {submitting ? "Splitting…" : "Split entry"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
