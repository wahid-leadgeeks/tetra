"use client";

import { useState } from "react";
import { AlertCircle, Calendar, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CalendarEventSuggestionDTO } from "@/features/calendar-sync/types";
import { CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/utils";

interface ImportCalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: CalendarEventSuggestionDTO[];
  onImportSuccess: () => void;
}

interface EditableEventItem {
  id: string;
  selected: boolean;
  title: string;
  categoryKey: string;
  startedAt: string;
  endedAt: string;
  notes: string | null;
  formattedClock: string;
  durationMinutes: number;
  hasOverlap: boolean;
  overlappingTaskNames: string[];
}

export function ImportCalendarDialog({
  open,
  onOpenChange,
  events,
  onImportSuccess,
}: ImportCalendarDialogProps) {
  const [items, setItems] = useState<EditableEventItem[]>(() =>
    events.map((e) => ({
      id: e.id,
      selected: !e.hasOverlap, // uncheck if overlapping by default so user reviews carefully
      title: e.title,
      categoryKey: e.suggestedCategoryKey,
      startedAt: e.startedAt,
      endedAt: e.endedAt,
      notes: e.description,
      formattedClock: e.formattedClock,
      durationMinutes: e.durationMinutes,
      hasOverlap: e.hasOverlap,
      overlappingTaskNames: e.overlappingTaskNames,
    })),
  );

  const [importing, setImporting] = useState(false);

  // Sync state if incoming events change
  if (items.length !== events.length && events.length > 0 && !importing) {
    setItems(
      events.map((e) => ({
        id: e.id,
        selected: !e.hasOverlap,
        title: e.title,
        categoryKey: e.suggestedCategoryKey,
        startedAt: e.startedAt,
        endedAt: e.endedAt,
        notes: e.description,
        formattedClock: e.formattedClock,
        durationMinutes: e.durationMinutes,
        hasOverlap: e.hasOverlap,
        overlappingTaskNames: e.overlappingTaskNames,
      })),
    );
  }

  const selectedCount = items.filter((i) => i.selected).length;

  function toggleSelect(id: string) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, selected: !i.selected } : i)),
    );
  }

  function updateTitle(id: string, title: string) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, title } : i)),
    );
  }

  function updateCategory(id: string, categoryKey: string) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, categoryKey } : i)),
    );
  }

  async function handleConfirmImport() {
    const selectedItems = items.filter((i) => i.selected);
    if (selectedItems.length === 0) return;

    setImporting(true);
    try {
      const res = await fetch("/api/calendar/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events: selectedItems.map((item) => ({
            eventId: item.id,
            title: item.title,
            categoryKey: item.categoryKey,
            startedAt: item.startedAt,
            endedAt: item.endedAt,
            notes: item.notes,
          })),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to import calendar events");
      }

      toast.success(
        `Imported ${selectedItems.length} calendar ${
          selectedItems.length === 1 ? "activity" : "activities"
        } into your day.`,
      );
      onOpenChange(false);
      onImportSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Calendar className="size-5 text-primary" />
            <DialogTitle>Import Calendar Activities</DialogTitle>
          </div>
          <DialogDescription>
            Confirm or adjust the suggested task names and categories before
            recording them as completed activities on today&apos;s timeline.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "flex flex-col gap-3 rounded-xl border p-3.5 transition-all",
                item.selected
                  ? "border-border bg-card shadow-xs"
                  : "border-border/40 bg-muted/20 opacity-70",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={() => toggleSelect(item.id)}
                    className="size-4 rounded border-border text-primary focus:ring-primary/40 cursor-pointer"
                  />
                  <span className="font-mono text-xs font-semibold text-foreground">
                    {item.formattedClock}
                  </span>
                  {item.durationMinutes > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ({item.durationMinutes}m)
                    </span>
                  )}
                </label>

                {item.hasOverlap && (
                  <Badge variant="outline" className="text-[11px] gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10">
                    <AlertCircle className="size-3 shrink-0" />
                    Overlaps: {item.overlappingTaskNames.join(", ")}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                <div className="sm:col-span-7">
                  <Input
                    value={item.title}
                    onChange={(e) => updateTitle(item.id, e.target.value)}
                    placeholder="Task name"
                    className="h-9 text-sm"
                    disabled={!item.selected || importing}
                  />
                </div>
                <div className="sm:col-span-5">
                  <Select
                    value={item.categoryKey}
                    onValueChange={(val) => updateCategory(item.id, val)}
                    disabled={!item.selected || importing}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.key} value={cat.key} className="text-xs">
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={importing}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirmImport}
            disabled={selectedCount === 0 || importing}
          >
            {importing ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Check className="mr-2 size-4" />
            )}
            Import {selectedCount} {selectedCount === 1 ? "Activity" : "Activities"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
