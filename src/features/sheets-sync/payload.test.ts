import { describe, expect, it } from "vitest";
import type { BreakDTO, DaySummaryDTO, TimeEntryDTO } from "@/lib/types";
import type { SheetMapping } from "./mapping";
import { MAPPING } from "./test-fixtures";
import {
  buildSyncPayload,
  compileCategoryNotes,
  computePayloadHash,
  computeSheetBreakTimes,
} from "./payload";

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
    pausedSeconds: 0,
    pausedAt: null,
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
      { a1: "B5", value: "8:00", columnLabel: "Clock In" },
      { a1: "C5", value: "12:00", columnLabel: "Break Start" },
      { a1: "D5", value: "12:30", columnLabel: "Break End" },
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

  it("renders clock in, clock out, and break times in H:mm format without leading zero for single-digit hours", () => {
    const summary = makeSummary({
      attendance: {
        id: "att-1",
        workDate: "2026-09-03",
        clockInAt: "2026-09-03T01:20:00Z", // 08:20 Jakarta
        clockOutAt: "2026-09-03T09:00:00Z", // 16:00 Jakarta
        status: "closed",
        activeBreak: null,
        breaks: [
          {
            id: "b1",
            startedAt: "2026-09-03T01:45:00Z", // 08:45 Jakarta
            endedAt: "2026-09-03T02:00:00Z", // 09:00 Jakarta
            durationMinutes: 15,
          },
        ],
        breakMinutes: 15,
      },
      totals: { attendanceMinutes: 460, breakMinutes: 15, workMinutes: 445 },
    });
    const { cells } = buildSyncPayload(summary, MAPPING, {
      dateValueFormat: "iso",
      rowNumber: ROW,
      timezone: TZ,
    });
    expect(cells.find((c) => c.a1 === "B5")?.value).toBe("8:20");
    expect(cells.find((c) => c.a1 === "C5")?.value).toBe("12:00");
    expect(cells.find((c) => c.a1 === "D5")?.value).toBe("12:15");
    expect(cells.find((c) => c.a1 === "E5")?.value).toBe("16:00");
  });

  it("renders single afternoon break start and end in H:mm format", () => {
    const summary = makeSummary({
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
            startedAt: "2026-09-03T06:00:00Z", // 13:00 Jakarta
            endedAt: "2026-09-03T06:45:00Z", // 13:45 Jakarta
            durationMinutes: 45,
          },
        ],
        breakMinutes: 45,
      },
      totals: { attendanceMinutes: 480, breakMinutes: 45, workMinutes: 435 },
    });
    const { cells } = buildSyncPayload(summary, MAPPING, {
      dateValueFormat: "iso",
      rowNumber: ROW,
      timezone: TZ,
    });
    expect(cells.find((c) => c.a1 === "B5")?.value).toBe("8:00");
    expect(cells.find((c) => c.a1 === "C5")?.value).toBe("13:00");
    expect(cells.find((c) => c.a1 === "D5")?.value).toBe("13:45");
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
    // Then each category has its deduplicated notes joined by newlines with accumulated duration
    expect(notes.get("meeting")).toBe("Daily standup (2:00)\nSprint planning (1:00)");
    expect(notes.get("training")).toBe("Security training (1:00)");
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
    // Then the task name is used with formatted duration and the blank note produces nothing extra
    expect(notes.get("meeting")).toBe("Team meeting (2:00)");
  });

  it("formats task and duration as <task/notes> (<duration>) matching spreadsheet source", () => {
    const entries = [
      makeEntry({
        id: "e1",
        categoryKey: "meeting",
        taskName: "Infrastructure Management Training",
        notes: null,
        durationMinutes: 120,
      }),
      makeEntry({
        id: "e2",
        categoryKey: "meeting",
        taskName: "Training",
        notes: null,
        durationMinutes: 60,
      }),
    ];
    const notes = compileCategoryNotes(entries);
    expect(notes.get("meeting")).toBe(
      "Infrastructure Management Training (2:00)\nTraining (1:00)",
    );
  });

  it("strips pre-existing duration in parentheses to avoid duplicates", () => {
    const entries = [
      makeEntry({
        id: "e1",
        categoryKey: "research",
        taskName: "IT Department Functions (1:45)",
        notes: null,
        durationMinutes: 105,
      }),
    ];
    const notes = compileCategoryNotes(entries);
    expect(notes.get("research")).toBe("IT Department Functions (1:45)");
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
        value: "Onboarding Wahid (1:00)",
        columnLabel: "Meeting Notes",
        cellType: "notes",
        categoryKey: "meeting",
      },
      {
        a1: "U5",
        value: "Welcoming Message from CEO (1:00)",
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

describe("computeSheetBreakTimes", () => {
  it("returns empty strings when there are no breaks", () => {
    const result = computeSheetBreakTimes([], 0, TZ);
    expect(result).toEqual({ breakStart: "", breakEnd: "" });
  });

  it("returns empty strings when totalBreakMinutes is 0", () => {
    const breaks: BreakDTO[] = [
      {
        id: "b1",
        startedAt: "2026-09-03T03:00:00Z", // 10:00 Jakarta
        endedAt: "2026-09-03T03:00:00Z",
        durationMinutes: 0,
      },
    ];
    const result = computeSheetBreakTimes(breaks, 0, TZ);
    expect(result).toEqual({ breakStart: "", breakEnd: "" });
  });

  it("unites micro-pause breaks under 12:00 starting from 12:00", () => {
    // 15-minute micro break at 09:30 Jakarta
    const breaks: BreakDTO[] = [
      {
        id: "b1",
        startedAt: "2026-09-03T02:30:00Z", // 09:30 Jakarta
        endedAt: "2026-09-03T02:45:00Z", // 09:45 Jakarta
        durationMinutes: 15,
      },
    ];
    const result = computeSheetBreakTimes(breaks, 15, TZ);
    expect(result).toEqual({ breakStart: "12:00", breakEnd: "12:15" });
  });

  it("unites multiple breaks totaling 2:30 (150m) to end at 14:30", () => {
    // User requested rule: if break total is 2:30 then finished break is 14:30
    const breaks: BreakDTO[] = [
      {
        id: "b1",
        startedAt: "2026-09-03T03:00:00Z", // 10:00 Jakarta
        endedAt: "2026-09-03T03:30:00Z", // 10:30 Jakarta (30m)
        durationMinutes: 30,
      },
      {
        id: "b2",
        startedAt: "2026-09-03T05:00:00Z", // 12:00 Jakarta
        endedAt: "2026-09-03T07:00:00Z", // 14:00 Jakarta (120m)
        durationMinutes: 120,
      },
    ];
    const result = computeSheetBreakTimes(breaks, 150, TZ);
    expect(result).toEqual({ breakStart: "12:00", breakEnd: "14:30" });
  });

  it("unites multiple breaks even if all occurred in the afternoon", () => {
    // Two 15-minute breaks in afternoon: 13:00-13:15 and 15:00-15:15
    const breaks: BreakDTO[] = [
      {
        id: "b1",
        startedAt: "2026-09-03T06:00:00Z", // 13:00 Jakarta
        endedAt: "2026-09-03T06:15:00Z", // 13:15 Jakarta
        durationMinutes: 15,
      },
      {
        id: "b2",
        startedAt: "2026-09-03T08:00:00Z", // 15:00 Jakarta
        endedAt: "2026-09-03T08:15:00Z", // 15:15 Jakarta
        durationMinutes: 15,
      },
    ];
    // Multiple breaks united at 12:00 prevents false span deduction
    const result = computeSheetBreakTimes(breaks, 30, TZ);
    expect(result).toEqual({ breakStart: "12:00", breakEnd: "12:30" });
  });

  it("keeps actual timestamps for a single break at or after 12:00", () => {
    // Single 45m break at 13:00 Jakarta
    const breaks: BreakDTO[] = [
      {
        id: "b1",
        startedAt: "2026-09-03T06:00:00Z", // 13:00 Jakarta
        endedAt: "2026-09-03T06:45:00Z", // 13:45 Jakarta
        durationMinutes: 45,
      },
    ];
    const result = computeSheetBreakTimes(breaks, 45, TZ);
    expect(result).toEqual({ breakStart: "13:00", breakEnd: "13:45" });
  });

  it("handles a single break starting at 12:00 noon", () => {
    // Single 60m break at 12:00 Jakarta
    const breaks: BreakDTO[] = [
      {
        id: "b1",
        startedAt: "2026-09-03T05:00:00Z", // 12:00 Jakarta
        endedAt: "2026-09-03T06:00:00Z", // 13:00 Jakarta
        durationMinutes: 60,
      },
    ];
    const result = computeSheetBreakTimes(breaks, 60, TZ);
    expect(result).toEqual({ breakStart: "12:00", breakEnd: "13:00" });
  });

  it("emits only category time and notes cells when tasksOnly is true", () => {
    const summary = makeSummary();
    const payload = buildSyncPayload(summary, NOTES_MAPPING, {
      dateValueFormat: "iso",
      rowNumber: ROW,
      timezone: TZ,
      tasksOnly: true,
    });

    // Does not include clockIn, clockOut, breaks, or totals
    const a1s = payload.cells.map((c) => c.a1);
    expect(a1s).not.toContain(`${NOTES_MAPPING.clockInColumn}${ROW}`);
    expect(a1s).not.toContain(`${NOTES_MAPPING.clockOutColumn}${ROW}`);
    expect(a1s).not.toContain(`${NOTES_MAPPING.breakStartColumn}${ROW}`);
    expect(a1s).not.toContain(`${NOTES_MAPPING.breakEndColumn}${ROW}`);
    expect(a1s).not.toContain(`${NOTES_MAPPING.dailyTotalColumn}${ROW}`);
    expect(a1s).not.toContain(`${NOTES_MAPPING.workTotalColumn}${ROW}`);

    // Includes all 8 category time cells
    expect(a1s).toContain(`${NOTES_MAPPING.categories.website_management}${ROW}`);
    expect(a1s).toContain(`${NOTES_MAPPING.categories.meeting}${ROW}`);
  });
});

