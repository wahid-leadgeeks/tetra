import { describe, expect, it } from "vitest";
import type { DaySummaryDTO, TimeEntryDTO } from "@/lib/types";
import type { SheetMapping } from "./mapping";
import { MAPPING } from "./test-fixtures";
import { buildSyncPayload, compileCategoryNotes, computePayloadHash } from "./payload";

const TZ = "Asia/Jakarta";
const ROW = 5;

/** September 2026 layout: H..V durations paired with I..W notes columns. */
const NOTES_MAPPING: SheetMapping = {
  ...MAPPING,
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
};

function makeEntry(overrides: Partial<TimeEntryDTO> = {}): TimeEntryDTO {
  return {
    id: "e1",
    taskId: "t1",
    taskName: "Team meeting",
    categoryId: "c1",
    categoryKey: "meeting",
    categoryName: "Meeting",
    startedAt: "2026-09-03T01:00:00Z",
    endedAt: "2026-09-03T02:00:00Z",
    status: "completed",
    notes: null,
    source: "manual",
    durationMinutes: 60,
    ...overrides,
  };
}

/** Full day fixture: 08:00–16:00 Jakarta, two 15m breaks, 442m website_management. */
function makeSummary(
  overrides: Partial<
    Pick<
      DaySummaryDTO,
      "attendance" | "totals" | "byCategory" | "workDate" | "timeEntries"
    >
  > = {},
): DaySummaryDTO {
  return {
    workDate: "2026-09-03",
    attendance: {
      id: "att-1",
      workDate: "2026-09-03",
      clockInAt: "2026-09-03T01:00:00Z", // 08:00 Jakarta
      clockOutAt: "2026-09-03T09:00:00Z", // 16:00 Jakarta
      status: "closed",
      activeBreak: null,
      breaks: [
        {
          id: "b1",
          startedAt: "2026-09-03T03:00:00Z", // 10:00 Jakarta
          endedAt: "2026-09-03T03:15:00Z", // 10:15 Jakarta
          durationMinutes: 15,
        },
        {
          id: "b2",
          startedAt: "2026-09-03T05:00:00Z", // 12:00 Jakarta
          endedAt: "2026-09-03T05:15:00Z", // 12:15 Jakarta
          durationMinutes: 15,
        },
      ],
      breakMinutes: 30,
    },
    timeEntries: [],
    totals: { attendanceMinutes: 487, breakMinutes: 30, workMinutes: 457 },
    byCategory: [
      {
        categoryId: "c1",
        key: "website_management",
        name: "Website Management",
        minutes: 442,
      },
    ],
    warnings: [],
    reviewState: "reviewed",
    ...overrides,
  };
}

