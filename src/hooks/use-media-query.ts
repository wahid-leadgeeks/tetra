"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribe to a media query. Returns a cleanup function.
 * Safe to call where `window.matchMedia` is unavailable (returns a no-op).
 */
export function subscribeMediaQuery(
  query: string,
  callback: () => void,
): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const mql = window.matchMedia(query);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getMediaQuerySnapshot(query: string): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(query).matches;
}

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (callback: () => void) => subscribeMediaQuery(query, callback),
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => getMediaQuerySnapshot(query),
    () => false,
  );
}

/** Below the Tailwind `md` breakpoint (matches `md:hidden` on the bottom nav). */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}
