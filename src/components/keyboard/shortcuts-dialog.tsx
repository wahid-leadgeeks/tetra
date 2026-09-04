"use client";

import type { ReactNode } from "react";

import { Kbd } from "@/components/keyboard/kbd";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutRow {
  id: string;
  keys: ReactNode;
  action: string;
}

/**
 * Static help text for every shortcut. The Today-screen actions
 * (s / b / Space) are owned by the Today screen; they are only
 * documented here.
 */
const SHORTCUT_ROWS: readonly ShortcutRow[] = [
  {
    id: "screens",
    keys: (
      <>
        <Kbd>1</Kbd>
        <span aria-hidden="true" className="text-muted-foreground">
          –
        </span>
        <Kbd>5</Kbd>
      </>
    ),
    action: "Go to screen",
  },
  { id: "help", keys: <Kbd>?</Kbd>, action: "Show this help" },
  { id: "start", keys: <Kbd>s</Kbd>, action: "Start work / log activity (Today)" },
  { id: "break", keys: <Kbd>b</Kbd>, action: "Break on/off (Today)" },
  { id: "pause", keys: <Kbd>Space</Kbd>, action: "Pause or resume task (Today)" },
];

/** Keyboard shortcuts help (DESIGN.md: calm, keyboard accessible). */
export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="keyboard-help-dialog">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Move around without the mouse. Shortcuts are ignored while you
            type.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg ring-1 ring-foreground/10">
          <table className="w-full text-sm">
            <caption className="sr-only">Keyboard shortcuts</caption>
            <thead>
              <tr className="border-b bg-muted/50 text-left text-muted-foreground">
                <th scope="col" className="px-3 py-2 font-medium">
                  Key
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  What it does
                </th>
              </tr>
            </thead>
            <tbody>
              {SHORTCUT_ROWS.map((row) => (
                <tr key={row.id} className="border-b last:border-b-0">
                  <td className="whitespace-nowrap px-3 py-2">{row.keys}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.action}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Press <Kbd>Esc</Kbd> to close.
        </p>
      </DialogContent>
    </Dialog>
  );
}
