"use client";

import { useEffect, useState } from "react";

import type { TimeEntryDTO } from "@/lib/types";

/**
 * Live elapsed time for the running entry, derived entirely from
 * server-provided values: `startedAt`, the banked `pausedSeconds`, and the
 * open pause's `pausedAt`. The clock ticks once per second while the entry
 * runs and freezes at `pausedAt` while it is paused.
 *
 * Because pause state comes from the entry itself (refreshed after every
 * mutation), a pause or resume that happened outside this component — the
 * sticky bar, "End Break & Resume", or another device — is always reflected
 * correctly. No client-side pause accounting is kept.
 */

/** Ticking clock that starts from a server-supplied timestamp. */
function useNow(initialMs: number, ticking: boolean): number {
  const [now, setNow] = useState(initialMs);

  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ticking]);

  return now;
}

export function useStopwatch(entry: TimeEntryDTO, initialNowMs: number) {
  const paused = entry.status === "paused";
  const now = useNow(initialNowMs, !paused);

  const endMs =
    paused && entry.pausedAt !== null
      ? Date.parse(entry.pausedAt)
      : Math.max(now, Date.parse(entry.startedAt));
  const elapsedMs = Math.max(
    0,
    endMs - Date.parse(entry.startedAt) - entry.pausedSeconds * 1000,
  );

  return { elapsedMs, paused };
}
