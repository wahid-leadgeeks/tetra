/**
 * Read paths for the activities service: categories, recent tasks,
 * the current entry, and a day's entries.
 */
import { and, asc, desc, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { zonedDayEnd, zonedDayStart } from "@/lib/time";
import type { CategoryDTO, TaskDTO, TimeEntryDTO } from "@/lib/types";
import { db } from "@/server/db";
import { categories, tasks, timeEntries } from "@/server/db/schema";
import { toTimeEntryDTO } from "./domain";
import { entryWithTaskCategory } from "./entry-helpers";

/** Category list ordered for pickers/summaries. */
export async function listCategories(): Promise<CategoryDTO[]> {
  const rows = await db
    .select()
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.name));
  return rows.map((row) => ({
    id: row.id,
    key: row.key,
    name: row.name,
    sortOrder: row.sortOrder,
  }));
}

/** Most recently used tasks, for the quick-pick row. Favorites pin first. */
export async function listRecentTasks(
  userId: string,
  limit = 8,
): Promise<TaskDTO[]> {
  const rows = await db
    .select()
    .from(tasks)
    .where(eq(tasks.userId, userId))
    .orderBy(
      desc(tasks.isFavorite),
      sql`${tasks.lastUsedAt} desc nulls last`,
      asc(tasks.name),
    )
    .limit(limit);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    categoryId: row.categoryId,
    isFavorite: row.isFavorite,
    lastUsedAt: row.lastUsedAt === null ? null : row.lastUsedAt.toISOString(),
  }));
}

/** The single current (active or paused) entry, if any. */
export async function getActiveEntry(
  userId: string,
): Promise<TimeEntryDTO | null> {
  const now = new Date();
  const rows = await entryWithTaskCategory()
    .where(
      and(
        eq(timeEntries.userId, userId),
        inArray(timeEntries.status, ["active", "paused"]),
      ),
    )
    .orderBy(desc(timeEntries.startedAt))
    .limit(1);
  const row = rows[0];
  if (row === undefined) return null;
  return toTimeEntryDTO(row.entry, row.task, row.category, now);
}

/** All entries overlapping the user's local day `dayKey`, oldest first. */
export async function getDayEntries(
  userId: string,
  dayKey: string,
  timeZone: string,
): Promise<TimeEntryDTO[]> {
  const now = new Date();
  const dayStart = zonedDayStart(dayKey, timeZone);
  const dayEnd = zonedDayEnd(dayKey, timeZone);
  const rows = await entryWithTaskCategory()
    .where(
      and(
        eq(timeEntries.userId, userId),
        lte(timeEntries.startedAt, dayEnd),
        or(isNull(timeEntries.endedAt), gt(timeEntries.endedAt, dayStart)),
      ),
    )
    .orderBy(asc(timeEntries.startedAt));
  return rows.map((row) =>
    toTimeEntryDTO(row.entry, row.task, row.category, now),
  );
}
