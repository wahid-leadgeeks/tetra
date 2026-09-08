/**
 * Dashboard feature types and DTO contracts.
 * Bridges server summary aggregation to UI presentation for daily, weekly,
 * and monthly time horizons.
 */
import type { AttendanceDTO, CategoryTotalDTO, DayWarning } from "@/lib/types";

export type DiffStatus = "ahead" | "behind" | "exact";

export interface FormattedDiff {
  formatted: string;
  isAhead: boolean;
  isBehind: boolean;
  isExact: boolean;
}

export type FormattedDiffDTO = FormattedDiff;

export interface MonthWeekSliceTarget {
  weekIndex: number; // 1-based index (1..5+)
  label: string; // e.g. "WEEK 1"
  from: string; // "YYYY-MM-DD"
  to: string; // "YYYY-MM-DD"
  dateRange: string; // e.g. "Sep 1 – Sep 6"
  dateRangeLabel: string; // e.g. "Sep 1 – Sep 6"
  workdaysCount: number; // Monday..Friday count in slice
  targetMinutes: number; // workdaysCount * 480
}

export interface DailyProgressDTO {
  date: string; // "YYYY-MM-DD"
  workDate: string; // "YYYY-MM-DD"
  dayOfWeek: string; // e.g. "Tuesday"
  isWorkday: boolean;
  hasData: boolean;
  workMinutes: number;
  breakMinutes: number;
  attendanceMinutes: number;
  targetMinutes: number; // 480 for workdays, 0 for weekends
  diffMinutes: number;
  formattedDiff: FormattedDiff;
  diff: FormattedDiff;
  isAhead: boolean;
  isBehind: boolean;
  isExact: boolean;
  progressPct: number; // 0..100+
  attendance: AttendanceDTO | null;
  categoryBreakdown: CategoryTotalDTO[];
  warnings: DayWarning[];
  timeEntriesCount: number;
}

export type WeekDayStatus = "completed" | "in_progress" | "incomplete" | "weekend";

export interface WeekDayProgressDTO {
  workDate: string; // "YYYY-MM-DD"
  dayOfWeek: string; // "Mon", "Tue", etc.
  dayName: string; // "Mon", "Tue", etc.
  fullDayName: string; // "Monday", "Tuesday", etc.
  isWorkday: boolean;
  isAnchorDate: boolean;
  workMinutes: number;
  breakMinutes: number;
  attendanceMinutes: number;
  targetMinutes: number; // 480 or 0
  diffMinutes: number;
  formattedDiff: FormattedDiff;
  diff: FormattedDiff;
  progressPct: number;
  hasData: boolean;
  status: WeekDayStatus;
}

export interface WeeklyProgressDTO {
  from: string; // "YYYY-MM-DD" (Monday)
  to: string; // "YYYY-MM-DD" (Sunday)
  dateRangeLabel: string; // e.g. "Aug 31 – Sep 6, 2026"
  weekNumber: number; // ISO week number
  totalWorkMinutes: number;
  workMinutes: number;
  totalBreakMinutes: number;
  breakMinutes: number;
  totalAttendanceMinutes: number;
  attendanceMinutes: number;
  targetMinutes: number; // workdaysCount * 480
  totalTargetMinutes: number;
  diffMinutes: number;
  formattedDiff: FormattedDiff;
  diff: FormattedDiff;
  isAhead: boolean;
  isBehind: boolean;
  isExact: boolean;
  progressPct: number;
  workdaysCount: number;
  daysTracked: number;
  days: WeekDayProgressDTO[];
  categoryBreakdown: CategoryTotalDTO[];
}

export interface MonthWeekSliceDTO extends MonthWeekSliceTarget {
  formattedTarget: string; // e.g. "32:00"
  workMinutes: number;
  formattedLogged: string; // e.g. "32:00"
  diffMinutes: number;
  formattedDiff: FormattedDiff;
  diff: FormattedDiff;
  isAhead: boolean;
  isBehind: boolean;
  isExact: boolean;
  progressPct: number;
}

export interface MonthlyProgressDTO {
  monthKey: string; // "YYYY-MM"
  monthLabel: string; // e.g. "September 2026"
  from: string; // "YYYY-MM-01"
  to: string; // "YYYY-MM-lastDay"
  totalWorkMinutes: number;
  workMinutes: number;
  formattedTotalLogged: string; // e.g. "38:00"
  totalBreakMinutes: number;
  breakMinutes: number;
  totalAttendanceMinutes: number;
  attendanceMinutes: number;
  totalTargetMinutes: number; // e.g. 10560
  targetMinutes: number;
  formattedTotalTarget: string; // e.g. "176:00"
  totalDiffMinutes: number; // e.g. -8280
  diffMinutes: number;
  formattedDiff: FormattedDiff;
  diff: FormattedDiff;
  isAhead: boolean;
  isBehind: boolean;
  isExact: boolean;
  progressPct: number;
  totalWorkdays: number;
  workdaysCount: number;
  daysTracked: number;
  weekSlices: MonthWeekSliceDTO[];
  categoryBreakdown: CategoryTotalDTO[];
}

export interface DashboardDataDTO {
  anchorDate: string; // "YYYY-MM-DD"
  timezone: string;
  daily: DailyProgressDTO;
  weekly: WeeklyProgressDTO;
  monthly: MonthlyProgressDTO;
}
