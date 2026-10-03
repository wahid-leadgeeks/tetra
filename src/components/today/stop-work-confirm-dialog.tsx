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

interface StopWorkConfirmDialogProps {
  stopWorkConfirmOpen: boolean;
  setStopWorkConfirmOpen: (open: boolean) => void;
  onBreak: boolean;
  busy: boolean;
  pending: PendingAction | null;
  clockOut: () => Promise<boolean>;
}

export function StopWorkConfirmDialog({
  stopWorkConfirmOpen,
  setStopWorkConfirmOpen,
  onBreak,
  busy,
  pending,
  clockOut,
}: StopWorkConfirmDialogProps) {
  return (
    <Dialog
      open={stopWorkConfirmOpen}
      onOpenChange={setStopWorkConfirmOpen}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stop work for today?</DialogTitle>
          <DialogDescription>
            {onBreak
              ? "Your open break ends now and your attendance closes for the day."
              : "Your attendance closes for the day. You can still review everything on the Timeline."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => setStopWorkConfirmOpen(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="h-11"
            data-testid="clock-out-confirm"
            disabled={busy}
            onClick={() => {
              setStopWorkConfirmOpen(false);
              void clockOut();
            }}
          >
            {pending === "clock-out" ? (
              <Loader2 aria-hidden className="animate-spin" />
            ) : null}
            Stop Work
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
