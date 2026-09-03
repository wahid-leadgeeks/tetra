/**
 * Pure activity-timer domain logic. No database, no clock access —
 * every "now" is injected. Durations are always computed server-side
 * (AGENTS.md) from stored timestamps, never trusted from clients.
 */
import { zonedClock } from "@/lib/time";
import type {
  CategoryDTO,
  EntrySource,
  EntryStatus,
  TaskDTO,
  TimeEntryDTO,
} from "@/lib/types";

/** Row-shaped time entry (structurally compatible with the Drizzle row). */
export interface TimeEntryCore {
  id: string;
  taskId: string;
  categoryId: string;
  startedAt: Date;
  endedAt: Date | null;
  status: EntryStatus;
  pausedAt: Date | null;
  pausedSeconds: number;
  notes: string | null;
  source: EntrySource;
}

/** A time entry annotated with its task name, as overlap messages need it. */
export type OverlapEntry = TimeEntryCore & { taskName: string };

/** One overlapping pair; message follows the DESIGN.md error language. */
export interface OverlapConflict {
  entryIds: [string, string];
  message: string;
}

/** Thrown when a candidate entry conflicts with stored entries. */
export class OverlapError extends Error {
  readonly details: OverlapConflict[];

  constructor(details: OverlapConflict[]) {
    super(details[0]?.message ?? "Two activities overlap");
    this.name = "OverlapError";
    this.details = details;
  }
}

/**
 * Work minutes for an entry: wall span minus paused time.
 * Open pauses (status "paused") subtract `now − pausedAt` on top of
 * accumulated `pausedSeconds`. Floored to whole minutes, never negative.
 */
export function entryDurationMinutes(entry: TimeEntryCore, now: Date): number {
  const end = entry.endedAt ?? now;
  const openPauseMs =
    entry.status === "paused" && entry.pausedAt !== null
      ? Math.max(0, now.getTime() - entry.pausedAt.getTime())
      : 0;
  const netMs =
    end.getTime() -
    entry.startedAt.getTime() -
    entry.pausedSeconds * 1000 -
    openPauseMs;
  return Math.max(0, Math.floor(netMs / 60_000));
}

interface TimeRange {
  taskName?: string;
  startedAt: Date;
  endedAt: Date;
}

function rangeLabel(range: TimeRange, timeZone: string): string {
  const clock = `${zonedClock(range.startedAt, timeZone)}–${zonedClock(
    range.endedAt,
    timeZone,
  )}`;
  return range.taskName === undefined ? clock : `${range.taskName} ${clock}`;
}

function overlapMessage(a: TimeRange, b: TimeRange, timeZone: string): string {
  return `Two activities overlap: ${rangeLabel(a, timeZone)} / ${rangeLabel(
    b,
    timeZone,
  )}`;
}

/**
 * All overlapping pairs among `entries`. Intervals are half-open
 * [startedAt, endedAt); a running entry (endedAt null) extends until `now`.
 * Adjacent ranges (one ending exactly when the next starts) do not overlap.
 */
export function detectOverlaps(
  entries: readonly OverlapEntry[],
  timeZone: string,
  now: Date,
): OverlapConflict[] {
  const conflicts: OverlapConflict[] = [];
  const sorted = [...entries].sort(
    (a, b) => a.startedAt.getTime() - b.startedAt.getTime(),
  );
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      const first = sorted[i];
      const second = sorted[j];
      const firstEnd = first.endedAt ?? now;
      const secondEnd = second.endedAt ?? now;
      const overlaps =
        first.startedAt.getTime() < secondEnd.getTime() &&
        second.startedAt.getTime() < firstEnd.getTime();
      if (!overlaps) continue;
      conflicts.push({
        entryIds: [first.id, second.id],
        message: overlapMessage(
          {
            taskName: first.taskName,
            startedAt: first.startedAt,
            endedAt: firstEnd,
          },
          {
            taskName: second.taskName,
            startedAt: second.startedAt,
            endedAt: secondEnd,
          },
          timeZone,
        ),
      });
    }
  }
  return conflicts;
}

/**
 * Assert that `candidate` does not intersect any of `entries`
 * (an entry with the candidate's own id is ignored). Throws
 * {@link OverlapError} naming every conflicting range, rendered in
 * `timeZone`. Running entries extend until `now`.
 */
export function validateNoOverlap(
  candidate: {
    id?: string;
    taskName?: string;
    startedAt: Date;
    endedAt: Date;
  },
  entries: readonly TimeEntryCore[],
  taskNamesById: ReadonlyMap<string, string>,
  timeZone: string,
  now: Date,
): void {
  const conflicts: OverlapConflict[] = [];
  for (const entry of entries) {
    if (entry.id === candidate.id) continue;
    const entryEnd = entry.endedAt ?? now;
    const overlaps =
      candidate.startedAt.getTime() < entryEnd.getTime() &&
      entry.startedAt.getTime() < candidate.endedAt.getTime();
    if (!overlaps) continue;
    const candidateRange: TimeRange = {
      taskName: candidate.taskName,
      startedAt: candidate.startedAt,
      endedAt: candidate.endedAt,
    };
    const entryRange: TimeRange = {
      taskName: taskNamesById.get(entry.taskId),
      startedAt: entry.startedAt,
      endedAt: entryEnd,
    };
    const candidateStartsFirst =
      candidate.startedAt.getTime() <= entry.startedAt.getTime();
    conflicts.push({
      entryIds: [candidate.id ?? "", entry.id],
      message: candidateStartsFirst
        ? overlapMessage(candidateRange, entryRange, timeZone)
        : overlapMessage(entryRange, candidateRange, timeZone),
    });
  }
  if (conflicts.length > 0) throw new OverlapError(conflicts);
}

/** Map a stored row (plus joined task/category) to the API contract. */
export function toTimeEntryDTO(
  entry: TimeEntryCore,
  task: Pick<TaskDTO, "name">,
  category: Pick<CategoryDTO, "key" | "name">,
  now: Date,
): TimeEntryDTO {
  const running = entry.status === "active" || entry.status === "paused";
  return {
    id: entry.id,
    taskId: entry.taskId,
    taskName: task.name,
    categoryId: entry.categoryId,
    categoryKey: category.key,
    categoryName: category.name,
    startedAt: entry.startedAt.toISOString(),
    endedAt: entry.endedAt === null ? null : entry.endedAt.toISOString(),
    status: entry.status,
    notes: entry.notes,
    source: entry.source,
    durationMinutes: running ? null : entryDurationMinutes(entry, now),
  };
}
