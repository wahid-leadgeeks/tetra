/**
 * Pure domain logic for dashboard metrics, week slice partitioning, diff calculations,
 * and DTO assembly. Zero DB, zero system clock dependency.
 */
import { addDaysISO, formatHMM, isWeekend } from "@/lib/time";
import { monthRange } from "@/features/monthly-summary/domain";
import { weekRange } from "@/features/weekly-summary/domain";
import type { WeekSummary } from "@/features/weekly-summary/service";
import type { MonthSummary } from "@/features/monthly-summary/service";
import type { CategoryTotalDTO, DaySummaryDTO } from "@/lib/types";
import type {
  DailyProgressDTO,
  DashboardDataDTO,
  FormattedDiff,
  MonthlyProgressDTO,
  MonthWeekSliceDTO,
  MonthWeekSliceTarget,
  WeekDayProgressDTO,
  WeekDayStatus,
  WeeklyProgressDTO,
} from "./types";

export const DAILY_TARGET_MINUTES = 480; // 8 hours standard workday

const WEEKDAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_NAMES_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MONTH_NAMES_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Formats difference between logged work minutes and target minutes (`work - target`)
 * with explicit sign prefix and boolean flags.
 */
export function formatDiffMinutes(diffMinutes: number): FormattedDiff {
  // Guard against JavaScript -0
  if (diffMinutes === 0) {
    return {
      formatted: "0:00",
      isAhead: false,
      isBehind: false,
      isExact: true,
    };
  }

  const isAhead = diffMinutes > 0;
  const isBehind = diffMinutes < 0;
  const absMinutes = Math.abs(diffMinutes);
  const hours = Math.floor(absMinutes / 60);
  const mins = absMinutes % 60;
  const prefix = isAhead ? "+" : "-";
  const formatted = `${prefix}${hours}:${String(mins).padStart(2, "0")}`;

  return {
    formatted,
    isAhead,
    isBehind,
    isExact: false,
  };
}

/**
 * Calculates progress percentage `(work / target) * 100`.
 * Options:
 * - `clamp`: if true, clamps result to [0, 100] for UI progress bars.
 */
export function calculateProgressPct(
  workMinutes: number,
  targetMinutes: number,
  options?: { clamp?: boolean },
): number {
  if (workMinutes <= 0) {
    return 0;
  }
  if (targetMinutes <= 0) {
    return 100;
  }

  const rawPct = Math.round((workMinutes / targetMinutes) * 100);
  if (options?.clamp) {
    return Math.min(100, Math.max(0, rawPct));
  }
  return Math.max(0, rawPct);
}

/**
 * Formats date range label (e.g. "Sep 1 – Sep 6" or "Sep 1").
 */
export function formatSliceDateRange(from: string, to: string): string {
  const fmt = (dayKey: string) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
    }).format(new Date(`${dayKey}T12:00:00Z`));

  return from === to ? fmt(from) : `${fmt(from)} – ${fmt(to)}`;
}

/**
 * Formats month name and year (e.g. "September 2026").
 */
export function formatMonthLabel(dayKeyOrMonthKey: string): string {
  const year = dayKeyOrMonthKey.slice(0, 4);
  const monthIdx = Number(dayKeyOrMonthKey.slice(5, 7)) - 1;
  const monthName = MONTH_NAMES_FULL[monthIdx] ?? "";
  return `${monthName} ${year}`;
}

/**
 * Calculates ISO 8601 week number (1..53) from a date key "YYYY-MM-DD".
 */
