"use client";

import { useCallback, useEffect, useState } from "react";

import type { TimeEntryDTO } from "@/lib/types";

/**
 * Live elapsed time for the running entry, derived from the server-provided
 * `startedAt`. The clock ticks once per second while the entry is running and
 * freezes while it is paused.
 *
 * Pause accounting is event-driven: `markPaused`/`markResumed` are called by
 * the UI when a pause/resume mutation succeeds, so in-session pause spans are
 * subtracted exactly. An entry that was already paused when the screen loaded
 * (or paused/resumed on another device) cannot be compensated client-side —
 * TimeEntryDTO does not expose pausedSeconds — so its frozen display uses wall
 * time since `startedAt` as the best available value.
 */

interface FreezeState {
  /** Wall-clock ms the display froze at. */
  atMs: number;
  /** True when the freeze came from a pause click in this session. */
  fromClick: boolean;
}

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
  const [pauseMs, setPauseMs] = useState(0);
  const [freeze, setFreeze] = useState<FreezeState | null>(
    entry.status === "paused" ? { atMs: initialNowMs, fromClick: false } : null,
  );

  const frozen = freeze !== null;
  const now = useNow(initialNowMs, !frozen);
  const endMs = frozen ? freeze.atMs : now;
  const elapsedMs = Math.max(
    0,
    endMs - Date.parse(entry.startedAt) - pauseMs,
  );

  const markPaused = useCallback(() => {
    setFreeze({ atMs: Date.now(), fromClick: true });
  }, []);

  const markResumed = useCallback(() => {
    setFreeze(null);
    setPauseMs((ms) =>
      freeze !== null && freeze.fromClick ? ms + (Date.now() - freeze.atMs) : ms,
    );
  }, [freeze]);

  return {
    elapsedMs,
    /** True while the display is frozen by a pause observed in this session. */
    frozen,
    paused: frozen || entry.status === "paused",
    markPaused,
    markResumed,
  };
}
