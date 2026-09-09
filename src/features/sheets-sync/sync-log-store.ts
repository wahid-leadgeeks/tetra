/**
 * Sync log persistence + DTO mapping. The sync log is the audit trail for
 * every spreadsheet write attempt (ARCHITECTURE.md: "Audit spreadsheet writes").
 */
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { syncLogs } from "@/server/db/schema";
import type { SyncLogDTO } from "@/lib/types";

const SYNC_LOG_DEFAULT_LIMIT = 20;
const SYNC_LOG_MAX_LIMIT = 100;

export interface ChangedCell {
  a1: string;
  value: string;
}

export interface SyncAttemptContext {
  userId: string;
  workDate: string;
  configId: string;
  payloadHash: string | null;
}

export interface SyncLogOutcome {
  status: "success" | "failed";
  payloadHash: string | null;
  changedCells: ChangedCell[];
  errorMessage: string | null;
}

export interface ListSyncLogsOptions {
  limit?: number;
  /** Optional "YYYY-MM-DD" filter. */
  date?: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Record one sync attempt outcome. */
export async function recordSyncLog(
  ctx: SyncAttemptContext,
  outcome: SyncLogOutcome,
): Promise<void> {
  const spreadsheetConfigId =
    typeof ctx.configId === "string" && UUID_PATTERN.test(ctx.configId)
      ? ctx.configId
      : null;

  await db.insert(syncLogs).values({
    userId: ctx.userId,
    workDate: ctx.workDate,
    spreadsheetConfigId,
    status: outcome.status,
    payloadHash: outcome.payloadHash,
    changedCells: outcome.changedCells,
    errorMessage: outcome.errorMessage,
  });
}

/** Sync history, newest first, optionally filtered by work date. */
export async function listSyncLogs(
  userId: string,
  opts: ListSyncLogsOptions = {},
): Promise<SyncLogDTO[]> {
  const limit = Math.max(
    1,
    Math.min(opts.limit ?? SYNC_LOG_DEFAULT_LIMIT, SYNC_LOG_MAX_LIMIT),
  );
  const conditions = [eq(syncLogs.userId, userId)];
  if (opts.date) conditions.push(eq(syncLogs.workDate, opts.date));

  const rows = await db
    .select()
    .from(syncLogs)
    .where(and(...conditions))
    .orderBy(desc(syncLogs.createdAt))
    .limit(limit);

  return rows.map(toSyncLogDTO);
}

const changedCellsSchema = z.array(
  z.object({ a1: z.string(), value: z.string() }),
);

type SyncLogRow = typeof syncLogs.$inferSelect;

function toSyncLogDTO(row: SyncLogRow): SyncLogDTO {
  // jsonb re-parsed at the boundary; corrupt rows degrade to [].
  const parsed = changedCellsSchema.safeParse(row.changedCells ?? []);
  return {
    id: row.id,
    workDate: row.workDate,
    status: row.status,
    changedCells: parsed.success ? parsed.data : [],
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
  };
}
