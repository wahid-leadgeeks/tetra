"use client";

/**
 * File sync dialog — upload the official report (.xlsx/.csv), TETRA writes
 * the reviewed day's mapped cells, and the updated file downloads. Same
 * mapping config and same audit trail as the Google path (ADR-0001: the
 * sheet stays the official report — here the user carries it by hand).
 */
import { useRef, useState } from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
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

const MAX_FILE_BYTES = 5 * 1024 * 1024;

interface FileSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayKey: string;
  onSynced: () => void;
}

export function FileSyncDialog({
  open,
  onOpenChange,
  dayKey,
  onSynced,
}: FileSyncDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setFile(null);
    setBusy(false);
  }

  function handleOpenChange(next: boolean) {
    if (busy) return;
    if (!next) reset();
    onOpenChange(next);
  }

  function pickFile(next: File | null) {
    if (!next) return;
    const name = next.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".csv")) {
      toast.error("Only .xlsx or .csv files are supported.");
      return;
    }
    if (next.size > MAX_FILE_BYTES) {
      toast.error("File is larger than 5 MB.");
      return;
    }
    setFile(next);
  }

  async function handleSync() {
    if (!file) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.set("date", dayKey);
      body.set("file", file);

      const res = await fetch("/api/sync-file", { method: "POST", body });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? `Sync failed (${res.status}).`);
      }

      const idempotent = res.headers.get("X-Sync-Idempotent") === "true";
      const changedCount = Number(
        res.headers.get("X-Sync-Changed-Cells") ?? "0",
      );

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadName(
        res.headers.get("Content-Disposition") ?? file.name,
      );
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      if (idempotent) {
        toast.success("File already up to date — nothing was changed.");
      } else {
        toast.success(
          `Updated ${changedCount} ${
            changedCount === 1 ? "cell" : "cells"
          } — check your downloads.`,
        );
      }
      onSynced();
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "File sync failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sync to a file</DialogTitle>
          <DialogDescription>
            Upload the report workbook (.xlsx or .csv). TETRA writes exactly
            the mapped cells for {dayKey}, then downloads the updated file —
            your file never leaves this round trip.
          </DialogDescription>
        </DialogHeader>

        <div
          role="button"
          tabIndex={0}
          aria-label="Choose a spreadsheet file"
          data-testid="file-drop"
          className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-6 text-center transition-colors hover:border-ring focus-visible:border-ring focus-visible:outline-none"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
        >
          <FileSpreadsheet aria-hidden className="size-8 text-muted-foreground" />
          {file ? (
            <p className="text-sm font-medium" data-testid="file-chosen">
              {file.name}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Click to choose a .xlsx or .csv file, or drag it here.
            </p>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.csv"
            className="sr-only"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <DialogFooter className="mt-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 px-4"
            onClick={() => handleOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-11 px-5"
            onClick={() => void handleSync()}
            disabled={!file || busy}
            data-testid="file-sync-submit"
          >
            {busy ? (
              <>
                <Loader2 aria-hidden className="animate-spin" />
                Syncing…
              </>
            ) : (
              <>
                <Upload aria-hidden />
                Sync to file
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function downloadName(disposition: string | null): string {
  if (disposition) {
    const match = /filename="([^"]+)"/.exec(disposition);
    if (match) return match[1];
  }
  return "report.xlsx";
}
