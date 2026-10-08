/** Generic retry helpers. No window/navigator access at module load. */

function errName(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "name" in err) {
    const name = (err as { name: unknown }).name;
    return typeof name === "string" ? name : undefined;
  }
  return undefined;
}

export function isAbortError(err: unknown): boolean {
  return errName(err) === "AbortError";
}

export function isNetworkError(err: unknown): boolean {
  if (isAbortError(err)) return false;
  return err instanceof TypeError || errName(err) === "TimeoutError";
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function waitForOnline(
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<void> {
  if (
    typeof window === "undefined" ||
    typeof navigator === "undefined" ||
    navigator.onLine !== false
  ) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const done = () => {
      clearTimeout(timer);
      window.removeEventListener("online", done);
      signal?.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    window.addEventListener("online", done);
    signal?.addEventListener("abort", done, { once: true });
  });
}

export function timeoutSignal(ms: number): {
  signal: AbortSignal;
  clear: () => void;
} {
  const c = new AbortController();
  const t = setTimeout(
    () => c.abort(new DOMException("Request timed out", "TimeoutError")),
    ms,
  );
  return { signal: c.signal, clear: () => clearTimeout(t) };
}

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: {
    delaysMs: number[];
    shouldRetry: (err: unknown, attempt: number) => boolean;
    onlineWaitMs?: number;
    signal?: AbortSignal;
  },
): Promise<T> {
  const { delaysMs, shouldRetry, signal } = opts;
  for (let k = 0; ; k++) {
    try {
      return await fn(k);
    } catch (err) {
      if (signal?.aborted || !shouldRetry(err, k) || k >= delaysMs.length) {
        throw err;
      }
      await sleep(delaysMs[k], signal);
      await waitForOnline(opts.onlineWaitMs ?? 30_000, signal);
      if (signal?.aborted) throw err;
    }
  }
}
