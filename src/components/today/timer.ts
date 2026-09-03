/**
 * Live stopwatch formatting for the Today screen.
 * Pure and client-safe; all elapsed values are derived from server timestamps.
 */

/** "01:24:37" — H:MM:SS rendering of elapsed milliseconds. */
export function formatStopwatch(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}
