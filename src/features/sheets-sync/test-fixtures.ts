import type { SheetMapping } from "./mapping";

/**
 * Shared pure-test fixtures — no db, no google, no imports of service code.
 * Mirrors the ARCHITECTURE.md example mapping.
 */
export const MAPPING: SheetMapping = {
  dateColumn: "A",
  clockInColumn: "B",
  breakStartColumn: "C",
  breakEndColumn: "D",
  clockOutColumn: "E",
  dailyTotalColumn: "F",
  workTotalColumn: "G",
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
  headerRow: 1,
};
