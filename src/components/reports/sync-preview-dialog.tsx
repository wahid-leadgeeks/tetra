"use client";

/**
 * Sync preview — the exact cells a sync would write (AGENTS.md: always show
 * the user what will be written). Fetched on open; 400s (not reviewed /
 * not configured / row not found) surface as toasts.
 *
 * The body remounts (keyed by day) each time the dialog opens, so state
 * resets without effects.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/components/timeline/api";
import type { SyncPreviewDTO } from "@/lib/types";

interface SyncPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayKey: string;
}

export function SyncPreviewDialog({
  open,
  onOpenChange,
  dayKey,
}: SyncPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && <SyncPreviewBody key={dayKey} dayKey={dayKey} />}
      </DialogContent>
    </Dialog>
  );
}

function SyncPreviewBody({ dayKey }: { dayKey: string }) {
  const [preview, setPreview] = useState<SyncPreviewDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<SyncPreviewDTO>(`/api/days/${dayKey}/sync`)
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Could not load the preview.";
        setError(message);
        toast.error(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dayKey]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Preview sync</DialogTitle>
        <DialogDescription>
          Exactly these cells will be written — nothing else.
        </DialogDescription>
      </DialogHeader>
      <div data-testid="sync-preview">
        {loading ? (
          <div className="grid gap-2" aria-label="Loading preview">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-8 animate-pulse rounded-md bg-muted"
                aria-hidden
              />
            ))}
          </div>
        ) : error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : preview ? (
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              {preview.rowNumber === null ? (
                "No row found for this date in the worksheet."
              ) : (
                <>
                  Worksheet row{" "}
                  <span className="font-medium text-foreground">
                    {preview.rowNumber}
                  </span>
                </>
              )}
            </p>
            <div className="max-h-80 overflow-y-auto rounded-lg ring-1 ring-foreground/10">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Cells that will be written to the Google Sheet
                </caption>
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-muted-foreground">
                    <th scope="col" className="px-3 py-2 font-medium">
                      Column
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Value
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Cell
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {preview.cells.map((cell) => (
                    <tr key={cell.a1} className="border-b last:border-b-0">
                      <td className="px-3 py-2 text-muted-foreground">
                        {cell.columnLabel}
                      </td>
                      <td className="px-3 py-2 font-medium tabular-nums">
                        {cell.value}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                        {cell.a1}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
