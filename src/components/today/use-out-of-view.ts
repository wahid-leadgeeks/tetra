"use client";

import { useCallback, useEffect, useState } from "react";

export interface OutOfViewOptions {
  /** IntersectionObserver rootMargin, e.g. "-56px 0px 0px 0px" for a sticky header. */
  rootMargin?: string;
}

/** True when the runtime has an IntersectionObserver to drive `observeOutOfView`. */
export function canObserveOutOfView(): boolean {
  return typeof IntersectionObserver !== "undefined";
}

/**
 * Observe `el` and report whether it has scrolled *above* the (margin-adjusted)
 * viewport. An element still below the fold is not "out of view" — only one
 * the user has scrolled past. Returns a cleanup that disconnects the observer.
 *
 * Without IntersectionObserver this is a no-op; callers derive their
 * fail-open value from `canObserveOutOfView()` instead.
 */
export function observeOutOfView(
  el: Element,
  options: OutOfViewOptions,
  onChange: (outOfView: boolean) => void,
): () => void {
  if (!canObserveOutOfView()) return () => {};

  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      const rootTop = entry.rootBounds?.top ?? 0;
      onChange(!entry.isIntersecting && entry.boundingClientRect.top < rootTop);
    },
    { rootMargin: options.rootMargin },
  );
  observer.observe(el);
  return () => observer.disconnect();
}

/**
 * Thin hook over `observeOutOfView`. Returns a callback ref (so it attaches
 * once the element mounts, e.g. after a loading skeleton) and whether that
 * element has scrolled out of view. False while nothing is attached; fails
 * open (true) when IntersectionObserver is unavailable.
 */
export function useOutOfView(
  options: OutOfViewOptions = {},
): [(el: HTMLElement | null) => void, boolean] {
  const { rootMargin } = options;
  const [el, setEl] = useState<HTMLElement | null>(null);
  // Keyed by element so a remounted target never inherits a stale value.
  const [state, setState] = useState<{ el: HTMLElement | null; out: boolean }>(
    { el: null, out: false },
  );

  const ref = useCallback((node: HTMLElement | null) => setEl(node), []);

  useEffect(() => {
    if (!el) return;
    return observeOutOfView(el, { rootMargin }, (out) => setState({ el, out }));
  }, [el, rootMargin]);

  if (!el) return [ref, false];
  if (!canObserveOutOfView()) return [ref, true];
  return [ref, state.el === el && state.out];
}
