import { describe, expect, it } from "vitest";
import {
  GAP_THRESHOLD_MINUTES,
  gapsBetweenItems,
  interleave,
  itemEnd,
  itemStart,
  type TimelineItem,
} from "./timeline-items";
import type { BreakDTO, DaySummaryDTO, TimeEntryDTO } from "@/lib/types";

const TZ = "UTC";

function mockEntry(overrides: Partial<TimeEntryDTO> = {}): TimeEntryDTO {
  return {
    id: "entry-1",
    taskId: "task-1",
    taskName: "Task",
    categoryId: "cat-1",
    categoryKey: "work",
    categoryName: "Work",
    startedAt: "2026-09-02T09:00:00.000Z",
    endedAt: "2026-09-02T10:00:00.000Z",
    status: "completed",
    notes: null,
    source: "manual",
    durationMinutes: 60,
    pausedSeconds: 0,
    pausedAt: null,
    ...overrides,
  };
}

function mockBreak(overrides: Partial<BreakDTO> = {}): BreakDTO {
  return {
    id: "break-1",
    startedAt: "2026-09-02T12:00:00.000Z",
    endedAt: "2026-09-02T12:30:00.000Z",
    durationMinutes: 30,
    ...overrides,
  };
}

function mockSummary(
  timeEntries: TimeEntryDTO[],
  breaks: BreakDTO[] | null,
): DaySummaryDTO {
  return {
    workDate: "2026-09-02",
    attendance:
      breaks === null
        ? null
        : {
            id: "att-1",
            workDate: "2026-09-02",
            clockInAt: "2026-09-02T08:00:00.000Z",
            clockOutAt: null,
            status: "open",
            activeBreak: null,
            breaks,
            breakMinutes: 0,
          },
    timeEntries,
    totals: { attendanceMinutes: 0, breakMinutes: 0, workMinutes: 0 },
    byCategory: [],
    warnings: [],
    reviewState: "draft",
  };
}

const entryItem = (overrides: Partial<TimeEntryDTO> = {}): TimelineItem => ({
  kind: "entry",
  entry: mockEntry(overrides),
});

const breakItem = (overrides: Partial<BreakDTO> = {}): TimelineItem => ({
  kind: "break",
  breakItem: mockBreak(overrides),
});

describe("interleave", () => {
  it("merges entries and breaks sorted by startedAt", () => {
    const summary = mockSummary(
      [
        mockEntry({ id: "e2", startedAt: "2026-09-02T13:00:00.000Z" }),
        mockEntry({ id: "e1", startedAt: "2026-09-02T09:00:00.000Z" }),
      ],
      [mockBreak({ id: "b1", startedAt: "2026-09-02T12:00:00.000Z" })],
    );
    const items = interleave(summary);
    expect(
      items.map((item) =>
        item.kind === "entry" ? item.entry.id : item.breakItem.id,
      ),
    ).toEqual(["e1", "b1", "e2"]);
  });

  it("treats missing attendance as no breaks", () => {
    const items = interleave(mockSummary([mockEntry()], null));
    expect(items).toHaveLength(1);
    expect(items[0]!.kind).toBe("entry");
  });
});

describe("itemStart / itemEnd", () => {
  it("reads the bounds of entries and breaks", () => {
    expect(itemStart(entryItem())).toBe("2026-09-02T09:00:00.000Z");
    expect(itemEnd(entryItem({ endedAt: null }))).toBeNull();
    expect(itemStart(breakItem())).toBe("2026-09-02T12:00:00.000Z");
    expect(itemEnd(breakItem())).toBe("2026-09-02T12:30:00.000Z");
  });
});

describe("gapsBetweenItems", () => {
  it("uses a 5 minute threshold", () => {
    expect(GAP_THRESHOLD_MINUTES).toBe(5);
  });

  it("reports no gap at exactly 5 minutes", () => {
    const items = [
      entryItem({ id: "a", endedAt: "2026-09-02T10:00:00.000Z" }),
      entryItem({ id: "b", startedAt: "2026-09-02T10:05:00.000Z" }),
    ];
    expect(gapsBetweenItems(items, TZ)).toEqual([]);
  });

  it("reports a gap at 6 minutes with exact boundaries", () => {
    const items = [
      entryItem({ id: "a", endedAt: "2026-09-02T10:00:00.000Z" }),
      breakItem({ startedAt: "2026-09-02T10:06:00.000Z" }),
    ];
    expect(gapsBetweenItems(items, TZ)).toEqual([
      {
        afterIndex: 0,
        fromIso: "2026-09-02T10:00:00.000Z",
        toIso: "2026-09-02T10:06:00.000Z",
        fromClock: "10:00",
        toClock: "10:06",
        minutes: 6,
      },
    ]);
  });

  it("never lets an open item bound a gap", () => {
    const items = [
      entryItem({ id: "a", endedAt: null, status: "active" }),
      entryItem({ id: "b", startedAt: "2026-09-02T15:00:00.000Z" }),
    ];
    expect(gapsBetweenItems(items, TZ)).toEqual([]);
  });
});
