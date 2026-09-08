import { minutesBetween, zonedClock } from "@/lib/time";
import type { TimeEntryDTO } from "@/lib/types";
import { matchCategory } from "./rules";
import type {
  CalendarEventSuggestionDTO,
  CalendarRuleDTO,
} from "./types";
import type { RawCalendarEvent } from "./google";

/** Formats a start and end instant to a friendly "09:00 – 09:30" string in the user's timezone. */
export function formatClockRange(startDate: Date, endDate: Date, timeZone: string): string {
  const start = zonedClock(startDate, timeZone);
  const end = zonedClock(endDate, timeZone);
  return `${start} – ${end}`;
}

export interface ExistingEntrySpan {
  id: string;
  taskName: string;
  startedAt: Date;
  endedAt: Date | null;
}

/**
 * Checks whether an event span [eventStart, eventEnd] overlaps with any existing entry.
 * Half-open interval rule: [A_start, A_end) overlaps [B_start, B_end) if A_start < B_end and A_end > B_start.
 */
export function findOverlappingEntries(
  eventStart: Date,
  eventEnd: Date,
  entries: readonly ExistingEntrySpan[],
): ExistingEntrySpan[] {
  const overlapping: ExistingEntrySpan[] = [];

  for (const entry of entries) {
    // If entry is ongoing without an end date, use current time or eventEnd
    const entryEnd = entry.endedAt ?? new Date();
    if (entry.startedAt < eventEnd && entryEnd > eventStart) {
      overlapping.push(entry);
    }
  }

  return overlapping;
}

/**
 * Converts a raw Google Calendar event into a full CalendarEventSuggestionDTO.
 */
export function processCalendarEvent(
  event: RawCalendarEvent,
  existingEntries: readonly TimeEntryDTO[],
  timeZone: string,
  customRules?: readonly CalendarRuleDTO[] | null,
): CalendarEventSuggestionDTO | null {
  const isAllDay = !!event.start.date && !event.start.dateTime;

  let startDate: Date;
  let endDate: Date;

  if (isAllDay) {
    startDate = new Date(`${event.start.date}T00:00:00Z`);
    endDate = new Date(`${event.end.date}T00:00:00Z`);
  } else if (event.start.dateTime && event.end.dateTime) {
    startDate = new Date(event.start.dateTime);
    endDate = new Date(event.end.dateTime);
  } else {
    return null;
  }

  const durationMinutes = isAllDay ? 0 : minutesBetween(startDate, endDate);
  const { categoryKey, categoryName } = matchCategory(
    event.summary,
    event.description,
    customRules,
  );

  const entrySpans: ExistingEntrySpan[] = existingEntries.map((e) => ({
    id: e.id,
    taskName: e.taskName,
    startedAt: new Date(e.startedAt),
    endedAt: e.endedAt ? new Date(e.endedAt) : null,
  }));

  const overlapping = isAllDay ? [] : findOverlappingEntries(startDate, endDate, entrySpans);

  return {
    id: event.id,
    title: event.summary,
    description: event.description ?? null,
    startedAt: startDate.toISOString(),
    endedAt: endDate.toISOString(),
    durationMinutes,
    formattedClock: isAllDay ? "All day" : formatClockRange(startDate, endDate, timeZone),
    suggestedCategoryKey: categoryKey,
    suggestedCategoryName: categoryName,
    isAllDay,
    hasOverlap: overlapping.length > 0,
    overlappingEntryIds: overlapping.map((o) => o.id),
    overlappingTaskNames: overlapping.map((o) => o.taskName),
  };
}
