# Implementation Plan: Dashboard Page for Daily, Weekly, and Monthly Progress

## Goal Description

Add a dedicated **Dashboard** page (`/dashboard`) to TETRA that provides a clear, high-level overview of employee time-tracking progress across three time horizons: **Daily**, **Weekly**, and **Monthly**.

Based on user requirements and the official Google Sheet:
1. **Daily Progress**: Tracks work time vs. the standard daily target (**8:00 hours / 480 minutes**), break time, and daily diff (+ / -).
2. **Weekly Progress**: Tracks work time vs. weekly target (**workdays in the week × 8:00**, e.g., 40:00 for a standard 5-day week), diff, and daily distribution across Monday–Sunday.
3. **Monthly Progress & Personal Weekly Report**: Directly reproduces the logic and visibility of the **PERSONAL WEEKLY REPORT & TARGET** table (Image 2 from rows 44–55 of the Google Sheet):
   - Partitions the selected month into calendar-week slices (e.g., Week 1: Sep 1–4 [4 workdays = 32:00], Week 2: Sep 7–11 [5 workdays = 40:00], ..., Week 5: Sep 28–30 [3 workdays = 24:00], Total: 22 workdays = 176:00).
   - Shows for each week: **Target Time**, **Logged Time**, **Diff** (with color-coded positive/negative styling), and **Progress %**.
   - Calculates the overall monthly target, total logged time, diff vs. target, and category distribution.
4. **Layout & Focus**:
   - Provide an all-in-one **Overview** tab that surfaces Daily, Weekly, and Monthly summaries at a glance, alongside dedicated tabs for **Daily**, **Weekly**, and **Monthly** deep dives.
   - Strictly focus on **Time & Task Tracking** (lead gen is excluded per user confirmation).

---

## Component Checklist Audit & Integration

Below is the detailed inspection of the user's component checklist against TETRA's codebase and how each component will be used/formalized for the Dashboard:

```text
components/
├── ui/
│   ├── Button       → [EXISTS] src/components/ui/button.tsx
│   ├── Input        → [EXISTS] src/components/ui/input.tsx
│   ├── Card         → [EXISTS] src/components/ui/card.tsx
│   ├── Badge        → [EXISTS] src/components/ui/badge.tsx & category-badge.tsx
│   ├── Modal        → [EXISTS] src/components/ui/dialog.tsx (Radix Dialog modal)
│   ├── Tooltip      → [ADD]    src/components/ui/tooltip.tsx (Radix Tooltip wrapper)
│   └── Toast        → [EXISTS] src/components/ui/sonner.tsx (Sonner toaster)
│
├── navigation/
│   ├── Navbar       → [EXISTS] src/components/app-nav/app-nav.tsx (MobileNav)
│   ├── Sidebar      → [EXISTS] src/components/app-nav/app-nav.tsx (SidebarNav)
│   ├── Breadcrumb   → [ADD]    Dashboard header orientation & breadcrumb trail
│   └── Tabs         → [EXISTS] src/components/ui/tabs.tsx (Radix Tabs)
│
├── feedback/
│   ├── Loading      → [EXISTS] Inline Loader2 spinner + Lucide animations
│   ├── Skeleton     → [ADD]    src/components/ui/skeleton.tsx (shadcn skeleton)
│   ├── EmptyState   → [EXISTS] Standardized empty state card for zero-data days/weeks
│   ├── ErrorState   → [EXISTS] Standardized error card with retry button
│   └── SuccessState → [EXISTS] Target reached completion badge ("Completed! 🎉")
│
├── forms/
│   ├── TextField    → [EXISTS] src/components/ui/input.tsx & textarea.tsx
│   ├── Select       → [EXISTS] src/components/ui/select.tsx
│   ├── Checkbox     → [AVAILABLE] Radix Checkbox primitive available in package
│   └── DatePicker   → [EXISTS] Quick workday stepper + input[type=date] in day-navigator
│
└── layout/
    ├── Container    → [EXISTS] Responsive container utility classes in layout.tsx
    ├── Stack        → [EXISTS] flex flex-col gap-* spacing scales
    ├── Grid         → [EXISTS] CSS Grid (12-column responsive layout)
    └── Page         → [EXISTS] AppLayout shell in src/app/(app)/layout.tsx
```

