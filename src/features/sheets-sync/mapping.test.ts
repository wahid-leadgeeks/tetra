import { describe, expect, it } from "vitest";
import {
  CATEGORY_KEYS,
  DEFAULT_SHEET_MAPPING,
  mappingSchema,
  type SheetMapping,
} from "./mapping";

/** A valid mapping shaped like ARCHITECTURE.md's example, with optionals set. */
const VALID_MAPPING: SheetMapping = {
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
  notesColumn: "H",
};

describe("mappingSchema", () => {
  it("accepts the DEFAULT_SHEET_MAPPING from ARCHITECTURE.md", () => {
    // Given the documented example configuration
    // When parsed
    const result = mappingSchema.safeParse(DEFAULT_SHEET_MAPPING);
    // Then it is valid and covers all 8 seeded category keys
    expect(result.success).toBe(true);
  });

  it("accepts a full mapping with optional headerRow and notesColumn", () => {
    // Given a complete, valid mapping
    // When parsed
    const result = mappingSchema.safeParse(VALID_MAPPING);
    // Then it succeeds and preserves the optionals
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.headerRow).toBe(1);
      expect(result.data.notesColumn).toBe("H");
    }
  });

  it("accepts a mapping without the optional fields", () => {
    // Given a valid mapping with optionals omitted
    const minimal = { ...VALID_MAPPING } as Record<string, unknown>;
    delete minimal.headerRow;
    delete minimal.notesColumn;
    // When parsed
    const result = mappingSchema.safeParse(minimal);
    // Then it succeeds
    expect(result.success).toBe(true);
  });

  it("rejects a column that is not an A1 column letter", () => {
    // Given a mapping whose date column is lowercase/numeric garbage
    for (const bad of ["a", "A1", "123", "", "ELX"]) {
      const candidate = { ...VALID_MAPPING, dateColumn: bad };
      // When parsed
      const result = mappingSchema.safeParse(candidate);
      // Then validation fails
      expect(result.success, `column "${bad}" must be rejected`).toBe(false);
    }
  });

  it("rejects a mapping with a missing category column", () => {
    // Given a mapping that omits the "research" category
    const categories = { ...VALID_MAPPING.categories } as Record<
      string,
      string
    >;
    delete categories.research;
    const candidate = { ...VALID_MAPPING, categories };
    // When parsed
    const result = mappingSchema.safeParse(candidate);
    // Then validation fails — all 8 seeded categories are required
    expect(result.success).toBe(false);
  });

  it("rejects an unknown category key", () => {
    // Given a mapping with a typo'd category key
    const candidate = {
      ...VALID_MAPPING,
      categories: {
        ...VALID_MAPPING.categories,
        website_managment: "Z",
      },
    };
    // When parsed
    const result = mappingSchema.safeParse(candidate);
    // Then validation fails — only the 8 seeded keys are accepted
    expect(result.success).toBe(false);
  });

  it("rejects a headerRow below the first spreadsheet row", () => {
    // Given headerRow 0 (rows are 1-based)
    const candidate = { ...VALID_MAPPING, headerRow: 0 };
    // When parsed
    const result = mappingSchema.safeParse(candidate);
    // Then validation fails
    expect(result.success).toBe(false);
  });

  it("exposes exactly the 8 seeded category keys", () => {
    // Given CATEGORY_KEYS
    // When inspected
    // Then it matches the seeded set from scripts/seed.ts
    expect([...CATEGORY_KEYS]).toEqual([
      "website_management",
      "cyber_security",
      "technology_innovation",
      "infrastructure_management",
      "research",
      "meeting",
      "training",
      "other_tasks",
    ]);
    expect(CATEGORY_KEYS.length).toBe(8);
  });
});
