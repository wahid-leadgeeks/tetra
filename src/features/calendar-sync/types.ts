export interface CalendarRuleDTO {
  categoryKey: string;
  categoryName: string;
  keywords: string[];
}

export interface CalendarEventSuggestionDTO {
  id: string;
  title: string;
  description: string | null;
  startedAt: string; // ISO 8601
  endedAt: string;   // ISO 8601
  durationMinutes: number;
  formattedClock: string; // e.g. "09:00 – 09:30"
  suggestedCategoryKey: string;
  suggestedCategoryName: string;
  isAllDay: boolean;
  hasOverlap: boolean;
  overlappingEntryIds: string[];
  overlappingTaskNames: string[];
}

export interface CalendarConfigDTO {
  id: string;
  userId: string;
  calendarId: string;
  calendarName: string;
  syncEnabled: boolean;
  categoryRules: CalendarRuleDTO[] | null;
  lastSyncAt: string | null;
  hasGoogleAuth: boolean;
}

export interface CalendarItemDTO {
  id: string;
  summary: string;
  primary?: boolean;
  description?: string;
}

export interface ImportCalendarItemInput {
  eventId: string;
  title: string;
  categoryKey: string;
  startedAt: string;
  endedAt: string;
  notes?: string | null;
}

export interface ImportCalendarEventsInputDTO {
  events: ImportCalendarItemInput[];
}

export interface ImportCalendarEventsResultDTO {
  importedCount: number;
  createdTaskIds: string[];
  createdEntryIds: string[];
}