describe("buildSyncPayload", () => {
  it("builds the exact 14 mapped cells with A1 addresses and values", () => {
    // Given a full reviewed day and the ARCHITECTURE.md mapping at row 5
    const summary = makeSummary();
    // When the payload is built
    const { rowDateValue, cells } = buildSyncPayload(summary, MAPPING, {
      dateValueFormat: "iso",
      rowNumber: ROW,
      timezone: TZ,
    });
    // Then every mapped cell is present with the exact value
    expect(rowDateValue).toBe("2026-09-03");
    expect(cells).toEqual([
      { a1: "B5", value: "08:00", columnLabel: "Clock In" },
      { a1: "C5", value: "10:00", columnLabel: "Break Start" },
      { a1: "D5", value: "12:15", columnLabel: "Break End" },
      { a1: "E5", value: "16:00", columnLabel: "Clock Out" },
      { a1: "F5", value: "8:07", columnLabel: "Daily Total (Attendance)" },
      { a1: "G5", value: "7:37", columnLabel: "Work Total" },
      { a1: "EL5", value: "7:22", columnLabel: "Website Management" },
      { a1: "EN5", value: "0:00", columnLabel: "Cyber Security" },
      { a1: "EP5", value: "0:00", columnLabel: "Technology Optimization & Innovation" },
      { a1: "ER5", value: "0:00", columnLabel: "Infrastructure Management" },
      { a1: "FL5", value: "0:00", columnLabel: "Research" },
      { a1: "FN5", value: "0:00", columnLabel: "Meeting" },
      { a1: "FP5", value: "0:00", columnLabel: "Training" },
      { a1: "FR5", value: "0:00", columnLabel: "Other Tasks" },
    ]);
  });

  it("renders totals in H:MM format including single-digit hours", () => {
    // Given 442 work minutes on one category
    const summary = makeSummary();
    // When the payload is built
    const { cells } = buildSyncPayload(summary, MAPPING, {
      dateValueFormat: "iso",
      rowNumber: ROW,
      timezone: TZ,
    });
    // Then the duration renders as "7:22", not "07:22"
    const website = cells.find((c) => c.a1 === "EL5");
    expect(website?.value).toBe("7:22");
    const workTotal = cells.find((c) => c.a1 === "G5");
    expect(workTotal?.value).toBe("7:37");
  });

  it("writes empty break cells when the day had no breaks", () => {
    // Given a day with attendance but zero breaks
    const summary = makeSummary({
      attendance: {
        id: "att-1",
        workDate: "2026-09-03",
        clockInAt: "2026-09-03T01:00:00Z",
        clockOutAt: "2026-09-03T09:00:00Z",
        status: "closed",
        activeBreak: null,
        breaks: [],
        breakMinutes: 0,
      },
      totals: { attendanceMinutes: 480, breakMinutes: 0, workMinutes: 480 },
    });
    // When the payload is built
    const { cells } = buildSyncPayload(summary, MAPPING, {
      dateValueFormat: "iso",
      rowNumber: ROW,
      timezone: TZ,
    });
    // Then both break cells are empty strings (clears stale sheet values)
    expect(cells.find((c) => c.a1 === "C5")?.value).toBe("");
    expect(cells.find((c) => c.a1 === "D5")?.value).toBe("");
  });

  it("writes empty clock cells when the day has no attendance row", () => {
    // Given a day summary without attendance
    const summary = makeSummary({
      attendance: null,
      totals: { attendanceMinutes: 0, breakMinutes: 0, workMinutes: 0 },
      byCategory: [],
    });
    // When the payload is built
    const { cells } = buildSyncPayload(summary, MAPPING, {
      dateValueFormat: "iso",
      rowNumber: ROW,
      timezone: TZ,
    });
    // Then clock in/out and breaks are empty, totals are 0:00
    expect(cells.find((c) => c.a1 === "B5")?.value).toBe("");
    expect(cells.find((c) => c.a1 === "E5")?.value).toBe("");
    expect(cells.find((c) => c.a1 === "F5")?.value).toBe("0:00");
    expect(cells.find((c) => c.a1 === "G5")?.value).toBe("0:00");
  });

  it("renders the date value as M/D/YYYY in display format", () => {
    // Given a day summary for 2026-09-03
    const summary = makeSummary();
    // When the payload is built with the display format
    const { rowDateValue } = buildSyncPayload(summary, MAPPING, {
      dateValueFormat: "display",
      rowNumber: ROW,
      timezone: TZ,
    });
    // Then the date renders without zero padding
    expect(rowDateValue).toBe("9/3/2026");
  });

  it("formats clock values in the timezone the summary was computed in", () => {
    // Given the same instants rendered in Tokyo instead of Jakarta
    const summary = makeSummary();
    // When the payload is built with timezone Asia/Tokyo
    const { cells } = buildSyncPayload(summary, MAPPING, {
      dateValueFormat: "iso",
      rowNumber: ROW,
      timezone: "Asia/Tokyo",
    });
    // Then clock in renders at 10:00 Tokyo (UTC+9)
    expect(cells.find((c) => c.a1 === "B5")?.value).toBe("10:00");
  });
});

