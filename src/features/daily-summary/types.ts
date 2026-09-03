/**
 * Input contracts for the daily-summary domain. All instants arrive as UTC
 * Date objects; the domain stays pure (no DB, no clock) from here on.
 */
import type {
  AttendanceStatus,
  EntrySource,
  EntryStatus,
  ReviewState,
} from "@/lib/types";

export interface DaySummaryAttendanceInput {
  id: string;
  clockInAt: Date;
  clockOutAt: Date | null;
  status: AttendanceStatus;
}

export interface DaySummaryBreakInput {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
}

export interface DaySummaryEntryInput {
  id: string;
  taskId: string;
  taskName: string;
  categoryId: string;
  categoryKey: string;
  categoryName: string;
  startedAt: Date;
  endedAt: Date | null;
  status: EntryStatus;
  pausedAt: Date | null;
  pausedSeconds: number;
  notes: string | null;
  source: EntrySource;
}

export interface DaySummaryCategoryInput {
  id: string;
  key: string;
  name: string;
  sortOrder: number;
}

export interface BuildDaySummaryInput {
  workDate: string;
  tz: string;
  attendance: DaySummaryAttendanceInput | null;
  breaks: DaySummaryBreakInput[];
  entries: DaySummaryEntryInput[];
  categories: DaySummaryCategoryInput[];
  reviewStateStored: ReviewState;
  now: Date;
}
