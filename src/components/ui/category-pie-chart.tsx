"use client";

import { useMemo, useState } from "react";
import { getCategoryTheme } from "@/lib/categories";
import { formatHuman } from "@/lib/time";
import { cn } from "@/lib/utils";

export interface CategoryPieItem {
  key: string;
  name: string;
  minutes: number;
}

export interface CategoryPieChartProps {
  categories: CategoryPieItem[];
  totalMinutes?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  showCenterDetails?: boolean;
  centerTitle?: string;
  ariaLabel?: string;
  testId?: string;
}

const SIZE_CONFIG = {
  sm: {
    containerClass: "size-36",
    viewBox: 200,
    rOuter: 86,
    rInner: 58,
    primaryTextClass: "text-base font-bold",
    subTextClass: "text-[10px]",
    pctTextClass: "text-[10px]",
  },
  md: {
    containerClass: "size-44",
    viewBox: 200,
    rOuter: 88,
    rInner: 56,
    primaryTextClass: "text-lg font-bold",
    subTextClass: "text-[11px]",
    pctTextClass: "text-xs",
  },
  lg: {
    containerClass: "size-56",
    viewBox: 200,
    rOuter: 90,
    rInner: 56,
    primaryTextClass: "text-2xl font-bold",
    subTextClass: "text-xs",
    pctTextClass: "text-sm",
  },
};

export function getSlicePath(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startAngle: number,
  endAngle: number,
): string {
  const angleDiff = endAngle - startAngle;
  if (angleDiff >= Math.PI * 2 - 0.001) {
    return [
      `M ${cx} ${cy - rOuter}`,
      `A ${rOuter} ${rOuter} 0 1 1 ${cx} ${cy + rOuter}`,
      `A ${rOuter} ${rOuter} 0 1 1 ${cx} ${cy - rOuter}`,
      `M ${cx} ${cy - rInner}`,
      `A ${rInner} ${rInner} 0 1 0 ${cx} ${cy + rInner}`,
      `A ${rInner} ${rInner} 0 1 0 ${cx} ${cy - rInner}`,
      "Z",
    ].join(" ");
  }

  const x1 = cx + rOuter * Math.cos(startAngle);
  const y1 = cy + rOuter * Math.sin(startAngle);
  const x2 = cx + rOuter * Math.cos(endAngle);
  const y2 = cy + rOuter * Math.sin(endAngle);

  const x3 = cx + rInner * Math.cos(endAngle);
  const y3 = cy + rInner * Math.sin(endAngle);
  const x4 = cx + rInner * Math.cos(startAngle);
  const y4 = cy + rInner * Math.sin(startAngle);

  const largeArc = angleDiff > Math.PI ? 1 : 0;

  return [
    `M ${x1} ${y1}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4} ${y4}`,
    "Z",
  ].join(" ");
}

export interface CategorySliceData {
  key: string;
  name: string;
  shortName: string;
  minutes: number;
  pct: number;
  colorHex: string;
  pathD: string;
}

export function computeCategorySlices(
  categories: CategoryPieItem[],
  totalMinutes: number,
  rInner: number,
  rOuter: number,
  cx: number = 100,
  cy: number = 100,
): CategorySliceData[] {
  const activeCategories = categories.filter((c) => c.minutes > 0);
  if (totalMinutes <= 0 || activeCategories.length === 0) {
    return [];
  }

  let currentAngle = -Math.PI / 2;
  return activeCategories.map((cat) => {
    const fraction = cat.minutes / totalMinutes;
    const angleDelta = fraction * Math.PI * 2;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angleDelta;
    currentAngle = endAngle;

    const theme = getCategoryTheme(cat.key || cat.name);
    const pct = Math.round(fraction * 100);
    const pathD = getSlicePath(cx, cy, rInner, rOuter, startAngle, endAngle);

    return {
      key: cat.key,
      name: cat.name,
      shortName: theme.shortName || cat.name,
      minutes: cat.minutes,
      pct,
      colorHex: theme.colorHex,
      pathD,
    };
  });
}

/**
 * Clean SVG Donut / Pie chart displaying time distribution by category.
 * Features calm aesthetics, slice highlight transitions, accessible titles,
 * and interactive center summaries.
 */
