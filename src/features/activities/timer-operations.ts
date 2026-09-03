/**
 * Timer lifecycle operations: start, stop, pause, resume.
 * Enforces the single-current-entry invariant (start auto-stops whatever
 * is running) and keeps all writes server-timestamped.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { zonedDayKey } from "@/lib/time";
import type { TimeEntryDTO } from "@/lib/types";
import { db } from "@/server/db";
import { timeEntries } from "@/server/db/schema";
import {
  accumulatePause,
  assertCategoryExists,
  markDayChanged,
  requireEntryDto,
  upsertTask,
} from "./entry-helpers";

export interface StartTimerInput {
  taskName: string;
  categoryId: string;
  notes?: string;
}

/**
 * Start a new timer. Any active/paused entry is auto-stopped first
 * (single current entry invariant). Days touched by stopped/new entries
 * that were already synced are flagged `changed_after_sync`.
 */
export async function startTimer(
  userId: string,
  timeZone: string,
  input: StartTimerInput,
): Promise<TimeEntryDTO> {
  const now = new Date();
  const entryId = await db.transaction(async (tx) => {
    await assertCategoryExists(tx, input.categoryId);
    const running = await tx
      .select()
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.userId, userId),
          inArray(timeEntries.status, ["active", "paused"]),
        ),
      )
      .for("update");
    const changedDays = new Set<string>();
    for (const entry of running) {
      await tx
        .update(timeEntries)
        .set({
          endedAt: now,
          status: "completed",
          pausedAt: null,
          pausedSeconds: accumulatePause(entry, now),
          updatedAt: now,
        })
        .where(eq(timeEntries.id, entry.id));
      changedDays.add(zonedDayKey(entry.startedAt, timeZone));
    }
    const task = await upsertTask(
      tx,
      userId,
      input.taskName,
      input.categoryId,
      now,
    );
    const created = await tx
      .insert(timeEntries)
      .values({
        userId,
        taskId: task.id,
        categoryId: input.categoryId,
        startedAt: now,
        status: "active",
        source: "timer",
        notes: input.notes ?? null,
        pausedSeconds: 0,
      })
      .returning({ id: timeEntries.id });
    const newEntry = created[0];
    if (newEntry === undefined) throw new Error("Failed to start timer");
    changedDays.add(zonedDayKey(now, timeZone));
    for (const day of changedDays) {
      await markDayChanged(tx, userId, day);
    }
    return newEntry.id;
  });
  return requireEntryDto(userId, entryId);
}

/** Stop the current entry. Throws when nothing is running. */
export async function stopTimer(
  userId: string,
  timeZone: string,
): Promise<TimeEntryDTO> {
  const now = new Date();
  const entryId = await db.transaction(async (tx) => {
    const running = await tx
      .select()
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.userId, userId),
          inArray(timeEntries.status, ["active", "paused"]),
        ),
      )
      .orderBy(desc(timeEntries.startedAt))
      .limit(1)
      .for("update");
    const entry = running[0];
    if (entry === undefined) throw new Error("No active task");
    await tx
      .update(timeEntries)
      .set({
        endedAt: now,
        status: "completed",
        pausedAt: null,
        pausedSeconds: accumulatePause(entry, now),
        updatedAt: now,
      })
      .where(eq(timeEntries.id, entry.id));
    await markDayChanged(tx, userId, zonedDayKey(entry.startedAt, timeZone));
    return entry.id;
  });
  return requireEntryDto(userId, entryId);
}

/** Pause the running entry. Throws when nothing is active. */
export async function pauseTimer(userId: string): Promise<TimeEntryDTO> {
  const now = new Date();
  const updated = await db
    .update(timeEntries)
    .set({ status: "paused", pausedAt: now, updatedAt: now })
    .where(
      and(
        eq(timeEntries.userId, userId),
        eq(timeEntries.status, "active"),
      ),
    )
    .returning({ id: timeEntries.id });
  const entry = updated[0];
  if (entry === undefined) throw new Error("No active task");
  return requireEntryDto(userId, entry.id);
}

/** Resume the paused entry, banking the pause into `pausedSeconds`. */
export async function resumeTimer(userId: string): Promise<TimeEntryDTO> {
  const now = new Date();
  const entryId = await db.transaction(async (tx) => {
    const paused = await tx
      .select()
      .from(timeEntries)
      .where(
        and(eq(timeEntries.userId, userId), eq(timeEntries.status, "paused")),
      )
      .limit(1)
      .for("update");
    const entry = paused[0];
    if (entry === undefined) throw new Error("No paused task");
    await tx
      .update(timeEntries)
      .set({
        status: "active",
        pausedAt: null,
        pausedSeconds: accumulatePause(entry, now),
        updatedAt: now,
      })
      .where(eq(timeEntries.id, entry.id));
    return entry.id;
  });
  return requireEntryDto(userId, entryId);
}
