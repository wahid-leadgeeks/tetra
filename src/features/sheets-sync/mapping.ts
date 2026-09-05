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

/**
 * Maps TETRA fields to worksheet columns.
 * `headerRow` is the 1-based row number of the header; the date scan starts
 * on the row AFTER it. When absent, row 1 is treated as data.
 * `notesColumn` is accepted for future use — the MVP payload never writes the
 * notes cell (manual notes in the sheet must never be overwritten).
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
});

export type SheetMapping = z.infer<typeof mappingSchema>;

/**
 * Example configuration from ARCHITECTURE.md — illustrative only.
 * Production mapping must be verified against the actual workbook.
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
} satisfies SheetMapping;
