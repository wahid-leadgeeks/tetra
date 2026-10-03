"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PendingAction } from "@/components/today/use-today-state";
import type { TimeEntryDTO } from "@/lib/types";

interface StopTaskConfirmDialogProps {
  stopTaskConfirmOpen: boolean;
  setStopTaskConfirmOpen: (open: boolean) => void;
  activeEntry: TimeEntryDTO | null;
  busy: boolean;
  pending: PendingAction | null;
  stopTask: () => Promise<boolean>;
}

export function StopTaskConfirmDialog({
  stopTaskConfirmOpen,
  setStopTaskConfirmOpen,
  activeEntry,
  busy,
  pending,
  stopTask,
}: StopTaskConfirmDialogProps) {
  return (
    <Dialog
      open={stopTaskConfirmOpen}
      onOpenChange={setStopTaskConfirmOpen}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stop current task?</DialogTitle>
          <DialogDescription>
            {activeEntry ? (
              <>
                Stop tracking{" "}
                <span className="font-semibold text-foreground">
                  {activeEntry.taskName}
                </span>
                ? This will record your elapsed time and finalize this entry
                on today&apos;s timeline.
              </>
            ) : (
              "This will end tracking for the current task."
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => setStopTaskConfirmOpen(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-11"
            data-testid="stop-task-confirm"
            disabled={busy}
            onClick={() => {
              setStopTaskConfirmOpen(false);
              void stopTask();
            }}
          >
            {pending === "stop-task" ? (
              <Loader2 aria-hidden className="animate-spin" />
            ) : null}
            Stop Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
