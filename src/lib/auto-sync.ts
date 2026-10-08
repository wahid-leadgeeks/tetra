import { toast } from "sonner";
import { ApiError, apiFetch } from "@/components/timeline/api";
import { isNetworkError, timeoutSignal, withRetry } from "./retry";

export type SyncDayResult = {
  status: string;
  changedCells: { a1: string; value: string }[];
  idempotent: boolean;
};

export type SyncDayOptions = {
  auto?: boolean;
  successMessage?: (changedCount: number) => string;
  notifyIdempotent?: boolean;
  onSuccess?: (res: SyncDayResult) => void;
};

const ATTEMPT_TIMEOUT_MS = 45_000;

type DayState = {
  queued: {
    opts: SyncDayOptions;
    waiters: Array<(r: SyncDayResult | null) => void>;
  } | null;
};

const inFlight = new Map<string, DayState>();

/** Test helper: drop all coalescing state. */
export function __resetForTests(): void {
  inFlight.clear();
}

function isRetryableFailure(err: unknown): boolean {
  return isNetworkError(err) || (err instanceof ApiError && err.status === 502);
}

async function runOnce(
  dayKey: string,
  opts: SyncDayOptions,
): Promise<SyncDayResult | null> {
  const id = `sheet-sync-${dayKey}`;
  try {
    const res = await withRetry(
      async () => {
        const t = timeoutSignal(ATTEMPT_TIMEOUT_MS);
        try {
          return await apiFetch<SyncDayResult>(`/api/days/${dayKey}/sync`, {
            method: "POST",
            body: JSON.stringify({ allowUnreviewed: true }),
            signal: t.signal,
          });
        } finally {
          t.clear();
        }
      },
      {
        delaysMs: [1000, 3000],
        shouldRetry: (err, attempt) =>
          isNetworkError(err) ||
          (err instanceof ApiError && err.status === 502 && attempt === 0),
      },
    );
    const n = res.changedCells.length;
    if (!res.idempotent && n > 0) {
      toast.success(
        opts.successMessage?.(n) ??
          `Auto-synced to Google Sheet (${n} ${n === 1 ? "cell" : "cells"})`,
        { id, action: undefined },
      );
    } else if (res.idempotent && opts.notifyIdempotent) {
      toast.success("Google Sheet already up to date", {
        id,
        action: undefined,
      });
    }
    opts.onSuccess?.(res);
    return res;
  } catch (err) {
    const retry = {
      label: "Retry",
      onClick: () => void syncDayToSheet(dayKey, opts),
    };
    if (err instanceof ApiError) {
      if (err.status === 401) return null;
      if (err.code === "not_configured" && opts.auto) return null;
    }
    if (isNetworkError(err)) {
      toast.error("Couldn't sync to Google Sheet — check your connection", {
        id,
        action: retry,
      });
    } else if (err instanceof ApiError) {
      toast.error(err.message, {
        id,
        action: isRetryableFailure(err) ? retry : undefined,
      });
    } else {
      toast.error("Couldn't sync to Google Sheet", { id, action: undefined });
    }
    return null;
  }
}

/**
 * Sync one day to the Google Sheet with retry, toasts and per-day coalescing.
 * Never throws; resolves to null on failure or silent no-op.
 */
export async function syncDayToSheet(
  dayKey: string,
  opts: SyncDayOptions = {},
): Promise<SyncDayResult | null> {
  const existing = inFlight.get(dayKey);
  if (existing) {
    if (!existing.queued) existing.queued = { opts, waiters: [] };
    else existing.queued.opts = opts;
    const queued = existing.queued;
    return new Promise((resolve) => queued.waiters.push(resolve));
  }
  const state: DayState = { queued: null };
  inFlight.set(dayKey, state);
  try {
    const first = await runOnce(dayKey, opts);
    while (state.queued) {
      const q = state.queued;
      state.queued = null;
      const result = await runOnce(dayKey, q.opts);
      for (const w of q.waiters) w(result);
    }
    return first;
  } finally {
    inFlight.delete(dayKey);
  }
}
