/**
 * Split a completed entry into two consecutive entries at a chosen time
 * (DESIGN.md "Split entry"): the first keeps the original id and ends at the
 * split point; the second is a new entry covering the rest, optionally
 * reassigned to another task/category. Wall time and paused time are both
 * preserved exactly, and overlaps are re-validated server-side.
 */
import { and, eq } from "drizzle-orm";
import { zonedDayKey } from "@/lib/time";
import type { TimeEntryDTO } from "@/lib/types";
import { db } from "@/server/db";
import { tasks, timeEntries } from "@/server/db/schema";
import { validateNoOverlap } from "./domain";
import {
  assertCategoryExists,
  fetchEntriesInRange,
  markDayChanged,
  requireEntryDto,
  upsertTask,
} from "./entry-helpers";

export interface SplitPlan {
  /** Patch applied to the original (first) entry. */
  first: { endedAt: Date; pausedSeconds: number };
  /** Values for the new second entry. */
  second: { startedAt: Date; endedAt: Date; pausedSeconds: number };
}

/**
 * Pure split planning. The two segments are adjacent half-open ranges
 * ([start, split) and [split, end)) so they never overlap, and pausedSeconds
 * is split proportionally to the wall durations, always summing exactly to
 * the original — total duration is preserved by construction.
 */
export function planSplit(
  entry: Pick<
    typeof timeEntries.$inferSelect,
    "startedAt" | "endedAt" | "status" | "pausedSeconds"
  >,
  splitAt: Date,
): SplitPlan {
  if (entry.status !== "completed" || entry.endedAt === null) {
    throw new Error("Only completed entries can be split");
  }
  const start = entry.startedAt.getTime();
  const end = entry.endedAt.getTime();
  const split = splitAt.getTime();
  if (split <= start || split >= end) {
    throw new Error("Split time must be strictly between start and end");
  }
  const totalWall = end - start;
  const firstWall = split - start;
  const firstPaused = Math.min(
    entry.pausedSeconds,
    Math.floor((entry.pausedSeconds * firstWall) / totalWall),
  );
  return {
    first: { endedAt: new Date(split), pausedSeconds: firstPaused },
    second: {
      startedAt: new Date(split),
      endedAt: new Date(end),
      pausedSeconds: entry.pausedSeconds - firstPaused,
    },
  };
}

export async function splitTimeEntry(
  userId: string,
  timeZone: string,
  entryId: string,
  splitAtIso: string,
  secondTaskName?: string,
  secondCategoryId?: string,
): Promise<{ first: TimeEntryDTO; second: TimeEntryDTO }> {
  const splitAt = new Date(splitAtIso);
  if (Number.isNaN(splitAt.getTime())) {
    throw new Error("Invalid split time");
  }
  const now = new Date();
  const ids = await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(timeEntries)
      .where(and(eq(timeEntries.id, entryId), eq(timeEntries.userId, userId)))
      .limit(1)
      .for("update");
    const entry = existing[0];
    if (entry === undefined) throw new Error("Entry not found");
    const plan = planSplit(entry, splitAt);

    const categoryId = secondCategoryId ?? entry.categoryId;
    if (secondCategoryId !== undefined) {
      await assertCategoryExists(tx, secondCategoryId);
    }

    let taskId = entry.taskId;
    let secondTaskNameResolved: string | undefined = secondTaskName;
    if (secondTaskName === undefined) {
      const taskRows = await tx
        .select({ name: tasks.name })
        .from(tasks)
        .where(eq(tasks.id, entry.taskId))
        .limit(1);
      secondTaskNameResolved = taskRows[0]?.name;
    } else {
      const task = await upsertTask(
        tx,
        userId,
        secondTaskName,
        categoryId,
        now,
      );
      taskId = task.id;
    }

    const before = await fetchEntriesInRange(
      tx,
      userId,
      entry.startedAt,
      plan.first.endedAt,
      entry.id,
    );
    validateNoOverlap(
      {
        id: entry.id,
        taskName: secondTaskNameResolved,
        startedAt: entry.startedAt,
        endedAt: plan.first.endedAt,
      },
      before.entries,
      before.taskNamesById,
      timeZone,
      now,
    );
    // The original row still spans the full range at validation time —
    // exclude it, or the second segment always conflicts with itself.
    const after = await fetchEntriesInRange(
      tx,
      userId,
      plan.second.startedAt,
      plan.second.endedAt,
      entry.id,
    );
    validateNoOverlap(
      {
        taskName: secondTaskNameResolved,
        startedAt: plan.second.startedAt,
        endedAt: plan.second.endedAt,
      },
      after.entries,
      after.taskNamesById,
      timeZone,
      now,
    );

    await tx
      .update(timeEntries)
      .set({
        endedAt: plan.first.endedAt,
        pausedSeconds: plan.first.pausedSeconds,
        updatedAt: now,
      })
      .where(eq(timeEntries.id, entry.id));

    const created = await tx
      .insert(timeEntries)
      .values({
        userId,
        taskId,
        categoryId,
        startedAt: plan.second.startedAt,
        endedAt: plan.second.endedAt,
        status: "completed",
        notes: null,
        source: entry.source,
        pausedSeconds: plan.second.pausedSeconds,
      })
      .returning({ id: timeEntries.id });
    const second = created[0];
    if (second === undefined) throw new Error("Failed to create the second entry");

    await markDayChanged(tx, userId, zonedDayKey(entry.startedAt, timeZone));
    return { firstId: entry.id, secondId: second.id };
  });

  const first = await requireEntryDto(userId, ids.firstId);
  const second = await requireEntryDto(userId, ids.secondId);
  return { first, second };
}
