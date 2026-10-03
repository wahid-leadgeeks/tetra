import { afterEach, describe, expect, it, vi } from "vitest";

import { canObserveOutOfView, observeOutOfView } from "./use-out-of-view";

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void;

function stubIntersectionObserver() {
  const instances: {
    callback: Callback;
    options: IntersectionObserverInit | undefined;
    observe: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }[] = [];
  class FakeObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    constructor(callback: Callback, options?: IntersectionObserverInit) {
      instances.push({
        callback,
        options,
        observe: this.observe,
        disconnect: this.disconnect,
      });
    }
  }
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  return instances;
}

function entry(isIntersecting: boolean, top: number, rootTop = 56) {
  return {
    isIntersecting,
    boundingClientRect: { top } as DOMRectReadOnly,
    rootBounds: { top: rootTop } as DOMRectReadOnly,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("observeOutOfView", () => {
  it("observes the element with the given rootMargin", () => {
    const instances = stubIntersectionObserver();
    const el = {} as Element;
    observeOutOfView(el, { rootMargin: "-56px 0px 0px 0px" }, vi.fn());
    expect(instances).toHaveLength(1);
    expect(instances[0]!.options).toEqual({ rootMargin: "-56px 0px 0px 0px" });
    expect(instances[0]!.observe).toHaveBeenCalledWith(el);
  });

  it("reports out of view once scrolled above, and back in view", () => {
    const instances = stubIntersectionObserver();
    const onChange = vi.fn();
    observeOutOfView({} as Element, {}, onChange);
    const { callback } = instances[0]!;

    callback([entry(true, 120)]);
    expect(onChange).toHaveBeenLastCalledWith(false);

    callback([entry(false, -300)]);
    expect(onChange).toHaveBeenLastCalledWith(true);

    callback([entry(true, 10)]);
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it("does not report out of view for an element still below the fold", () => {
    const instances = stubIntersectionObserver();
    const onChange = vi.fn();
    observeOutOfView({} as Element, {}, onChange);
    instances[0]!.callback([entry(false, 2000)]);
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it("disconnects on cleanup", () => {
    const instances = stubIntersectionObserver();
    const cleanup = observeOutOfView({} as Element, {}, vi.fn());
    cleanup();
    expect(instances[0]!.disconnect).toHaveBeenCalledTimes(1);
  });

  it("is a no-op without IntersectionObserver", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    expect(canObserveOutOfView()).toBe(false);
    const onChange = vi.fn();
    const cleanup = observeOutOfView({} as Element, {}, onChange);
    expect(() => cleanup()).not.toThrow();
    expect(onChange).not.toHaveBeenCalled();
  });
});