export function getISOWeekNumber(dayKey: string): number {
  const date = new Date(Date.parse(`${dayKey}T00:00:00Z`));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Partitions any calendar month into sequential Monday–Sunday week slices
 * bounded by the 1st and last calendar days of the month.
 *
 * Slices correspond directly to rows 44–55 in the official Google Sheet.
 */
export function partitionMonthIntoWeekSlices(
  monthKeyOrRange: string | { from: string; to: string },
): MonthWeekSliceTarget[] {
  let monthStart: string;
  let monthEnd: string;

  if (typeof monthKeyOrRange === "object") {
    monthStart = monthKeyOrRange.from;
    monthEnd = monthKeyOrRange.to;
  } else {
    const normalizedDay =
      monthKeyOrRange.length === 7 ? `${monthKeyOrRange}-01` : monthKeyOrRange;
    const range = monthRange(normalizedDay);
    monthStart = range.from;
    monthEnd = range.to;
  }

  const slices: MonthWeekSliceTarget[] = [];
  let cursor = monthStart;
  let weekIndex = 1;

  while (cursor <= monthEnd) {
    const sunday = weekRange(cursor).to;
    const sliceEnd = sunday < monthEnd ? sunday : monthEnd;

    let workdaysCount = 0;
    for (let d = cursor; d <= sliceEnd; d = addDaysISO(d, 1)) {
      if (!isWeekend(d)) {
        workdaysCount++;
      }
    }

    const dateRange = formatSliceDateRange(cursor, sliceEnd);

    slices.push({
      weekIndex,
      label: `WEEK ${weekIndex}`,
      from: cursor,
      to: sliceEnd,
      dateRange,
      dateRangeLabel: dateRange,
      workdaysCount,
      targetMinutes: workdaysCount * DAILY_TARGET_MINUTES,
    });

    cursor = addDaysISO(sliceEnd, 1);
    weekIndex++;
  }

  return slices;
}

/** Helper to extract workMinutes from different summary shapes without using any. */
function extractWorkMinutes(item: unknown): number {
  if (!item || typeof item !== "object") return 0;
  const obj = item as Record<string, unknown>;
  if (typeof obj.workMinutes === "number") return obj.workMinutes;
  if (
    obj.totals &&
    typeof obj.totals === "object" &&
    typeof (obj.totals as Record<string, unknown>).workMinutes === "number"
  ) {
    return (obj.totals as Record<string, unknown>).workMinutes as number;
  }
  return 0;
}

/**
 * Aggregates work logged into the month's week slices, reproducing the
 * Personal Weekly Report table data.
 */
export function aggregateMonthWeekSlices(
  slices: readonly MonthWeekSliceTarget[],
  summaries: readonly unknown[] | ReadonlyMap<string, unknown> | Map<string, unknown>,
): MonthWeekSliceDTO[] {
  const summariesByDate = new Map<string, Record<string, unknown>>();
  if (summaries instanceof Map) {
    for (const [d, val] of summaries.entries()) {
      if (typeof val === "number") {
        summariesByDate.set(d, { workMinutes: val });
      } else if (val && typeof val === "object") {
        summariesByDate.set(d, val as Record<string, unknown>);
      }
    }
  } else if (Array.isArray(summaries)) {
    for (const s of summaries) {
      if (s && typeof s === "object") {
        const obj = s as Record<string, unknown>;
        const d = (obj.workDate ?? obj.date) as string | undefined;
        if (d) {
          summariesByDate.set(d, obj);
        }
      }
    }
  }

  return slices.map((slice) => {
    let sliceWorkMinutes = 0;
    for (let d = slice.from; d <= slice.to; d = addDaysISO(d, 1)) {
      const summary = summariesByDate.get(d);
      if (summary) {
        sliceWorkMinutes += extractWorkMinutes(summary);
      }
    }

    const diffMinutes = sliceWorkMinutes - slice.targetMinutes;
    const diff = formatDiffMinutes(diffMinutes);
    const progressPct = calculateProgressPct(sliceWorkMinutes, slice.targetMinutes);

    return {
      weekIndex: slice.weekIndex,
      label: slice.label,
      from: slice.from,
      to: slice.to,
      dateRange: slice.dateRange,
      dateRangeLabel: slice.dateRangeLabel,
      workdaysCount: slice.workdaysCount,
      targetMinutes: slice.targetMinutes,
      formattedTarget: formatHMM(slice.targetMinutes),
      workMinutes: sliceWorkMinutes,
      formattedLogged: formatHMM(sliceWorkMinutes),
      diffMinutes,
      formattedDiff: diff,
      diff,
      isAhead: diff.isAhead,
      isBehind: diff.isBehind,
      isExact: diff.isExact,
      progressPct,
    };
  });
}

/**
 * Pure builder for DailyProgressDTO.
 */
export function buildDailyProgressDTO(
  summary: DaySummaryDTO | null,
  anchorDate?: string,
  _timezone?: string,
): DailyProgressDTO {
  const dateKey = summary?.workDate ?? anchorDate ?? "2026-09-01";
  const isWork = !isWeekend(dateKey);
  const targetMinutes = isWork ? DAILY_TARGET_MINUTES : 0;
  const workMinutes = summary ? summary.totals.workMinutes : 0;
  const breakMinutes = summary ? summary.totals.breakMinutes : 0;
  const attendanceMinutes = summary ? summary.totals.attendanceMinutes : 0;
  const diffMinutes = workMinutes - targetMinutes;
  const diff = formatDiffMinutes(diffMinutes);
  const progressPct = calculateProgressPct(workMinutes, targetMinutes);

  const d = new Date(Date.parse(`${dateKey}T00:00:00Z`));
  const dayOfWeek = WEEKDAY_NAMES_FULL[d.getUTCDay()] ?? "Monday";
  const hasData = summary
    ? summary.attendance !== null || summary.timeEntries.length > 0
    : false;

  return {
    date: dateKey,
    workDate: dateKey,
    dayOfWeek,
    isWorkday: isWork,
    hasData,
    workMinutes,
    breakMinutes,
    attendanceMinutes,
    targetMinutes,
    diffMinutes,
    formattedDiff: diff,
    diff,
    isAhead: diff.isAhead,
    isBehind: diff.isBehind,
    isExact: diff.isExact,
    progressPct,
    attendance: summary?.attendance ?? null,
    categoryBreakdown: summary?.byCategory ?? [],
    warnings: summary?.warnings ?? [],
    timeEntriesCount: summary?.timeEntries.length ?? 0,
  };
}

export const buildDailyProgress = buildDailyProgressDTO;

/**
 * Pure builder for WeeklyProgressDTO.
 */
export function buildWeeklyProgressDTO(
  weekSummaryOrInput:
    | WeekSummary
    | {
        from: string;
        to: string;
        days?: readonly unknown[];
        totals?: {
          workMinutes: number;
          breakMinutes: number;
          attendanceMinutes: number;
          daysTracked: number;
        };
        byCategory?: CategoryTotalDTO[];
      },
  anchorDate?: string,
): WeeklyProgressDTO {
  const { from, to } = weekSummaryOrInput;
  const inputDays = weekSummaryOrInput.days ?? [];

  const daysByDate = new Map<string, Record<string, unknown>>();
  for (const d of inputDays) {
    if (d && typeof d === "object") {
      const obj = d as Record<string, unknown>;
      const key = (obj.workDate ?? obj.date) as string | undefined;
      if (key) {
        daysByDate.set(key, obj);
      }
    }
  }

  const weekDayDTOs: WeekDayProgressDTO[] = [];
  let calculatedWorkMinutes = 0;
  let calculatedBreakMinutes = 0;
  let calculatedAttendanceMinutes = 0;
  let totalTarget = 0;
  let workdaysCount = 0;

  for (let i = 0; i < 7; i++) {
    const workDate = addDaysISO(from, i);
    const dayData = daysByDate.get(workDate);
    const isWork = !isWeekend(workDate);
    const target = isWork ? DAILY_TARGET_MINUTES : 0;

    if (isWork) {
      workdaysCount++;
      totalTarget += DAILY_TARGET_MINUTES;
    }

    const workMinutes = extractWorkMinutes(dayData);
    const totalsObj = dayData?.totals as Record<string, unknown> | undefined;
    const breakMinutes =
      typeof dayData?.breakMinutes === "number"
        ? dayData.breakMinutes
        : typeof totalsObj?.breakMinutes === "number"
          ? (totalsObj.breakMinutes as number)
          : 0;
    const attendanceMinutes =
      typeof dayData?.attendanceMinutes === "number"
        ? dayData.attendanceMinutes
        : typeof totalsObj?.attendanceMinutes === "number"
          ? (totalsObj.attendanceMinutes as number)
          : 0;
    const hasDayData =
      dayData?.hasData ??
      (dayData?.attendance !== null && dayData?.attendance !== undefined) ??
      workMinutes > 0;

    calculatedWorkMinutes += workMinutes;
    calculatedBreakMinutes += breakMinutes;
    calculatedAttendanceMinutes += attendanceMinutes;

    const diffM = workMinutes - target;
    const diff = formatDiffMinutes(diffM);
    const progressPct = calculateProgressPct(workMinutes, target);

    const d = new Date(Date.parse(`${workDate}T00:00:00Z`));
    const dayIdx = d.getUTCDay();
    const dayName = WEEKDAY_NAMES_SHORT[dayIdx] ?? "";
    const fullDayName = WEEKDAY_NAMES_FULL[dayIdx] ?? "";

    let status: WeekDayStatus = "incomplete";
    if (!isWork) {
      status = "weekend";
    } else if (workMinutes >= target) {
      status = "completed";
    } else if (workMinutes > 0) {
      status = "in_progress";
    }

    weekDayDTOs.push({
      workDate,
      dayOfWeek: dayName,
      dayName,
      fullDayName,
      isWorkday: isWork,
      isAnchorDate: workDate === anchorDate,
      workMinutes,
      breakMinutes,
      attendanceMinutes,
      targetMinutes: target,
      diffMinutes: diffM,
      formattedDiff: diff,
      diff,
      progressPct,
      hasData: Boolean(hasDayData),
      status,
    });
  }

  const totals = weekSummaryOrInput.totals ?? {
    workMinutes: calculatedWorkMinutes,
    breakMinutes: calculatedBreakMinutes,
    attendanceMinutes: calculatedAttendanceMinutes,
    daysTracked: weekDayDTOs.filter((d) => d.hasData).length,
  };

  const totalWork = totals.workMinutes ?? calculatedWorkMinutes;
  const diffMinutes = totalWork - totalTarget;
  const diff = formatDiffMinutes(diffMinutes);
  const progressPct = calculateProgressPct(totalWork, totalTarget);
  const weekNumber = getISOWeekNumber(anchorDate ?? from);

  const dateRangeLabel = `${new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(new Date(`${from}T12:00:00Z`))} – ${new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${to}T12:00:00Z`))}`;

  return {
    from,
    to,
    dateRangeLabel,
    weekNumber,
    totalWorkMinutes: totalWork,
    workMinutes: totalWork,
    totalBreakMinutes: totals.breakMinutes ?? calculatedBreakMinutes,
    breakMinutes: totals.breakMinutes ?? calculatedBreakMinutes,
    totalAttendanceMinutes: totals.attendanceMinutes ?? calculatedAttendanceMinutes,
    attendanceMinutes: totals.attendanceMinutes ?? calculatedAttendanceMinutes,
    targetMinutes: totalTarget,
    totalTargetMinutes: totalTarget,
    diffMinutes,
    formattedDiff: diff,
    diff,
    isAhead: diff.isAhead,
    isBehind: diff.isBehind,
    isExact: diff.isExact,
    progressPct,
    workdaysCount,
    daysTracked: totals.daysTracked,
    days: weekDayDTOs,
    categoryBreakdown: weekSummaryOrInput.byCategory ?? [],
  };
}

export const buildWeeklyProgress = buildWeeklyProgressDTO;

/**
 * Pure builder for MonthlyProgressDTO with Personal Weekly Report table data.
 */
export function buildMonthlyProgressDTO(
  input:
    | MonthSummary
    | {
        monthKey?: string;
        from?: string;
        to?: string;
        weekSlices?: MonthWeekSliceDTO[];
        summaries?: readonly unknown[];
        days?: readonly unknown[];
        totals?: {
          workMinutes: number;
          breakMinutes: number;
          attendanceMinutes: number;
          daysTracked: number;
        };
        byCategory?: CategoryTotalDTO[];
      },
  optionalMonthKey?: string,
): MonthlyProgressDTO {
  const monthKey =
    ("monthKey" in input && input.monthKey
      ? input.monthKey
      : "from" in input && input.from
        ? input.from.slice(0, 7)
        : optionalMonthKey ?? "2026-09"
    ).slice(0, 7);

  const range = monthRange(`${monthKey}-01`);
  const from = "from" in input && input.from ? input.from : range.from;
  const to = "to" in input && input.to ? input.to : range.to;

  const summaries: readonly unknown[] =
    "summaries" in input && input.summaries
      ? input.summaries
      : "days" in input && input.days
        ? input.days
        : [];

  let weekSlices: MonthWeekSliceDTO[];
  if ("weekSlices" in input && input.weekSlices) {
    weekSlices = input.weekSlices;
  } else {
    const rawSlices = partitionMonthIntoWeekSlices({ from, to });
    weekSlices = aggregateMonthWeekSlices(rawSlices, summaries);
  }

  const totalTargetMinutes = weekSlices.reduce((s, c) => s + c.targetMinutes, 0);
  const totalWorkdays = weekSlices.reduce((s, c) => s + c.workdaysCount, 0);

  const totalWorkMinutes: number =
    input.totals?.workMinutes ??
    (summaries.length > 0
      ? summaries.reduce<number>((s, d) => s + extractWorkMinutes(d), 0)
      : weekSlices.reduce<number>((s, w) => s + w.workMinutes, 0));

  const extractMinutesField = (item: unknown, key: string): number => {
    if (!item || typeof item !== "object") return 0;
    const rec = item as Record<string, unknown>;
    if (typeof rec[key] === "number") return rec[key] as number;
    const totalsRec = rec.totals as Record<string, unknown> | undefined;
    if (typeof totalsRec?.[key] === "number") return totalsRec[key] as number;
    return 0;
  };

  const totalBreakMinutes: number =
    input.totals?.breakMinutes ??
    summaries.reduce<number>((s, d) => s + extractMinutesField(d, "breakMinutes"), 0);

  const totalAttendanceMinutes: number =
    input.totals?.attendanceMinutes ??
    summaries.reduce<number>((s, d) => s + extractMinutesField(d, "attendanceMinutes"), 0);

  const totalDiffMinutes = totalWorkMinutes - totalTargetMinutes;
  const diff = formatDiffMinutes(totalDiffMinutes);
  const progressPct = calculateProgressPct(totalWorkMinutes, totalTargetMinutes);
  const monthLabel = formatMonthLabel(from);

  return {
    monthKey,
    monthLabel,
    from,
    to,
    totalWorkMinutes,
    workMinutes: totalWorkMinutes,
    formattedTotalLogged: formatHMM(totalWorkMinutes),
    totalBreakMinutes,
    breakMinutes: totalBreakMinutes,
    totalAttendanceMinutes,
    attendanceMinutes: totalAttendanceMinutes,
    totalTargetMinutes,
    targetMinutes: totalTargetMinutes,
    formattedTotalTarget: formatHMM(totalTargetMinutes),
    totalDiffMinutes,
    diffMinutes: totalDiffMinutes,
    formattedDiff: diff,
    diff,
    isAhead: diff.isAhead,
    isBehind: diff.isBehind,
    isExact: diff.isExact,
    progressPct,
    totalWorkdays,
    workdaysCount: totalWorkdays,
    daysTracked:
      input.totals?.daysTracked ??
      summaries.filter((d) => {
        if (!d || typeof d !== "object") return false;
        const rec = d as Record<string, unknown>;
        return (
          Boolean(rec.hasData) ||
          extractWorkMinutes(d) > 0 ||
          (rec.attendance !== null && rec.attendance !== undefined)
        );
      }).length,
    weekSlices,
    categoryBreakdown: input.byCategory ?? [],
  };
}

export const buildMonthlyProgress = buildMonthlyProgressDTO;

/**
 * Composes complete DashboardDataDTO. Supports both an options object or positional arguments.
 */
export function buildDashboardDTO(
  param1:
    | string
    | {
        anchorDate: string;
        timezone: string;
        daily?: DailyProgressDTO;
        weekly?: WeeklyProgressDTO;
        monthly?: MonthlyProgressDTO;
        daySummary?: DaySummaryDTO | null;
        dailySummary?: DaySummaryDTO | null;
        weekSummary?:
          | WeekSummary
          | {
              from: string;
              to: string;
              days?: readonly unknown[];
              totals?: {
                workMinutes: number;
                breakMinutes: number;
                attendanceMinutes: number;
                daysTracked: number;
              };
              byCategory?: CategoryTotalDTO[];
            };
        monthSummary?:
          | MonthSummary
          | {
              monthKey?: string;
              from?: string;
              to?: string;
              weekSlices?: MonthWeekSliceDTO[];
              summaries?: readonly unknown[];
              days?: readonly unknown[];
              totals?: {
                workMinutes: number;
                breakMinutes: number;
                attendanceMinutes: number;
                daysTracked: number;
              };
              byCategory?: CategoryTotalDTO[];
            };
      },
  param2?: string,
  param3?: DailyProgressDTO,
  param4?: WeeklyProgressDTO,
  param5?: MonthlyProgressDTO,
): DashboardDataDTO {
  if (typeof param1 === "object") {
    const {
      anchorDate,
      timezone,
      daily,
      weekly,
      monthly,
      daySummary,
      dailySummary,
      weekSummary,
      monthSummary,
    } = param1;

    const dailyDTO =
      daily ?? buildDailyProgressDTO(daySummary ?? dailySummary ?? null, anchorDate, timezone);
    const weeklyDTO =
      weekly ??
      (weekSummary
        ? buildWeeklyProgressDTO(weekSummary, anchorDate)
        : buildWeeklyProgressDTO({ from: anchorDate, to: anchorDate }, anchorDate));
    const monthlyDTO =
      monthly ??
      (monthSummary
        ? buildMonthlyProgressDTO(monthSummary, anchorDate.slice(0, 7))
        : buildMonthlyProgressDTO({ monthKey: anchorDate.slice(0, 7) }, anchorDate.slice(0, 7)));

    return {
      anchorDate,
      timezone,
      daily: dailyDTO,
      weekly: weeklyDTO,
      monthly: monthlyDTO,
    };
  }

  const anchorDate = param1;
  const timezone = param2 ?? "Asia/Jakarta";
  const daily = param3!;
  const weekly = param4!;
  const monthly = param5!;

  return {
    anchorDate,
    timezone,
    daily,
    weekly,
    monthly,
  };
}
