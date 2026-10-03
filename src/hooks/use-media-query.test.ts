import { afterEach, describe, expect, it, vi } from "vitest";
import { subscribeMediaQuery } from "./use-media-query";

function stubWindow(matches: boolean) {
  const listeners = new Set<() => void>();
  const mql = {
    matches,
    addEventListener: vi.fn((_: string, cb: () => void) => listeners.add(cb)),
    removeEventListener: vi.fn((_: string, cb: () => void) => listeners.delete(cb)),
  };
  const matchMedia = vi.fn(() => mql);
  vi.stubGlobal("window", { matchMedia });
  return { mql, matchMedia, listeners };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("subscribeMediaQuery", () => {
  it("subscribes to the query and unsubscribes on cleanup", () => {
    const { mql, matchMedia, listeners } = stubWindow(false);
    const cb = vi.fn();
    const cleanup = subscribeMediaQuery("(max-width: 767px)", cb);
    expect(matchMedia).toHaveBeenCalledWith("(max-width: 767px)");
    expect(listeners.size).toBe(1);
    cleanup();
    expect(mql.removeEventListener).toHaveBeenCalledWith("change", cb);
    expect(listeners.size).toBe(0);
  });

  it("notifies the callback when the query changes", () => {
    const { listeners } = stubWindow(false);
    const cb = vi.fn();
    subscribeMediaQuery("(max-width: 767px)", cb);
    listeners.forEach((l) => l());
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("returns a no-op cleanup without window", () => {
    const cleanup = subscribeMediaQuery("(max-width: 767px)", vi.fn());
    expect(() => cleanup()).not.toThrow();
  });

  it("returns a no-op cleanup when matchMedia is missing", () => {
    vi.stubGlobal("window", {});
    const cleanup = subscribeMediaQuery("(max-width: 767px)", vi.fn());
    expect(() => cleanup()).not.toThrow();
  });
});
