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
 * Checks whether an existing timeline entry was imported from this calendar event.
 * Matches if the time span is identical or within 2 minutes AND task name matches event title.
 */
export function isMatchingImportedEntry(
  entry: ExistingEntrySpan,
  eventSummary: string,
  eventStart: Date,
  eventEnd: Date,
): boolean {
  const startDiff = Math.abs(entry.startedAt.getTime() - eventStart.getTime());
  const endDiff = entry.endedAt
    ? Math.abs(entry.endedAt.getTime() - eventEnd.getTime())
    : Infinity;

  // Timestamps must align within 2 minutes
  if (startDiff > 120_000 || endDiff > 120_000) {
    return false;
  }

  const normEntry = entry.taskName.trim().toLowerCase();
  const normEvent = eventSummary.trim().toLowerCase();

  return (
    normEntry === normEvent ||
    normEntry.includes(normEvent) ||
    normEvent.includes(normEntry)
  );
}

/**
 * Detects whether an event is a daily reminder or company routine note
 * (such as morning prayer/hydration at 08:00, lunch breaks at 12:00, or daily attendance reminders at 18:00)
 * that should not clutter the active daily work schedule or calendar imports.
 */
export function isReminderOrNonWorkEvent(event: RawCalendarEvent): boolean {
  const summary = (event.summary || "").trim().toLowerCase();

  // Explicit reminder patterns in summary (e.g. "... Reminder", "Daily Reminder: ...")
  if (/\breminder\b/i.test(summary)) {
    return true;
  }

  // Company daily routine reminders (at 08:00, 12:00, 18:00):
  // 1. "Prayer & Take A Sip to Start Your Day"
  // 2. "Take Your Lunch Break & Stay Hydrated"
  // 3. "Daily Attendance, Stretching & Prayer Reminder"
  if (
    /\b(prayer\s*&\s*take\s*a\s*sip|take\s*a\s*sip)\b/i.test(summary) ||
    /\b(take\s*your\s*)?lunch\s*break\b/i.test(summary) ||
    /\bstay\s*hydrated\b/i.test(summary) ||
    /\bdaily\s+attendance\b/i.test(summary)
  ) {
    return true;
  }

  return false;
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
 * Returns null if the event is a reminder or non-work event that should not be tracked.
 */
export function processCalendarEvent(
  event: RawCalendarEvent,
  existingEntries: readonly TimeEntryDTO[],
  timeZone: string,
  customRules?: readonly CalendarRuleDTO[] | null,
): CalendarEventSuggestionDTO | null {
  // Exclude daily reminders & transparent non-work items from Today's Schedule
  if (isReminderOrNonWorkEvent(event)) {
    return null;
  }

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
    {
      customRules,
      hasMeetUrl: !!event.meetUrl,
      guestCount: event.guests?.length ?? 0,
    },
  );

  const entrySpans: ExistingEntrySpan[] = existingEntries.map((e) => ({
    id: e.id,
    taskName: e.taskName,
    startedAt: new Date(e.startedAt),
    endedAt: e.endedAt ? new Date(e.endedAt) : null,
  }));

  // Detect whether this event was already imported into the timeline
  let isImported = false;
  const nonImportedSpans: ExistingEntrySpan[] = [];

  for (const span of entrySpans) {
    if (!isAllDay && isMatchingImportedEntry(span, event.summary, startDate, endDate)) {
      isImported = true;
    } else {
      nonImportedSpans.push(span);
    }
  }

  // Only consider non-imported entries when checking for scheduling conflicts
  const overlapping = isAllDay ? [] : findOverlappingEntries(startDate, endDate, nonImportedSpans);

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
    meetUrl: event.meetUrl ?? null,
    htmlLink: event.htmlLink ?? null,
    isImported,
  };
}