describe("computePayloadHash", () => {
  it("produces a stable hash for identical input", () => {
    // Given the same payload built twice from the same summary
    const a = buildSyncPayload(makeSummary(), MAPPING, {
      dateValueFormat: "iso",
      rowNumber: ROW,
      timezone: TZ,
    });
    const b = buildSyncPayload(makeSummary(), MAPPING, {
      dateValueFormat: "iso",
      rowNumber: ROW,
      timezone: TZ,
    });
    // When both are hashed
    const hashA = computePayloadHash(ROW, a.cells);
    const hashB = computePayloadHash(ROW, b.cells);
    // Then the hashes are identical sha256 hex strings
    expect(hashA).toBe(hashB);
    expect(hashA).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes the hash when minutes change", () => {
    // Given two summaries differing by one category's minutes
    const base = buildSyncPayload(makeSummary(), MAPPING, {
      dateValueFormat: "iso",
      rowNumber: ROW,
      timezone: TZ,
    });
    const changed = buildSyncPayload(
      makeSummary({
        byCategory: [
          {
            categoryId: "c1",
            key: "website_management",
            name: "Website Management",
            minutes: 443,
          },
        ],
        totals: { attendanceMinutes: 488, breakMinutes: 30, workMinutes: 458 },
      }),
      MAPPING,
      { dateValueFormat: "iso", rowNumber: ROW, timezone: TZ },
    );
    // When both are hashed
    // Then the hashes differ
    expect(computePayloadHash(ROW, base.cells)).not.toBe(
      computePayloadHash(ROW, changed.cells),
    );
  });

  it("changes the hash when the target row changes", () => {
    // Given identical cells destined for two different rows
    const { cells } = buildSyncPayload(makeSummary(), MAPPING, {
      dateValueFormat: "iso",
      rowNumber: ROW,
      timezone: TZ,
    });
    // When hashed with different row numbers
    // Then the hashes differ (row is part of the payload identity)
    expect(computePayloadHash(ROW, cells)).not.toBe(
      computePayloadHash(ROW + 1, cells),
    );
  });
});

describe("compileCategoryNotes", () => {
  it("compiles one newline-joined block per category, deduplicated in order", () => {
    // Given completed meeting entries with notes, one repeated
    const entries = [
      makeEntry({ id: "e1", notes: "Daily standup" }),
      makeEntry({ id: "e2", notes: "Sprint planning" }),
      makeEntry({ id: "e3", notes: "Daily standup" }),
      makeEntry({
        id: "e4",
        categoryKey: "training",
        categoryName: "Training",
        notes: "Security training",
      }),
    ];
    // When compiled
    const notes = compileCategoryNotes(entries);
    // Then each category has its deduplicated notes joined by newlines
    expect(notes.get("meeting")).toBe("Daily standup\nSprint planning");
    expect(notes.get("training")).toBe("Security training");
    expect(notes.size).toBe(2);
  });

  it("falls back to the task name and skips blank text", () => {
    // Given entries without notes, one with whitespace-only notes
    const entries = [
      makeEntry({ id: "e1", notes: null }),
      makeEntry({ id: "e2", notes: "   " }),
    ];
    // When compiled
    const notes = compileCategoryNotes(entries);
    // Then the task name is used and the blank note produces nothing extra
    expect(notes.get("meeting")).toBe("Team meeting");
  });

  it("skips entries that are not completed", () => {
    // Given an active and a paused entry with notes
    const entries = [
      makeEntry({ id: "e1", status: "active" }),
      makeEntry({ id: "e2", status: "paused" }),
    ];
    // When compiled
    const notes = compileCategoryNotes(entries);
    // Then nothing is compiled for the sheet
    expect(notes.size).toBe(0);
  });

  it("ignores categories outside the seeded set", () => {
    // Given an entry whose category key is not a seeded category
    const entries = [
      makeEntry({ id: "e1", categoryKey: "side_project", notes: "Whatever" }),
    ];
    // When compiled
    const notes = compileCategoryNotes(entries);
    // Then the unknown key is dropped
    expect(notes.size).toBe(0);
  });
});

