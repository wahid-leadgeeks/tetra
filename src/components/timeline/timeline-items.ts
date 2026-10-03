import { formatClock } from "@/components/timeline/time";
import { formatHuman } from "@/lib/time";
import type { BreakDTO, DaySummaryDTO, TimeEntryDTO } from "@/lib/types";

export type TimelineItem =
  | { kind: "entry"; entry: TimeEntryDTO }
  | { kind: "break"; breakItem: BreakDTO };

/** Matches the daily summary's gap-warning threshold (5 minutes). */
export const GAP_THRESHOLD_MINUTES = 5;

export interface TimelineGap {
  /** Index of the item the gap follows. */
  afterIndex: number;
  fromIso: string;
  toIso: string;
  fromClock: string;
  toClock: string;
  minutes: number;
}

export function itemStart(item: TimelineItem): string {
  return item.kind === "entry" ? item.entry.startedAt : item.breakItem.startedAt;
}

export function itemEnd(item: TimelineItem): string | null {
  return item.kind === "entry" ? item.entry.endedAt : item.breakItem.endedAt;
}

/**
 * Gaps between consecutive items (activities and breaks alike) wider than
 * the threshold — exactly the spans a "fill this gap" backfill should cover.
 * Items with no end yet (running task / open break) never bound a gap.
 */
export function gapsBetweenItems(
  items: TimelineItem[],
  timeZone: string,
): TimelineGap[] {
  const gaps: TimelineGap[] = [];
  for (let i = 0; i + 1 < items.length; i += 1) {
    const prevEnd = itemEnd(items[i]!);
    const nextStart = itemStart(items[i + 1]!);
    if (prevEnd === null) continue;
    const minutes = Math.floor(
      (Date.parse(nextStart) - Date.parse(prevEnd)) / 60_000,
    );
    if (minutes <= GAP_THRESHOLD_MINUTES) continue;
    gaps.push({
      afterIndex: i,
      fromIso: prevEnd,
      toIso: nextStart,
      fromClock: formatClock(prevEnd, timeZone),
      toClock: formatClock(nextStart, timeZone),
      minutes,
    });
  }
  return gaps;
}

export function interleave(summary: DaySummaryDTO): TimelineItem[] {
  const items: TimelineItem[] = [
    ...summary.timeEntries.map<TimelineItem>((entry) => ({
      kind: "entry",
      entry,
    })),
    ...(summary.attendance?.breaks ?? []).map<TimelineItem>((breakItem) => ({
      kind: "break",
      breakItem,
    })),
  ];
  return items.sort((a, b) => {
    const aStart = a.kind === "entry" ? a.entry.startedAt : a.breakItem.startedAt;
    const bStart = b.kind === "entry" ? b.entry.startedAt : b.breakItem.startedAt;
    return aStart.localeCompare(bStart);
  });
}

/** Duration text for a completed entry or break; sub-minute shows `<1m`. */
export function durationLabel(minutes: number): string {
  return minutes === 0 ? "<1m" : formatHuman(minutes);
}
