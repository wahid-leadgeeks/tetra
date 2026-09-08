import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FormattedDiff } from "@/features/dashboard/types";
import { formatHuman } from "@/lib/time";
import { cn } from "@/lib/utils";

export interface ProgressKpiCardProps {
  title: string;
  workMinutes: number;
  targetMinutes: number;
  diff: FormattedDiff;
  progressPct: number;
  subtext?: string;
  breakMinutes?: number;
  attendanceMinutes?: number;
  daysTracked?: number;
  workdaysCount?: number;
  icon?: LucideIcon;
  testId?: string;
  className?: string;
  onClick?: () => void;
}

export function ProgressKpiCard({
  title,
  workMinutes,
  targetMinutes,
  diff,
  progressPct,
  subtext,
  breakMinutes,
  attendanceMinutes,
  daysTracked,
  workdaysCount,
  icon: Icon,
  testId,
  className,
  onClick,
}: ProgressKpiCardProps) {
  const isClickable = Boolean(onClick);

  return (
    <Card
      data-testid={testId}
      onClick={onClick}
      className={cn(
        "group/kpi relative flex flex-col justify-between overflow-hidden border-border/80 bg-card p-5 shadow-xs transition-all",
        isClickable && "cursor-pointer hover:border-border hover:shadow-sm active:scale-[0.99]",
        className,
      )}
    >
      <CardHeader className="p-0 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {Icon && (
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Icon aria-hidden className="size-4" />
              </div>
            )}
            <CardTitle className="truncate font-heading text-sm font-semibold text-foreground">
              {title}
            </CardTitle>
          </div>

          <Badge
            data-testid={testId ? `${testId}-badge` : undefined}
            variant={diff.isExact ? "outline" : "default"}
            className={cn(
              "font-mono text-xs font-semibold tabular-nums select-none shrink-0",
              diff.isAhead &&
                "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 dark:bg-emerald-950/40",
              diff.isBehind &&
                "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 dark:bg-amber-950/40",
              diff.isExact && "border-border/80 bg-muted/50 text-muted-foreground",
            )}
          >
            {diff.formatted}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-0 grid gap-4">
        {/* Main metric row */}
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <span
              data-testid={testId ? `${testId}-work` : undefined}
              className="font-heading text-3xl font-bold tracking-tight text-foreground tabular-nums"
            >
              {formatHuman(workMinutes)}
            </span>
            <span className="text-sm font-medium text-muted-foreground tabular-nums">
              / {formatHuman(targetMinutes)}
            </span>
          </div>

          <span
            data-testid={testId ? `${testId}-pct` : undefined}
            className="font-heading text-sm font-bold text-foreground tabular-nums"
          >
            {progressPct}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted/80 shadow-inner">
          <div
            data-testid={testId ? `${testId}-progress-fill` : undefined}
            className={cn(
              "h-full rounded-full transition-all duration-500",
              diff.isAhead || progressPct >= 100
                ? "bg-emerald-500 shadow-xs shadow-emerald-500/40"
                : "bg-primary shadow-xs shadow-primary/30",
            )}
            style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
          />
        </div>

        {/* Supporting metadata */}
        {(subtext || breakMinutes !== undefined || daysTracked !== undefined || attendanceMinutes !== undefined) && (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground pt-1 border-t border-border/50">
            {subtext ? (
              <span className="truncate">{subtext}</span>
            ) : daysTracked !== undefined && workdaysCount !== undefined ? (
              <span className="tabular-nums">
                <strong className="font-semibold text-foreground">{daysTracked}</strong> of {workdaysCount} workdays
              </span>
            ) : attendanceMinutes !== undefined ? (
              <span className="tabular-nums">
                Attendance: {formatHuman(attendanceMinutes)}
              </span>
            ) : (
              <span />
            )}

            {breakMinutes !== undefined && (
              <span className="tabular-nums text-right">
                Break: {formatHuman(breakMinutes)}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