export function CategoryPieChart({
  categories,
  totalMinutes,
  size = "md",
  className,
  showCenterDetails = true,
  centerTitle = "Total Work",
  ariaLabel = "Category time distribution pie chart",
  testId = "category-pie-chart",
}: CategoryPieChartProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const activeCategories = useMemo(
    () => categories.filter((c) => c.minutes > 0),
    [categories],
  );

  const computedTotalMinutes = useMemo(() => {
    if (typeof totalMinutes === "number" && totalMinutes > 0) {
      return totalMinutes;
    }
    return activeCategories.reduce((acc, c) => acc + c.minutes, 0);
  }, [totalMinutes, activeCategories]);

  const cfg = SIZE_CONFIG[size];
  const cx = cfg.viewBox / 2;
  const cy = cfg.viewBox / 2;

  // Compute slice angles starting at 12 o'clock (-PI / 2)
  const slices = useMemo(() => {
    return computeCategorySlices(
      activeCategories,
      computedTotalMinutes,
      cfg.rInner,
      cfg.rOuter,
      cx,
      cy,
    );
  }, [activeCategories, computedTotalMinutes, cx, cy, cfg.rInner, cfg.rOuter]);

  const activeHoveredSlice = useMemo(() => {
    if (!hoveredKey) return null;
    return slices.find((s) => s.key === hoveredKey) ?? null;
  }, [hoveredKey, slices]);

  return (
    <div
      className={cn("flex flex-col items-center justify-center relative", className)}
      data-testid={testId}
    >
      <div className={cn("relative flex items-center justify-center", cfg.containerClass)}>
        <svg
          viewBox={`0 0 ${cfg.viewBox} ${cfg.viewBox}`}
          className="size-full overflow-visible transition-all"
          role="img"
          aria-label={ariaLabel}
        >
          {slices.length === 0 ? (
            /* Empty state ring */
            <circle
              cx={cx}
              cy={cy}
              r={(cfg.rOuter + cfg.rInner) / 2}
              fill="none"
              stroke="currentColor"
              strokeWidth={cfg.rOuter - cfg.rInner}
              className="text-muted/40"
            />
          ) : (
            /* Category Slices */
            slices.map((slice) => {
              const isHovered = hoveredKey === slice.key;
              const hasHover = hoveredKey !== null;
              const isDimmed = hasHover && !isHovered;

              return (
                <path
                  key={slice.key}
                  d={slice.pathD}
                  fill={slice.colorHex}
                  stroke="currentColor"
                  strokeWidth={slices.length > 1 ? 2 : 0}
                  className={cn(
                    "text-card transition-all duration-200 cursor-pointer outline-none",
                    isHovered
                      ? "opacity-100 brightness-110 drop-shadow-sm filter"
                      : isDimmed
                        ? "opacity-40"
                        : "opacity-95 hover:opacity-100",
                  )}
                  style={{
                    transformOrigin: `${cx}px ${cy}px`,
                    transform: isHovered ? "scale(1.03)" : "scale(1)",
                  }}
                  onMouseEnter={() => setHoveredKey(slice.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  role="graphics-symbol"
                  aria-label={`${slice.name}: ${formatHuman(slice.minutes)} (${slice.pct}%)`}
                >
                  <title>
                    {slice.name}: {formatHuman(slice.minutes)} ({slice.pct}%)
                  </title>
                </path>
              );
            })
          )}
        </svg>

        {/* Center Donut Hole Details */}
        {showCenterDetails && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-2 select-none"
            aria-hidden="true"
          >
            {activeHoveredSlice ? (
              <div className="flex flex-col items-center justify-center animate-in fade-in zoom-in-90 duration-150">
                <span className={cn("text-muted-foreground truncate max-w-[80px]", cfg.subTextClass)}>
                  {activeHoveredSlice.shortName}
                </span>
                <span className={cn("tabular-nums text-foreground leading-tight", cfg.primaryTextClass)}>
                  {formatHuman(activeHoveredSlice.minutes)}
                </span>
                <span
                  className={cn("font-semibold leading-tight", cfg.pctTextClass)}
                  style={{ color: activeHoveredSlice.colorHex }}
                >
                  {activeHoveredSlice.pct}%
                </span>
              </div>
            ) : computedTotalMinutes > 0 ? (
              <div className="flex flex-col items-center justify-center">
                <span className={cn("text-muted-foreground", cfg.subTextClass)}>
                  {centerTitle}
                </span>
                <span className={cn("tabular-nums text-foreground leading-tight", cfg.primaryTextClass)}>
                  {formatHuman(computedTotalMinutes)}
                </span>
                <span className={cn("text-muted-foreground font-medium", cfg.subTextClass)}>
                  {activeCategories.length} {activeCategories.length === 1 ? "cat" : "cats"}
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center">
                <span className={cn("text-muted-foreground/60 font-medium", cfg.subTextClass)}>
                  No activity
                </span>
                <span className={cn("tabular-nums text-muted-foreground/40", cfg.primaryTextClass)}>
                  0m
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
