"use client";

import { Calendar, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatSliceDateRange } from "@/features/dashboard/domain";
import type { MonthWeekSliceDTO, MonthlyProgressDTO } from "@/features/dashboard/types";
import { cn } from "@/lib/utils";

export interface PersonalWeeklyReportTableProps {
  monthly: MonthlyProgressDTO;
  onSelectWeek?: (slice: MonthWeekSliceDTO) => void;
  className?: string;
}

export function PersonalWeeklyReportTable({
  monthly,
  onSelectWeek,
  className,
}: PersonalWeeklyReportTableProps) {
  const totalRangeLabel = formatSliceDateRange(monthly.from, monthly.to);

  return (
    <Card
      data-testid="personal-weekly-report-table"
      className={cn("overflow-hidden border-border/80 bg-card shadow-xs", className)}
    >
      <CardHeader className="border-b border-border/60 bg-muted/20 px-5 py-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Calendar aria-hidden className="size-4.5 text-primary" />
              <CardTitle className="font-heading text-base font-semibold tracking-tight text-foreground">
                Personal Weekly Report & Target
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Google Sheet rows 44–55 faithful breakdown for {monthly.monthLabel}
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 pt-1 sm:pt-0">
            <span className="text-xs text-muted-foreground">
              Total Target:{" "}
              <strong className="font-mono font-semibold text-foreground">
                {monthly.formattedTotalTarget}
              </strong>
            </span>
            <span className="text-xs text-muted-foreground">({monthly.totalWorkdays} workdays)</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Personal Weekly Report and Target for {monthly.monthLabel}
            </caption>
            <thead>
              <tr className="border-b border-border/60 bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="py-3 pl-5 pr-3">
                  Period
                </th>
                <th scope="col" className="px-3 py-3">
                  Date Range
                </th>
                <th scope="col" className="px-3 py-3 text-right">
                  Target
                </th>
                <th scope="col" className="px-3 py-3 text-right">
                  Logged Time
                </th>
                <th scope="col" className="px-3 py-3 text-center">
                  Diff
                </th>
                <th scope="col" className="py-3 pl-3 pr-5 text-right min-w-[140px]">
                  Progress
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border/50">
              {monthly.weekSlices.map((slice) => {
                const isClickable = Boolean(onSelectWeek);

                return (
                  <tr
                    key={slice.weekIndex}
                    data-testid={`week-slice-${slice.weekIndex}`}
                    onClick={() => onSelectWeek?.(slice)}
                    className={cn(
                      "group transition-colors",
                      isClickable
                        ? "cursor-pointer hover:bg-muted/40 active:bg-muted/60"
                        : "hover:bg-muted/20",
                    )}
                  >
                    {/* Period label */}
                    <td className="py-3.5 pl-5 pr-3 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <span className="font-heading font-semibold text-xs tracking-wider text-primary">
                          {slice.label}
                        </span>
                        {isClickable && (
                          <ChevronRight
                            aria-hidden
                            className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                          />
                        )}
                      </div>
                    </td>

                    {/* Date Range */}
                    <td className="px-3 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                      {slice.dateRangeLabel}
                      <span className="ml-1 text-[11px] opacity-70">
                        ({slice.workdaysCount} {slice.workdaysCount === 1 ? "day" : "days"})
                      </span>
                    </td>

                    {/* Target Time */}
                    <td className="px-3 py-3.5 text-right font-mono text-xs font-medium text-muted-foreground tabular-nums whitespace-nowrap">
                      {slice.formattedTarget}
                    </td>

                    {/* Logged Time */}
                    <td className="px-3 py-3.5 text-right font-mono text-xs font-semibold text-foreground tabular-nums whitespace-nowrap">
                      {slice.formattedLogged}
                    </td>

                    {/* Diff badge */}
                    <td className="px-3 py-3.5 text-center whitespace-nowrap">
                      <Badge
                        data-testid={`week-slice-${slice.weekIndex}-diff`}
                        variant={slice.diff.isExact ? "outline" : "default"}
                        className={cn(
                          "font-mono text-xs font-semibold tabular-nums",
                          slice.diff.isAhead &&
                            "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 dark:bg-emerald-950/40",
                          slice.diff.isBehind &&
                            "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 dark:bg-amber-950/40",
                          slice.diff.isExact && "border-border/80 bg-muted/50 text-muted-foreground",
                        )}
                      >
                        {slice.diff.formatted}
                      </Badge>
                    </td>

                    {/* Progress Bar & Percentage */}
                    <td className="py-3.5 pl-3 pr-5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-3">
                        <div className="h-2 w-20 sm:w-28 overflow-hidden rounded-full bg-muted/80 shadow-inner">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-300",
                              slice.diff.isAhead || slice.progressPct >= 100
                                ? "bg-emerald-500 shadow-xs shadow-emerald-500/30"
                                : "bg-primary shadow-xs shadow-primary/30",
                            )}
                            style={{ width: `${Math.min(100, Math.max(0, slice.progressPct))}%` }}
                          />
                        </div>
                        <span
                          data-testid={`week-slice-${slice.weekIndex}-progress`}
                          className="font-mono text-xs font-semibold text-foreground tabular-nums w-10 text-right"
                        >
                          {slice.progressPct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Total Row */}
            <tfoot className="border-t-2 border-border/80 bg-muted/30 font-semibold">
              <tr data-testid="total-row" className="hover:bg-muted/40">
                <td className="py-3.5 pl-5 pr-3 font-heading text-xs font-bold uppercase tracking-wider text-foreground">
                  TOTAL
                </td>
                <td className="px-3 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                  {totalRangeLabel}
                  <span className="ml-1 text-[11px] opacity-70">
                    ({monthly.totalWorkdays} days)
                  </span>
                </td>
                <td className="px-3 py-3.5 text-right font-mono text-xs font-bold text-muted-foreground tabular-nums whitespace-nowrap">
                  {monthly.formattedTotalTarget}
                </td>
                <td className="px-3 py-3.5 text-right font-mono text-xs font-bold text-foreground tabular-nums whitespace-nowrap">
                  {monthly.formattedTotalLogged}
                </td>
                <td className="px-3 py-3.5 text-center whitespace-nowrap">
                  <Badge
                    data-testid="total-diff"
                    variant={monthly.diff.isExact ? "outline" : "default"}
                    className={cn(
                      "font-mono text-xs font-bold tabular-nums",
                      monthly.diff.isAhead &&
                        "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 dark:bg-emerald-950/40",
                      monthly.diff.isBehind &&
                        "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 dark:bg-amber-950/40",
                      monthly.diff.isExact && "border-border/80 bg-muted/50 text-muted-foreground",
                    )}
                  >
                    {monthly.diff.formatted}
                  </Badge>
                </td>
                <td className="py-3.5 pl-3 pr-5 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-3">
                    <div className="h-2.5 w-20 sm:w-28 overflow-hidden rounded-full bg-muted/80 shadow-inner">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          monthly.diff.isAhead || monthly.progressPct >= 100
                            ? "bg-emerald-500 shadow-xs shadow-emerald-500/30"
                            : "bg-primary shadow-xs shadow-primary/30",
                        )}
                        style={{ width: `${Math.min(100, Math.max(0, monthly.progressPct))}%` }}
                      />
                    </div>
                    <span
                      data-testid="total-progress"
                      className="font-mono text-xs font-bold text-foreground tabular-nums w-10 text-right"
                    >
                      {monthly.progressPct}%
                    </span>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
