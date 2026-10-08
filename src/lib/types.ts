/**
 * Shared DTOs — the contract between API routes and UI.
 * Both feature agents and UI agents code against these shapes.
 */

export type EntryStatus = "active" | "paused" | "completed";
export type EntrySource = "timer" | "manual";
export type AttendanceStatus = "open" | "closed";
export type ReviewState =
  | "draft"
  | "ready"
  | "reviewed"
  | "synced"
  | "changed_after_sync";

export interface CategoryDTO {
  id: string;
  key: string;
  name: string;
  sortOrder: number;
}

export type TaskStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "blocked"
  | "review"
  | "done"
  | "cancelled";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface TaskDTO {
  id: string;
  name: string;
  categoryId: string;
  categoryKey?: string;
  categoryName?: string;
  status: TaskStatus;
  priority?: TaskPriority;
  description?: string | null;
  isFavorite: boolean;
  dueAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  lastUsedAt: string | null;
  createdAt?: string;
}

/** Task fields carried on an entry so entry-based UIs can show/edit task details. */
export interface EntryTaskDetailsDTO {
  categoryId: string; // the task's own category (may differ from the entry's)
  status: TaskStatus;
  priority: TaskPriority;
  description: string | null;
  dueAt: string | null;
  isFavorite: boolean;
}

export interface TimeEntryDTO {
  id: string;
  taskId: string;
  taskName: string;
  categoryId: string;
  categoryKey: string;
  categoryName: string;
  startedAt: string;
  endedAt: string | null;
  status: EntryStatus;
  notes: string | null;
  source: EntrySource;
  /** Server-calculated minutes, paused time excluded. Null while active. */
  durationMinutes: number | null;
  /** Paused seconds banked server-side (excludes an open pause span). */
  pausedSeconds: number;
  /** Start of the currently open pause; null unless status is "paused". */
  pausedAt: string | null;
  /** Details of the entry's task; optional so fixtures and reports can omit it. */
  taskDetails?: EntryTaskDetailsDTO;
}

export interface BreakDTO {
  id: string;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
}

export interface AttendanceDTO {
  id: string;
  workDate: string;
  clockInAt: string;
  clockOutAt: string | null;
  status: AttendanceStatus;
  activeBreak: BreakDTO | null;
  breaks: BreakDTO[];
  breakMinutes: number;
}

export interface CategoryTotalDTO {
  categoryId: string;
  key: string;
  name: string;
  minutes: number;
}

export type DayWarning =
  | { type: "overlap"; message: string; entryIds: [string, string] }
  | { type: "gap"; message: string; minutes: number }
  | { type: "open_task"; message: string }
  | { type: "missing_clock_out"; message: string }
  | { type: "no_work"; message: string }
  | { type: "short_break"; message: string; breakId: string; seconds: number };

export interface DaySummaryDTO {
  workDate: string;
  attendance: AttendanceDTO | null;
  timeEntries: TimeEntryDTO[];
  totals: {
    attendanceMinutes: number;
    breakMinutes: number;
    workMinutes: number;
  };
  byCategory: CategoryTotalDTO[];
  warnings: DayWarning[];
  reviewState: ReviewState;
}

/**
 * Day summary as served by `getDaySummary` (GET /api/days/[date]): the plain
 * `DaySummaryDTO` plus whether the day has changes newer than its last sheet
 * sync. Kept separate so `DaySummaryDTO` fixtures and batch builders are
 * unaffected.
 */
export type DaySummaryWithSyncDTO = DaySummaryDTO & {
  needsSync: boolean;
  /** ISO instant of the last successful sync, or null if never synced. */
  lastSyncedAt: string | null;
};

export interface SyncCellDTO {
  a1: string;
  value: string;
  columnLabel: string;
  /** "notes" marks a compiled category-notes cell (editable in the preview). */
  cellType?: "value" | "notes";
  /** Present on notes cells: the category the compiled notes belong to. */
  categoryKey?: string;
}

export interface SyncPreviewDTO {
  workDate: string;
  rowNumber: number | null;
  cells: SyncCellDTO[];
}

export interface SyncLogDTO {
  id: string;
  workDate: string;
  status: "pending" | "success" | "failed";
  changedCells: { a1: string; value: string }[];
  errorMessage: string | null;
  createdAt: string;
}
