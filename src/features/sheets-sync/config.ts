/**
 * Spreadsheet config persistence — one active config per user (upsert on the
 * active row; other rows are never needed). Stored jsonb mapping is
 * re-parsed at the trust boundary via mappingSchema.
 */
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { spreadsheetConfigs, users } from "@/server/db/schema";
import {
  DEFAULT_SHEET_MAPPING,
  LEADGEEKS_SHEET_MAPPING,
  mappingSchema,
  type SheetMapping,
} from "./mapping";

export interface SpreadsheetConfigDTO {
  id: string;
  spreadsheetId: string;
  worksheetName: string;
  sheetGid?: string | null;
  mapping: SheetMapping;
  timezone: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export const upsertSyncConfigSchema = z.object({
  /** Optional for file-based sync — Google sync requires it. */
  spreadsheetId: z.string().min(5).optional().default("file"),
  worksheetName: z.string().min(1),
  sheetGid: z.string().optional().nullable(),
  mapping: mappingSchema,
  timezone: z.string().min(1).optional(),
});

type SpreadsheetConfigRow = typeof spreadsheetConfigs.$inferSelect;

function isLeadGeeksSheet(
  _spreadsheetId?: string,
  _worksheetName?: string | null,
): boolean {
  return process.env.SHEET_MAPPING_FORMAT === "leadgeeks";
}

function toConfigDTO(row: SpreadsheetConfigRow): SpreadsheetConfigDTO {
  // Re-parsed at the boundary — a corrupt jsonb fails loudly here.
  let mapping = mappingSchema.parse(row.mapping);
  const isLeadGeeks = isLeadGeeksSheet(row.spreadsheetId, row.worksheetName);
  const fallback = isLeadGeeks ? LEADGEEKS_SHEET_MAPPING : DEFAULT_SHEET_MAPPING;

  if (
    isLeadGeeks &&
    (mapping.categories.meeting === "R" || mapping.headerRow === undefined)
  ) {
    mapping = { ...LEADGEEKS_SHEET_MAPPING, ...mapping };
  }

  mapping = {
    ...mapping,
    categoryNotes: mapping.categoryNotes ?? fallback.categoryNotes,
    autoSyncOnClockIn: mapping.autoSyncOnClockIn ?? fallback.autoSyncOnClockIn ?? true,
    autoSyncOnClockOut: mapping.autoSyncOnClockOut ?? fallback.autoSyncOnClockOut ?? true,
    autoSyncTasks: mapping.autoSyncTasks ?? fallback.autoSyncTasks ?? true,
    headerRow: mapping.headerRow ?? fallback.headerRow,
  };
  return {
    id: row.id,
    spreadsheetId: row.spreadsheetId,
    worksheetName: row.worksheetName,
    sheetGid: row.sheetGid ?? null,
    mapping,
    timezone: row.timezone,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** The user's single active spreadsheet config, or env fallback, or null. */
export async function getSyncConfig(
  userId: string,
): Promise<SpreadsheetConfigDTO | null> {
  const rows = await db
    .select()
    .from(spreadsheetConfigs)
    .where(
      and(
        eq(spreadsheetConfigs.userId, userId),
        eq(spreadsheetConfigs.active, true),
      ),
    )
    .orderBy(desc(spreadsheetConfigs.updatedAt))
    .limit(1);
  if (rows.length > 0) {
    return toConfigDTO(rows[0]);
  }

  // Fallback to environment variables if configured
  if (env.GOOGLE_SPREADSHEET_ID) {
    const timezone = await getUserTimezone(userId);
    const isLeadGeeks = isLeadGeeksSheet(
      env.GOOGLE_SPREADSHEET_ID,
      env.GOOGLE_SHEET_NAME,
    );
    return {
      id: "env-default",
      spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
      worksheetName: env.GOOGLE_SHEET_NAME || "Sheet1",
      sheetGid: env.GOOGLE_SHEET_GID || null,
      mapping: isLeadGeeks ? LEADGEEKS_SHEET_MAPPING : DEFAULT_SHEET_MAPPING,
      timezone,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  return null;
}

/** User's stored IANA timezone (fallback: the app default). */
export async function getUserTimezone(userId: string): Promise<string> {
  const rows = await db
    .select({ timezone: users.timezone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows.length > 0 ? rows[0].timezone : env.DEFAULT_TIMEZONE;
}

/**
 * Create or replace the user's active config — one active config per user.
 * Input is parsed, never trusted raw. Timezone defaults to the user's stored
 * IANA timezone.
 */
export async function upsertSyncConfig(
  userId: string,
  input: unknown,
): Promise<SpreadsheetConfigDTO> {
  const parsed = upsertSyncConfigSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid sync config: ${firstIssueMessage(parsed.error)}`);
  }
  const { spreadsheetId, worksheetName, sheetGid, mapping, timezone } =
    parsed.data;
  const resolvedTimezone = timezone ?? (await getUserTimezone(userId));

  const existing = await db
    .select()
    .from(spreadsheetConfigs)
    .where(
      and(
        eq(spreadsheetConfigs.userId, userId),
        eq(spreadsheetConfigs.active, true),
      ),
    )
    .orderBy(desc(spreadsheetConfigs.updatedAt))
    .limit(1);

  const isLeadGeeks = isLeadGeeksSheet(spreadsheetId, worksheetName);
  const fallback = isLeadGeeks ? LEADGEEKS_SHEET_MAPPING : DEFAULT_SHEET_MAPPING;
  const existingMapping = existing.length > 0 ? (existing[0].mapping as Partial<SheetMapping>) : null;

  const resolvedMapping: SheetMapping = {
    ...fallback,
    ...(existingMapping ?? {}),
    ...mapping,
    categories: {
      ...fallback.categories,
      ...(existingMapping?.categories ?? {}),
      ...mapping.categories,
    },
    categoryNotes:
      mapping.categoryNotes ??
      existingMapping?.categoryNotes ??
      fallback.categoryNotes,
    autoSyncOnClockIn:
      mapping.autoSyncOnClockIn ??
      existingMapping?.autoSyncOnClockIn ??
      fallback.autoSyncOnClockIn ??
      true,
    autoSyncOnClockOut:
      mapping.autoSyncOnClockOut ??
      existingMapping?.autoSyncOnClockOut ??
      fallback.autoSyncOnClockOut ??
      true,
    autoSyncTasks:
      mapping.autoSyncTasks ??
      existingMapping?.autoSyncTasks ??
      fallback.autoSyncTasks ??
      true,
    headerRow:
      mapping.headerRow ??
      existingMapping?.headerRow ??
      fallback.headerRow,
  };

  if (existing.length > 0) {
    const [updated] = await db
      .update(spreadsheetConfigs)
      .set({
        spreadsheetId,
        worksheetName,
        sheetGid: sheetGid ?? null,
        mapping: resolvedMapping,
        timezone: resolvedTimezone,
        active: true,
        updatedAt: new Date(),
      })
      .where(eq(spreadsheetConfigs.id, existing[0].id))
      .returning();
    return toConfigDTO(updated);
  }

  const [created] = await db
    .insert(spreadsheetConfigs)
    .values({
      userId,
      spreadsheetId,
      worksheetName,
      sheetGid: sheetGid ?? null,
      mapping: resolvedMapping,
      timezone: resolvedTimezone,
      active: true,
    })
    .returning();
  return toConfigDTO(created);
}

/**
 * Partially updates the user's active spreadsheet mapping (e.g. toggling autoSyncTasks).
 * Merges with the existing active mapping or default mapping.
 */
export async function updateSyncConfigMapping(
  userId: string,
  partialMapping: Partial<SheetMapping>,
): Promise<SpreadsheetConfigDTO> {
  const current = await getSyncConfig(userId);
  const baseMapping = current?.mapping ?? DEFAULT_SHEET_MAPPING;
  const mergedMapping = {
    ...baseMapping,
    ...partialMapping,
  };
  return upsertSyncConfig(userId, {
    spreadsheetId: current?.spreadsheetId ?? env.GOOGLE_SPREADSHEET_ID ?? "file",
    worksheetName: current?.worksheetName ?? env.GOOGLE_SHEET_NAME ?? "Sheet1",
    sheetGid: current?.sheetGid ?? env.GOOGLE_SHEET_GID ?? null,
    mapping: mergedMapping,
    timezone: current?.timezone,
  });
}

function firstIssueMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "invalid input";
  const path = issue.path.map(String).join(".");
  return `${path || "body"}: ${issue.message}`;
}
