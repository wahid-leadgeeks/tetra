import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isAbortError,
  isNetworkError,
  sleep,
  timeoutSignal,
  waitForOnline,
  withRetry,
} from "./retry";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const always = () => true;

describe("withRetry", () => {
  it("retries network errors honouring delays", async () => {
    const fn = vi
      .fn<(a: number) => Promise<string>>()
      .mockRejectedValueOnce(new TypeError("a"))
      .mockRejectedValueOnce(new TypeError("b"))
      .mockResolvedValue("ok");
    const p = withRetry(fn, { delaysMs: [1000, 3000], shouldRetry: always });
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(999);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2999);
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    await expect(p).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(fn.mock.calls.map((c) => c[0])).toEqual([0, 1, 2]);
  });

  it("does not retry when shouldRetry is false", async () => {
    const err = new Error("nope");
    const fn = vi.fn().mockRejectedValue(err);
    await expect(
      withRetry(fn, { delaysMs: [1000], shouldRetry: () => false }),
    ).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("rejects with the last error when retries are exhausted", async () => {
    const errs = [new TypeError("1"), new TypeError("2"), new TypeError("3")];
    let i = 0;
    const fn = vi.fn(() => Promise.reject(errs[i++]));
    const p = withRetry(fn, { delaysMs: [10, 10], shouldRetry: always });
    const assertion = expect(p).rejects.toBe(errs[2]);
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("stops retrying when the signal is aborted", async () => {
    const c = new AbortController();
    const err = new TypeError("x");
    const fn = vi.fn().mockRejectedValue(err);
    const p = withRetry(fn, {
      delaysMs: [1000, 1000],
      shouldRetry: always,
      signal: c.signal,
    });
    const assertion = expect(p).rejects.toBe(err);
    await vi.advanceTimersByTimeAsync(0);
    c.abort();
    await vi.advanceTimersByTimeAsync(0);
    await assertion;
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("waitForOnline", () => {
  it("resolves immediately in Node (no window)", async () => {
    await expect(waitForOnline(1000)).resolves.toBeUndefined();
  });

  it("resolves on the online event and removes listeners", async () => {
    const handlers: Record<string, () => void> = {};
    const removeEventListener = vi.fn();
    vi.stubGlobal("window", {
      addEventListener: (n: string, h: () => void) => {
        handlers[n] = h;
      },
      removeEventListener,
    });
    vi.stubGlobal("navigator", { onLine: false });
    let resolved = false;
    const p = waitForOnline(60_000).then(() => {
      resolved = true;
    });
    await vi.advanceTimersByTimeAsync(10);
    expect(resolved).toBe(false);
    handlers.online();
    await p;
    expect(removeEventListener).toHaveBeenCalledWith("online", expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("resolves on timeout", async () => {
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal("navigator", { onLine: false });
    const p = waitForOnline(500);
    await vi.advanceTimersByTimeAsync(500);
    await expect(p).resolves.toBeUndefined();
  });

  it("returns promptly when the signal aborts", async () => {
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal("navigator", { onLine: false });
    const c = new AbortController();
    const p = waitForOnline(60_000, c.signal);
    c.abort();
    await expect(p).resolves.toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("sleep", () => {
  it("resolves after ms", async () => {
    let done = false;
    void sleep(100).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(99);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  });

  it("returns promptly on abort", async () => {
    const c = new AbortController();
    const p = sleep(60_000, c.signal);
    c.abort();
    await expect(p).resolves.toBeUndefined();
    await expect(sleep(60_000, c.signal)).resolves.toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("timeoutSignal", () => {
  it("aborts with TimeoutError after ms", async () => {
    const { signal } = timeoutSignal(1000);
    await vi.advanceTimersByTimeAsync(999);
    expect(signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(signal.aborted).toBe(true);
    expect((signal.reason as DOMException).name).toBe("TimeoutError");
  });

  it("never aborts after clear()", async () => {
    const { signal, clear } = timeoutSignal(1000);
    clear();
    await vi.advanceTimersByTimeAsync(5000);
    expect(signal.aborted).toBe(false);
  });
});

describe("error predicates", () => {
  it("classifies errors", () => {
    expect(isNetworkError(new TypeError("fetch failed"))).toBe(true);
    expect(isNetworkError(new DOMException("t", "TimeoutError"))).toBe(true);
    expect(isNetworkError(new DOMException("a", "AbortError"))).toBe(false);
    expect(isNetworkError(new Error("other"))).toBe(false);
    expect(isAbortError(new DOMException("a", "AbortError"))).toBe(true);
    expect(isAbortError(new TypeError("x"))).toBe(false);
  });
});