describe("buildSyncPayload notes cells", () => {
  it("writes one notes cell per category with compiled notes", () => {
    // Given a reviewed day with meeting and training entries
    const summary = makeSummary({
      timeEntries: [
        makeEntry({ id: "e1", notes: "Onboarding Wahid" }),
        makeEntry({
          id: "e2",
          categoryKey: "training",
          categoryName: "Training",
          taskName: "Welcoming Message from CEO",
          notes: "Welcoming Message from CEO",
        }),
      ],
    });
    // When the payload is built with a notes mapping
    const { cells } = buildSyncPayload(summary, NOTES_MAPPING, {
      dateValueFormat: "iso",
      rowNumber: ROW,
      timezone: TZ,
    });
    // Then exactly two notes cells are appended with their columns and rows
    const notesCells = cells.filter((c) => c.cellType === "notes");
    expect(notesCells).toEqual([
      {
        a1: "S5",
        value: "Onboarding Wahid",
        columnLabel: "Meeting Notes",
        cellType: "notes",
        categoryKey: "meeting",
      },
      {
        a1: "U5",
        value: "Welcoming Message from CEO",
        columnLabel: "Training Notes",
        cellType: "notes",
        categoryKey: "training",
      },
    ]);
  });

  it("emits no notes cell for a category without notes", () => {
    // Given a day whose only notes belong to meeting
    const summary = makeSummary({
      timeEntries: [makeEntry({ id: "e1", notes: "Standup" })],
    });
    // When the payload is built
    const { cells } = buildSyncPayload(summary, NOTES_MAPPING, {
      dateValueFormat: "iso",
      rowNumber: ROW,
      timezone: TZ,
    });
    // Then no other notes column appears — empty notes never blank a cell
    const notesA1s = cells
      .filter((c) => c.cellType === "notes")
      .map((c) => c.a1);
    expect(notesA1s).toEqual(["S5"]);
  });

  it("omits every notes cell when includeNotes is false", () => {
    // Given a day with compiled notes
    const summary = makeSummary({
      timeEntries: [makeEntry({ id: "e1", notes: "Standup" })],
    });
    // When the payload is built with notes excluded
    const { cells } = buildSyncPayload(summary, NOTES_MAPPING, {
      dateValueFormat: "iso",
      rowNumber: ROW,
      timezone: TZ,
      includeNotes: false,
    });
    // Then no notes cell is emitted
    expect(cells.filter((c) => c.cellType === "notes")).toHaveLength(0);
  });

  it("replaces compiled notes with the preview edits", () => {
    // Given compiled notes and a user edit for meeting
    const summary = makeSummary({
      timeEntries: [makeEntry({ id: "e1", notes: "Standup" })],
    });
    // When the payload is built with a notes override
    const { cells } = buildSyncPayload(summary, NOTES_MAPPING, {
      dateValueFormat: "iso",
      rowNumber: ROW,
      timezone: TZ,
      notesOverrides: { meeting: "Standup + retro" },
    });
    // Then the edited text is written instead
    expect(cells.find((c) => c.a1 === "S5")?.value).toBe("Standup + retro");
  });

  it("skips an overridden note that was emptied", () => {
    // Given compiled notes and an emptied meeting override
    const summary = makeSummary({
      timeEntries: [makeEntry({ id: "e1", notes: "Standup" })],
    });
    // When the payload is built with an empty override
    const { cells } = buildSyncPayload(summary, NOTES_MAPPING, {
      dateValueFormat: "iso",
      rowNumber: ROW,
      timezone: TZ,
      notesOverrides: { meeting: "   " },
    });
    // Then the meeting notes cell is dropped, not blanked
    expect(cells.find((c) => c.a1 === "S5")).toBeUndefined();
  });
});
