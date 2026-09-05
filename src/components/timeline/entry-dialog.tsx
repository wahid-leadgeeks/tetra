"use client";

/**
 * Add-missing / edit entry dialog. Times are collected as local "HH:MM"
 * inputs and converted to UTC instants via zonedDayStart + offset — the
 * server stays the authority on durations and overlap validation.
 * ±15m nudges adjust the inputs without typing; `prefill` seeds the gap
 * times when the dialog opens from a "fill this gap" action.
 *
 * The form remounts (keyed) each time the dialog opens, so initial values
 * come straight from props — no reset effects.
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
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/components/timeline/api";
import { isoToTime, timeToISO } from "@/components/timeline/time";
import type { CategoryDTO, TimeEntryDTO } from "@/lib/types";

/** Initial create-mode times, e.g. the exact gap boundaries to backfill. */
export interface EntryPrefill {
  start: string;
  end: string;
}

interface EntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  dayKey: string;
  timeZone: string;
  categories: CategoryDTO[];
  categoriesError?: string | null;
  entry?: TimeEntryDTO | null;
  prefill?: EntryPrefill | null;
  onSaved: () => void;
}

function minutesOf(time: string): number {
  const [h, m] = time.split(":").map((p) => Number.parseInt(p, 10));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/** Shift an "HH:MM" value by whole minutes, clamped to the same day. */
function shiftTime(time: string, deltaMinutes: number): string {
  const total = Math.min(23 * 60 + 59, Math.max(0, minutesOf(time) + deltaMinutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function EntryDialog({
  open,
  onOpenChange,
  mode,
  dayKey,
  timeZone,
  categories,
  categoriesError,
  entry,
  prefill,
  onSaved,
}: EntryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <EntryForm
            key={`${mode}-${entry?.id ?? "new"}-${prefill?.start ?? ""}`}
            mode={mode}
            dayKey={dayKey}
            timeZone={timeZone}
            categories={categories}
            categoriesError={categoriesError}
            entry={entry}
            prefill={prefill}
            onDone={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface EntryFormProps {
  mode: "create" | "edit";
  dayKey: string;
  timeZone: string;
  categories: CategoryDTO[];
  categoriesError?: string | null;
  entry?: TimeEntryDTO | null;
  prefill?: EntryPrefill | null;
  onDone: () => void;
  onSaved: () => void;
}

function EntryForm({
  mode,
  dayKey,
  timeZone,
  categories,
  categoriesError,
  entry,
  prefill,
  onDone,
  onSaved,
}: EntryFormProps) {
  const isEditing = mode === "edit" && entry !== null && entry !== undefined;
  const isRunning = isEditing && entry.status !== "completed";

  const [taskName, setTaskName] = useState(isEditing ? entry.taskName : "");
  const [categoryId, setCategoryId] = useState(
    isEditing ? entry.categoryId : (categories[0]?.id ?? ""),
  );
  const [startTime, setStartTime] = useState(
    isEditing ? isoToTime(entry.startedAt, timeZone) : (prefill?.start ?? ""),
  );
  const [endTime, setEndTime] = useState(
    isEditing && entry.endedAt
      ? isoToTime(entry.endedAt, timeZone)
      : (prefill?.end ?? ""),
  );
  const [notes, setNotes] = useState(isEditing ? (entry.notes ?? "") : "");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate(): string | null {
    if (taskName.trim().length === 0) return "Give the activity a task name.";
    if (!categoryId) return "Choose a category.";
    if (!startTime) return "Choose a start time.";
    if (!endTime && !isRunning) return "Choose an end time.";
    if (endTime && minutesOf(endTime) <= minutesOf(startTime)) {
      return "End time must be after start time.";
    }
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
      if (isEditing && entry) {
        await apiFetch(`/api/time-entries/${entry.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            taskName: taskName.trim(),
            categoryId,
            startedAt: timeToISO(dayKey, startTime, timeZone),
            ...(endTime
              ? { endedAt: timeToISO(dayKey, endTime, timeZone) }
              : {}),
            ...(notes.trim() ? { notes: notes.trim() } : { notes: "" }),
          }),
        });
        toast.success("Entry updated.");
      } else {
        await apiFetch("/api/time-entries", {
          method: "POST",
          body: JSON.stringify({
            startedAt: timeToISO(dayKey, startTime, timeZone),
            endedAt: timeToISO(dayKey, endTime, timeZone),
            taskName: taskName.trim(),
            categoryId,
            ...(notes.trim() ? { notes: notes.trim() } : {}),
          }),
        });
        toast.success("Entry added.");
      }
      onDone();
      onSaved();
    } catch (error) {
      // Overlaps (409) and validation (400) arrive as { error } — show it.
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
        <DialogTitle>
          {mode === "create" ? "Add missing entry" : "Edit entry"}
        </DialogTitle>
        <DialogDescription>
          {mode === "create"
            ? "Record an activity you forgot to track."
            : "Correct the details of this activity."}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="entry-task">Task</Label>
          <Input
            id="entry-task"
            className="h-11"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            placeholder="e.g. Employee Portal API"
            autoComplete="off"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="entry-category">Category</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger id="entry-category" className="h-11 w-full">
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
          {categoriesError && (
            <p className="text-sm text-destructive">{categoriesError}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="entry-start">Start time</Label>
            <Input
              id="entry-start"
              type="time"
              className="h-11"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="entry-end">
              End time{isRunning ? " (optional)" : ""}
            </Label>
            <Input
              id="entry-end"
              type="time"
              className="h-11"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required={!isRunning}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              className="h-11 px-3 text-xs"
              data-testid="start-nudge-minus"
              aria-label="Shift start time 15 minutes earlier"
              disabled={!startTime}
              onClick={() => setStartTime((t) => shiftTime(t, -15))}
            >
              −15m
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11 px-3 text-xs"
              data-testid="start-nudge-plus"
              aria-label="Shift start time 15 minutes later"
              disabled={!startTime}
              onClick={() => setStartTime((t) => shiftTime(t, 15))}
            >
              +15m
            </Button>
          </div>
          <div className="flex items-center justify-end gap-1.5">
            <Button
              type="button"
              variant="ghost"
              className="h-11 px-3 text-xs"
              data-testid="end-nudge-minus"
              aria-label="Shift end time 15 minutes earlier"
              disabled={!endTime}
              onClick={() => setEndTime((t) => shiftTime(t, -15))}
            >
              −15m
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11 px-3 text-xs"
              data-testid="end-nudge-plus"
              aria-label="Shift end time 15 minutes later"
              disabled={!endTime}
              onClick={() => setEndTime((t) => shiftTime(t, 15))}
            >
              +15m
            </Button>
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="entry-notes">Notes (optional)</Label>
          <Textarea
            id="entry-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything worth remembering about this activity"
            rows={2}
          />
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
          >
            Cancel
          </Button>
          <Button type="submit" className="h-11 px-5" disabled={submitting}>
            {submitting
              ? "Saving…"
              : mode === "create"
                ? "Add entry"
                : "Save changes"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