### Planned UI Additions for the Checklist:
1. **`src/components/ui/skeleton.tsx`**: Add shadcn `Skeleton` primitive component to provide unified loading placeholder states for dashboard KPI cards, progress bars, and the weekly report table.
2. **`src/components/ui/tooltip.tsx`**: Add `Tooltip` primitive component (wrapping `radix-ui`'s `Tooltip`) to display helpful metric hints (e.g., explaining target breakdown or diff calculation on hover).

---

## User Decisions Aligned

> [!NOTE]
> **Aligned Decisions:**
> 1. **Multi-View Navigation**: The Dashboard provides both a unified **Overview** view (Daily KPI + Weekly KPI + Monthly KPI + Personal Weekly Report table) and dedicated tabs for **Daily**, **Weekly**, and **Monthly** focus.
> 2. **Scope**: Focused solely on **Time & Task Tracking** (lead gen columns from the sheet are omitted).
> 3. **Week Slice Math**: Exactly matches the sheet's partition logic:
>    - September 2026 Week 1: 4 workdays = **32:00**
>    - Weeks 2, 3, 4: 5 workdays = **40:00** each
>    - Week 5: 3 workdays = **24:00**
>    - Total Month Target = **176:00** (22 workdays × 8h)
> 4. **Navigation**: Placed at item `2` (`/dashboard`, shortcut `2`) in desktop sidebar and mobile bottom nav.

---

## Proposed Changes

### UI Primitives Layer

#### [NEW] `src/components/ui/skeleton.tsx`
Standard shadcn/ui skeleton primitive for animated placeholder loading:
```tsx
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-muted animate-pulse rounded-md", className)}
      {...props}
    />
  );
}

export { Skeleton };
```

#### [NEW] `src/components/ui/tooltip.tsx`
Radix Tooltip wrapper for metric explanations:
```tsx
"use client";

import * as React from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

function TooltipContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "bg-primary text-primary-foreground animate-in fade-in-0 zoom-in-95 z-50 overflow-hidden rounded-md px-3 py-1.5 text-xs font-medium shadow-md",
          className
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
```

---

### Feature Layer: Dashboard Domain & Service

#### [NEW] `src/features/dashboard/types.ts`
Define strong TypeScript interfaces for dashboard calculations and DTOs:
- `DailyProgressDTO`: Date, work minutes, break minutes, target minutes (480 for workdays), diff minutes (`work - target`), formatted diff, progress percentage, attendance window, category breakdown.
- `WeekDayProgressDTO`: Work date, weekday name, is workday, work minutes, break minutes, target minutes, diff minutes, has data.
- `WeeklyProgressDTO`: Range (`from`, `to`), week number, total work minutes, target minutes, diff minutes, progress percentage, days tracked, day list, category breakdown.
- `MonthWeekSliceDTO`: Week index (1..5+), label ("WEEK 1", "WEEK 2", etc.), date range, workdays count, work minutes, target minutes, diff minutes, progress percentage.
- `MonthlyProgressDTO`: Month key (`YYYY-MM`), month label ("September 2026"), total work minutes, total break minutes, total target minutes, total diff minutes, progress percentage, workdays count, days tracked, week slices (`MonthWeekSliceDTO[]`), category breakdown.
- `DashboardDataDTO`: Anchor date, timezone, daily progress, weekly progress, monthly progress.

#### [NEW] `src/features/dashboard/domain.ts`
Pure domain functions (deterministic, zero DB, zero system clock dependency):
- `partitionMonthIntoWeekSlices(monthKey: string)`:
  - Finds the start (1st) and end of the month.
  - Slices days into Monday–Sunday blocks bounded by the month.
  - Counts workdays (Monday–Friday) per slice.
  - Computes `targetMinutes = workdays * 480`.
- `formatDiffMinutes(diffMinutes: number): { formatted: string; isAhead: boolean; isBehind: boolean; isExact: boolean }`:
  - Formats with explicit sign: `+1:15`, `-34:00`, `0:00`.
- `calculateProgressPct(workMinutes: number, targetMinutes: number): number`:
  - Returns true percentage (clamped to 100 for progress bar, exact for label).
- `buildDashboardDTO(...)`: Pure composition of daily summary, weekly summary, and monthly week slices.

#### [NEW] `src/features/dashboard/service.ts`
Server-side service:
- `getDashboardData(userId: string, anchorDate: string, timezone: string): Promise<DashboardDataDTO>`:
  - Fetches the daily summary for `anchorDate` via `getDaySummary()`.
  - Fetches the ISO week summary via `getWeekSummary()`.
  - Fetches the month summary via `getMonthSummary()`.
  - Runs pure domain aggregation to produce the complete `DashboardDataDTO`.

#### [NEW] `src/features/dashboard/domain.test.ts`
Unit test suite verifying:
- September 2026 week slice targets matching Image 2 exactly:
  - Week 1 (Tue Sep 1 – Sun Sep 6): 4 workdays = 32h (1,920 min).
  - Week 2 (Mon Sep 7 – Sun Sep 13): 5 workdays = 40h (2,400 min).
  - Week 3 (Mon Sep 14 – Sun Sep 20): 5 workdays = 40h (2,400 min).
  - Week 4 (Mon Sep 21 – Sun Sep 27): 5 workdays = 40h (2,400 min).
  - Week 5 (Mon Sep 28 – Wed Sep 30): 3 workdays = 24h (1,440 min).
  - Total Month: 22 workdays = 176h (10,560 min).
- Diff calculations (positive, negative, zero).
- Edge-case month boundaries (e.g., month starting on Sunday, leap February).

---

### UI Layer: Dashboard Route & Components

#### [NEW] `src/app/(app)/dashboard/page.tsx`
Server Component for `/dashboard`:
- Authenticates session with NextAuth.
- Parses optional `?date=YYYY-MM-DD` and `?tab=overview|daily|weekly|monthly` search parameters.
- Calls `getDashboardData(userId, date, timezone)` server-side.
- Renders `DashboardView`.

#### [NEW] `src/components/dashboard/dashboard-view.tsx`
Client view component with interactive tab switching and date navigation:
- Tabs: **Overview**, **Daily**, **Weekly**, **Monthly**.
- Header controls: Date navigation (Previous, Next, Today), date picker jump, and active period label.
- Renders the responsive KPI summary cards, progress bars, and breakdown sections.

#### [NEW] `src/components/dashboard/progress-kpi-card.tsx`
Reusable KPI card:
- Displays **Work Time** vs. **Target Time**.
- Prominent **Diff badge** (color-coded: emerald for ahead/completed, amber/rose for deficit, neutral for exact).
- Progress bar with percentage completion.
- Supporting metadata (Break time, workdays count, pace).

#### [NEW] `src/components/dashboard/personal-weekly-report-table.tsx`
Faithful, modern reproduction of the **PERSONAL WEEKLY REPORT** table from Image 2:
- Renders table with columns:
  - **Period**: `WEEK 1`, `WEEK 2`, `WEEK 3`, `WEEK 4`, `WEEK 5`
  - **Date Range**: e.g., `Sep 1 – Sep 6`
  - **Target**: `32:00`, `40:00`, etc.
  - **Logged Time**: `32:00`, `6:00`, etc.
  - **Diff**: `0:00`, `-34:00`, etc. (with color-coded badge)
  - **Progress**: Visual progress bar + percentage
- **Total Row**: Total Logged Time (`38:00`), Total Target (`176:00`), Total Diff (`-138:00`), Overall Completion %.
- Clickable week rows allowing direct navigation to that week's detailed summary.

#### [NEW] `src/components/dashboard/daily-progress-section.tsx`
Detailed Daily Progress view:
- Attendance card (Clock In → Clock Out, open breaks, active tracking).
- Time logged vs. 8:00 daily target with projected wrap-up time.
- Category distribution bar with badges.
- Quick navigation shortcuts: "Go to Today", "Fix on Timeline", "Review & Sync".

#### [NEW] `src/components/dashboard/weekly-progress-section.tsx`
Detailed Weekly Progress view:
- Day-by-day card grid (Monday through Sunday):
  - Work time vs. 8h target per day.
  - Status indicator (Completed, In Progress, Incomplete, Weekend).
- Weekly category distribution bar and breakdown list.

---

### App Shell & Navigation Layer

#### [MODIFY] `src/components/app-nav/app-nav.tsx`
- Add `Dashboard` to `NAV_ITEMS`:
  ```ts
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    testId: "nav-dashboard",
    shortcut: "2",
  }
  ```
- Adjust shortcuts and ordering:
  - 1: Today (`/`)
  - 2: Dashboard (`/dashboard`)
  - 3: Timeline (`/timeline`)
  - 4: Tasks (`/tasks`)
  - 5: Reports (`/reports`)
  - 6: Settings (`/settings`)
- Update mobile bottom navigation grid layout (`grid-cols-6`) with responsive icon/text sizing.

#### [MODIFY] `src/components/keyboard/keyboard-nav.tsx`
- Update `SCREEN_SHORTCUTS` to map `"1"` through `"6"` so pressing `2` navigates directly to `/dashboard`.

#### [MODIFY] `src/components/keyboard/shortcuts-dialog.tsx`
- Update help modal shortcut range from `1–5` to `1–6`.

---

## Verification Plan

### Automated Tests
1. **Unit tests for Dashboard domain logic**:
   ```bash
   pnpm test src/features/dashboard/domain.test.ts
   ```
2. **Full test suite**:
   ```bash
   pnpm test
   ```
3. **Typecheck & Lint**:
   ```bash
   pnpm lint
   pnpm typecheck
   ```
4. **Production build verification**:
   ```bash
   pnpm build
   ```

### Manual Verification
1. **Navigate to `/dashboard`**:
   - Verify that clicking "Dashboard" in the sidebar (or pressing `2`) navigates to `/dashboard`.
   - Verify that mobile bottom nav renders all 6 icons cleanly and navigates properly.
2. **Verify Progress Metrics against Spreadsheet (September 2026)**:
   - Navigate to September 2026 in the dashboard.
   - Verify that Week 1 target is `32:00` (4 workdays).
   - Verify that Week 2–4 targets are `40:00` (5 workdays each).
   - Verify that Week 5 target is `24:00` (3 workdays).
   - Verify that Month total target is `176:00` (22 workdays).
   - Verify that the diff calculations display matching positive/negative formatting (e.g., `-34:00`, `0:00`, `-138:00`).
3. **Verify Tab & Date Switching**:
   - Switch between Overview, Daily, Weekly, and Monthly tabs.
   - Navigate backwards and forwards through dates/weeks/months and verify data updates seamlessly.
