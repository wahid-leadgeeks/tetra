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

export interface CalendarGuestDTO {
  email: string;
  displayName?: string | null;
  responseStatus?: "needsAction" | "declined" | "tentative" | "accepted" | null;
}

export interface CalendarEventDTO {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  categoryKey?: string | null;
  categoryName?: string | null;
  startAt: string; // ISO 8601
  endAt: string;   // ISO 8601
  allDay: boolean;
  calendarId: string;
  googleEventId: string | null;
  meetUrl: string | null;
  guests: CalendarGuestDTO[];
  sendUpdates: "all" | "none";
  htmlLink: string | null;
  status: "confirmed" | "cancelled";
  createdAt: string;
  updatedAt: string;
}

export interface CreateCalendarEventInput {
  title: string;
  description?: string | null;
  categoryId?: string | null;
  startAt: string;
  endAt: string;
  allDay?: boolean;
  guests?: Array<string | { email: string; displayName?: string }>;
  createMeet?: boolean;
  sendUpdates?: "all" | "none";
}

export interface UpdateCalendarEventInput {
  title?: string;
  description?: string | null;
  categoryId?: string | null;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
  guests?: Array<string | { email: string; displayName?: string }>;
  createMeet?: boolean;
  sendUpdates?: "all" | "none";
}

