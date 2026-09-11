"use client";

import { useMemo, useState } from "react";
import { Clock, LogOut, Sparkles } from "lucide-react";
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
import { apiFetch } from "@/components/timeline/api";
import { isoToTime, timeToISO } from "@/components/timeline/time";
import type { AttendanceDTO, TimeEntryDTO } from "@/lib/types";

interface EditAttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayKey: string;
  timeZone: string;
  attendance: AttendanceDTO | null;
  timeEntries?: TimeEntryDTO[];
  onSuccess: () => void;
}

/** Formats ISO timestamp to HH:mm string in the given timezone. */
function toClockInput(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "";
  return isoToTime(iso, timeZone);
}

interface AttendanceFormProps {
  dayKey: string;
  timeZone: string;
  attendance: AttendanceDTO | null;
  timeEntries: TimeEntryDTO[];
  onDone: () => void;
  onSuccess: () => void;
}

function AttendanceForm({
  dayKey,
  timeZone,
  attendance,
  timeEntries,
  onDone,
  onSuccess,
}: AttendanceFormProps) {
  // Find task boundaries for quick preset
  const taskBounds = useMemo(() => {
    if (!timeEntries || timeEntries.length === 0) return null;
    let minStart = timeEntries[0]?.startedAt;
    let maxEnd = timeEntries[0]?.endedAt;

    for (const entry of timeEntries) {
      if (entry.startedAt < minStart) minStart = entry.startedAt;
      if (entry.endedAt && (!maxEnd || entry.endedAt > maxEnd)) {
        maxEnd = entry.endedAt;
      }
    }
    return {
      startClock: minStart ? toClockInput(minStart, timeZone) : "08:00",
      endClock: maxEnd ? toClockInput(maxEnd, timeZone) : null,
    };
  }, [timeEntries, timeZone]);

  const initialClockIn = useMemo(() => {
    if (attendance?.clockInAt) return toClockInput(attendance.clockInAt, timeZone) || "08:00";
    return taskBounds?.startClock || "08:00";
  }, [attendance, taskBounds, timeZone]);

  const initialIsClosed = Boolean(attendance?.clockOutAt || !attendance);

  const initialClockOut = useMemo(() => {
    if (attendance?.clockOutAt) return toClockInput(attendance.clockOutAt, timeZone);
    const nowClock = toClockInput(new Date().toISOString(), timeZone);
    return taskBounds?.endClock || nowClock || "17:00";
  }, [attendance, taskBounds, timeZone]);

  const [clockIn, setClockIn] = useState<string>(initialClockIn);
  const [clockOut, setClockOut] = useState<string>(initialClockOut);
  const [isClosed, setIsClosed] = useState<boolean>(initialIsClosed);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleApplyTaskBounds = () => {
    if (taskBounds?.startClock) setClockIn(taskBounds.startClock);
    if (taskBounds?.endClock) {
      setClockOut(taskBounds.endClock);
      setIsClosed(true);
    }
  };

  const handleApplyNow = () => {
    const nowClock = toClockInput(new Date().toISOString(), timeZone);
    setClockOut(nowClock);
    setIsClosed(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clockIn) {
      toast.error("Please enter a clock-in time.");
      return;
    }
    if (isClosed && !clockOut) {
      toast.error("Please enter a clock-out time.");
      return;
    }

    setSubmitting(true);
    try {
      const clockInIso = timeToISO(dayKey, clockIn, timeZone);
      const clockOutIso = isClosed
        ? timeToISO(dayKey, clockOut, timeZone)
        : null;

      await apiFetch(`/api/days/${dayKey}/attendance`, {
        method: "POST",
        body: JSON.stringify({
          action: isClosed ? "clock_out" : "update",
          clockInAt: clockInIso,
          clockOutAt: clockOutIso,
          status: isClosed ? "closed" : "open",
        }),
      });

      toast.success(
        isClosed
          ? `Workday closed (${clockIn} → ${clockOut}).`
          : `Attendance updated (${clockIn} → Open).`,
      );
      onDone();
      onSuccess();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update attendance.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Clock className="size-5 text-primary" />
          Manage Attendance
        </DialogTitle>
        <DialogDescription>
          Set workday clock-in and clock-out hours for {dayKey}.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        {/* Quick presets */}
        <div className="flex flex-wrap items-center gap-2">
          {taskBounds?.endClock && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleApplyTaskBounds}
              className="h-8 text-xs gap-1.5 cursor-pointer"
            >
              <Sparkles className="size-3.5 text-primary" />
              Fit to tasks ({taskBounds.startClock} – {taskBounds.endClock})
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleApplyNow}
            className="h-8 text-xs gap-1.5 cursor-pointer"
          >
            <LogOut className="size-3.5" />
            Clock out now
          </Button>
        </div>

        {/* Shift status toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border/70 p-3 bg-muted/20">
          <div>
            <Label className="text-xs font-semibold">Shift Status</Label>
            <p className="text-[11px] text-muted-foreground">
              {isClosed
                ? "Work completed (Shift closed)"
                : "Work in progress (Attendance remains open)"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-background rounded-md p-1 border border-border/70">
            <button
              type="button"
              onClick={() => setIsClosed(false)}
              className={`px-2.5 py-1 text-xs rounded font-medium cursor-pointer transition-colors ${
                !isClosed
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Open
            </button>
            <button
              type="button"
              onClick={() => setIsClosed(true)}
              className={`px-2.5 py-1 text-xs rounded font-medium cursor-pointer transition-colors ${
                isClosed
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Closed
            </button>
          </div>
        </div>

        {/* Time inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="clockInTime" className="text-xs">
              Clock In (IN)
            </Label>
            <Input
              id="clockInTime"
              type="time"
              required
              value={clockIn}
              onChange={(e) => setClockIn(e.target.value)}
              className="h-10 text-sm font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="clockOutTime" className="text-xs">
              Clock Out (OUT)
            </Label>
            <Input
              id="clockOutTime"
              type="time"
              disabled={!isClosed}
              required={isClosed}
              value={clockOut}
              onChange={(e) => setClockOut(e.target.value)}
              className="h-10 text-sm font-mono disabled:opacity-50"
            />
          </div>
        </div>
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button
          type="button"
          variant="outline"
          onClick={onDone}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save Attendance"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function EditAttendanceDialog({
  open,
  onOpenChange,
  dayKey,
  timeZone,
  attendance,
  timeEntries = [],
  onSuccess,
}: EditAttendanceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <AttendanceForm
            key={`${dayKey}-${attendance?.clockInAt ?? "none"}-${attendance?.clockOutAt ?? "open"}`}
            dayKey={dayKey}
            timeZone={timeZone}
            attendance={attendance}
            timeEntries={timeEntries}
            onDone={() => onOpenChange(false)}
            onSuccess={onSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
