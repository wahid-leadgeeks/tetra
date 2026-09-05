"use client";

/**
 * Sync preview — the exact cells a sync would write (AGENTS.md: always show
 * the user what will be written). Fetched on open; 400s (not reviewed /
 * not configured / row not found) surface as toasts.
 *
 * Compiled category notes render as an editable section with an include
 * toggle (default on). "Sync to Google Sheet" executes the sync with exactly
 * the choices made here — notes are only written when the toggle is on, and
 * an edited note replaces the compiled text.
 *
 * The body remounts (keyed by day) each time the dialog opens, so state
 * resets without effects.
 */
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { apiFetch } from "@/components/timeline/api";
import type { SyncCellDTO, SyncPreviewDTO } from "@/lib/types";

interface SyncPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayKey: string;
  /** Called after a sync started from this dialog succeeded. */
  onSynced?: () => void;
}

interface SyncResultDTO {
  status: string;
  changedCells: { a1: string; value: string }[];
  idempotent: boolean;
}

export function SyncPreviewDialog({
  open,
  onOpenChange,
  dayKey,
  onSynced,
}: SyncPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && (
          <SyncPreviewBody
            key={dayKey}
            dayKey={dayKey}
            onClose={() => onOpenChange(false)}
            onSynced={onSynced}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SyncPreviewBody({
  dayKey,
  onClose,
  onSynced,
}: {
  dayKey: string;
  onClose: () => void;
  onSynced?: () => void;
}) {
  const [preview, setPreview] = useState<SyncPreviewDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [noteValues, setNoteValues] = useState<Record<string, string>>({});
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<SyncPreviewDTO>(`/api/days/${dayKey}/sync`)
      .then((data) => {
        if (cancelled) return;
        setPreview(data);
        const initial: Record<string, string> = {};
        for (const cell of data.cells) {
          if (cell.cellType === "notes" && cell.categoryKey) {
            initial[cell.categoryKey] = cell.value;
          }
        }
        setNoteValues(initial);
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

  const valueCells: SyncCellDTO[] =
    preview?.cells.filter((cell) => cell.cellType !== "notes") ?? [];
  const notesCells: SyncCellDTO[] =
    preview?.cells.filter((cell) => cell.cellType === "notes") ?? [];
  const canSync = preview !== null && preview.rowNumber !== null;

  async function handleSync() {
    if (!canSync) return;
    setSyncing(true);
    try {
      const result = await apiFetch<SyncResultDTO>(`/api/days/${dayKey}/sync`, {
        method: "POST",
        body: JSON.stringify(
          includeNotes
            ? { includeNotes: true, notes: noteValues }
            : { includeNotes: false },
        ),
      });
      if (result.idempotent) {
        toast.success("Sheet already up to date — nothing to write.");
      } else {
        toast.success(
          `Synced ${result.changedCells.length} ${
            result.changedCells.length === 1 ? "cell" : "cells"
          } to Google Sheets.`,
        );
      }
      onSynced?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

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
          <div className="grid gap-4">
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
                  {valueCells.map((cell) => (
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

            {notesCells.length > 0 ? (
              <section
                aria-labelledby="sync-notes-heading"
                className="grid gap-3"
              >
                <label
                  className="flex cursor-pointer items-center gap-3 text-sm"
                  data-testid="sync-notes-toggle"
                >
                  <input
                    type="checkbox"
                    className="size-5 accent-primary"
                    checked={includeNotes}
                    onChange={(e) => setIncludeNotes(e.target.checked)}
                  />
                  <span id="sync-notes-heading">
                    Include category notes in sync{" "}
                    <span className="text-muted-foreground">
                      (columns I, K, M, O, Q, S, U, W)
                    </span>
                  </span>
                </label>
                {includeNotes ? (
                  <div className="grid gap-3">
                    <p className="text-sm text-muted-foreground">
                      Each block is written to its notes column. Edit the text
                      before syncing — an emptied block is skipped, so manual
                      notes in the sheet are never blanked.
                    </p>
                    {notesCells.map((cell) => (
                      <div key={cell.a1} className="grid gap-1.5">
                        <label
                          htmlFor={`sync-notes-${cell.categoryKey}`}
                          className="text-sm font-medium"
                        >
                          {cell.columnLabel}{" "}
                          <span className="font-mono text-xs text-muted-foreground">
                            {cell.a1}
                          </span>
                        </label>
                        <textarea
                          id={`sync-notes-${cell.categoryKey}`}
                          data-testid={`sync-notes-input-${cell.categoryKey}`}
                          className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50"
                          rows={4}
                          value={noteValues[cell.categoryKey ?? ""] ?? ""}
                          onChange={(e) =>
                            setNoteValues((prev) => ({
                              ...prev,
                              [cell.categoryKey ?? ""]: e.target.value,
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
      {!loading && !error && canSync ? (
        <DialogFooter className="mt-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 px-4"
            onClick={onClose}
            disabled={syncing}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-11 px-5"
            data-testid="sync-now"
            disabled={syncing}
            onClick={() => void handleSync()}
          >
            {syncing ? (
              <Loader2 aria-hidden className="animate-spin" />
            ) : null}
            Sync to Google Sheet
          </Button>
        </DialogFooter>
      ) : null}
    </>
  );
}
