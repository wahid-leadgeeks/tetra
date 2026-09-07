/**
 * Spreadsheet column mapping — the ONLY place workbook coordinates are defined.
 * Never hard-code workbook coordinates elsewhere (ARCHITECTURE.md).
 */
import { z } from "zod";

/** A1 column letter, 1–2 uppercase letters (A..ZZ). */
export const COLUMN_LETTER_PATTERN = /^[A-Z]{1,2}$/;

const columnLetter = z
  .string()
  .regex(COLUMN_LETTER_PATTERN, "Column must be an A1 column letter (A–ZZ)");

/** The 8 seeded category keys (scripts/seed.ts). Order matches sortOrder. */
export const CATEGORY_KEYS = [
  "website_management",
  "cyber_security",
  "technology_innovation",
  "infrastructure_management",
  "research",
  "meeting",
  "training",
  "other_tasks",
] as const;

export type CategoryKey = (typeof CATEGORY_KEYS)[number];

const categoriesSchema = z.strictObject({
  website_management: columnLetter,
  cyber_security: columnLetter,
  technology_innovation: columnLetter,
  infrastructure_management: columnLetter,
  research: columnLetter,
  meeting: columnLetter,
  training: columnLetter,
  other_tasks: columnLetter,
});

/** Optional per-category notes columns (September 2026 layout: I,K,M,O,Q,S,U,W). */
const categoryNotesSchema = z.strictObject({
  website_management: columnLetter,
  cyber_security: columnLetter,
  technology_innovation: columnLetter,
  infrastructure_management: columnLetter,
  research: columnLetter,
  meeting: columnLetter,
  training: columnLetter,
  other_tasks: columnLetter,
});

/**
 * Maps TETRA fields to worksheet columns.
 * `headerRow` is the 1-based row number of the header; the date scan starts
 * on the row AFTER it. When absent, row 1 is treated as data.
 * `categoryNotes` maps each category to the adjacent freeform-notes column.
 * It is optional so configs stored before it existed keep parsing; when
 * absent, sync never writes any notes cell (manual notes in the sheet are
 * never overwritten). `notesColumn` is accepted for legacy configs only.
 */
export const mappingSchema = z.strictObject({
  dateColumn: columnLetter,
  clockInColumn: columnLetter,
  breakStartColumn: columnLetter,
  breakEndColumn: columnLetter,
  clockOutColumn: columnLetter,
  dailyTotalColumn: columnLetter,
  workTotalColumn: columnLetter,
  categories: categoriesSchema,
  headerRow: z.number().int().min(1).optional(),
  notesColumn: columnLetter.optional(),
  categoryNotes: categoryNotesSchema.optional(),
  autoSyncOnClockOut: z.boolean().optional(),
});

export type SheetMapping = z.infer<typeof mappingSchema>;

/**
 * Verified against the September 2026 workbook: time columns B–G, each
 * category's duration column (H..V) paired with its notes column (I..W).
 */
export const DEFAULT_SHEET_MAPPING = {
  dateColumn: "A",
  clockInColumn: "B",
  breakStartColumn: "C",
  breakEndColumn: "D",
  clockOutColumn: "E",
  dailyTotalColumn: "F",
  workTotalColumn: "G",
  categories: {
    website_management: "H",
    cyber_security: "J",
    technology_innovation: "L",
    infrastructure_management: "N",
    research: "P",
    meeting: "R",
    training: "T",
    other_tasks: "V",
  },
  categoryNotes: {
    website_management: "I",
    cyber_security: "K",
    technology_innovation: "M",
    infrastructure_management: "O",
    research: "Q",
    meeting: "S",
    training: "U",
    other_tasks: "W",
  },
} satisfies SheetMapping;

/**
 * Actual column coordinates in the LeadGeeks Employee Task & Time Tracking spreadsheet.
 * Matches ARCHITECTURE.md § Spreadsheet mapping and verified against live sheet headers.
 */
export const LEADGEEKS_SHEET_MAPPING = {
  dateColumn: "A",
  clockInColumn: "B",
  breakStartColumn: "C",
  breakEndColumn: "D",
  clockOutColumn: "E",
  dailyTotalColumn: "F",
  workTotalColumn: "G",
  headerRow: 3,
  categories: {
    website_management: "EL",
    cyber_security: "EN",
    technology_innovation: "EP",
    infrastructure_management: "ER",
    research: "FL",
    meeting: "FN",
    training: "FP",
    other_tasks: "FR",
  },
  categoryNotes: {
    website_management: "EM",
    cyber_security: "EO",
    technology_innovation: "EQ",
    infrastructure_management: "ES",
    research: "FM",
    meeting: "FO",
    training: "FQ",
    other_tasks: "FS",
  },
  autoSyncOnClockOut: true,
} satisfies SheetMapping;

