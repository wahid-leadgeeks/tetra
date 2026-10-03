"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatClock } from "@/components/timeline/time";
import type { BreakDTO, TimeEntryDTO } from "@/lib/types";

interface DeleteEntryDialogProps {
  deleteEntry: TimeEntryDTO | null;
  setDeleteEntry: (entry: TimeEntryDTO | null) => void;
  deleting: boolean;
  handleDelete: () => Promise<void>;
  timeZone: string;
}

export function DeleteEntryDialog({
  deleteEntry,
  setDeleteEntry,
  deleting,
  handleDelete,
  timeZone,
}: DeleteEntryDialogProps) {
  return (
    <Dialog
      open={deleteEntry !== null}
      onOpenChange={(open) => {
        if (!open) setDeleteEntry(null);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete this entry?</DialogTitle>
          <DialogDescription className="break-words [overflow-wrap:anywhere]">
            {deleteEntry
              ? `${deleteEntry.taskName} · ${formatClock(deleteEntry.startedAt, timeZone)}${
                  deleteEntry.endedAt
                    ? ` – ${formatClock(deleteEntry.endedAt, timeZone)}`
                    : ""
                } will be removed. This cannot be undone.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            className="h-11 px-4"
            onClick={() => setDeleteEntry(null)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="h-11 px-5"
            onClick={() => void handleDelete()}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteBreakDialogProps {
  deleteBreak: BreakDTO | null;
  setDeleteBreak: (breakItem: BreakDTO | null) => void;
  deletingBreak: boolean;
  handleDeleteBreak: () => Promise<void>;
  timeZone: string;
}

export function DeleteBreakDialog({
  deleteBreak,
  setDeleteBreak,
  deletingBreak,
  handleDeleteBreak,
  timeZone,
}: DeleteBreakDialogProps) {
  return (
    <Dialog
      open={deleteBreak !== null}
      onOpenChange={(open) => {
        if (!open) setDeleteBreak(null);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete this break?</DialogTitle>
          <DialogDescription>
            {deleteBreak
              ? `Break · ${formatClock(deleteBreak.startedAt, timeZone)}${
                  deleteBreak.endedAt
                    ? ` – ${formatClock(deleteBreak.endedAt, timeZone)}`
                    : ""
                } will be removed. This cannot be undone.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            className="h-11 px-4"
            onClick={() => setDeleteBreak(null)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="h-11 px-5"
            onClick={() => void handleDeleteBreak()}
            disabled={deletingBreak}
          >
            {deletingBreak ? "Deleting…" : "Delete break"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
