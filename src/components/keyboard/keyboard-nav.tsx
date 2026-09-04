"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ShortcutsDialog } from "@/components/keyboard/shortcuts-dialog";
import { hasOpenDialog, isTypingTarget } from "@/lib/keyboard";

/** Number keys map straight to the five primary screens (DESIGN.md nav). */
const SCREEN_SHORTCUTS: Readonly<Record<string, string>> = {
  "1": "/",
  "2": "/timeline",
  "3": "/tasks",
  "4": "/reports",
  "5": "/settings",
};

/**
 * Shared ignore contract: keys do nothing while the user is typing
 * (form field or contentEditable) or while any dialog is open.
 */
function shouldIgnore(event: KeyboardEvent): boolean {
  if (isTypingTarget(event.target)) return true;
  return hasOpenDialog();
}

/**
 * Global keyboard navigation: 1–5 jump between screens, ? opens the
 * shortcuts help. Mounted once in the authenticated app shell.
 */
export function KeyboardNav() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.defaultPrevented || event.repeat) return;
      // Never hijack browser/system combos (Cmd+1, Ctrl+/, …).
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (shouldIgnore(event)) return;

      const destination = SCREEN_SHORTCUTS[event.key];
      if (destination !== undefined) {
        router.push(destination);
        return;
      }

      if (event.key === "?" || (event.shiftKey && event.key === "/")) {
        event.preventDefault();
        setHelpOpen(true);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />;
}
