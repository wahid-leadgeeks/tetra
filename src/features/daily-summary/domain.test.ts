import { describe, expect, it } from "vitest";
import { buildDaySummary } from "./domain";
import type { BuildDaySummaryInput, DaySummaryEntryInput } from "./types";

const TZ = "Asia/Jakarta"; // UTC+7, no DST — deterministic local times
const NOW = new Date("2026-09-02T10:00:00Z"); // 17:00 local

/** Instant on 2026-09-<day> at hh:mm local in TZ. */
function at(day: number, hour: number, minute = 0): Date {
  return new Date(Date.UTC(2026, 8, day, hour - 7, minute));
}

/** Instant on the local day 2026-09-02. */
function local(hour: number, minute = 0): Date {
  return at(2, hour, minute);
}

const CATS = [
  { id: "c1", key: "website_management", name: "Website Management", sortOrder: 10 },
  { id: "c2", key: "cyber_security", name: "Cyber Security", sortOrder: 20 },
  {
    id: "c3",
    key: "technology_innovation",
    name: "Technology Optimization & Innovation",
    sortOrder: 30,
  },
  {
    id: "c4",
    key: "infrastructure_management",
    name: "Infrastructure Management",
    sortOrder: 40,
  },
  { id: "c5", key: "research", name: "Research", sortOrder: 50 },
  { id: "c6", key: "meeting", name: "Meeting", sortOrder: 60 },
  { id: "c7", key: "training", name: "Training", sortOrder: 70 },
  { id: "c8", key: "other_tasks", name: "Other Tasks", sortOrder: 80 },
];

function entry(
  partial: Partial<DaySummaryEntryInput> &
    Pick<DaySummaryEntryInput, "id" | "startedAt">,
): DaySummaryEntryInput {
  return {
    taskId: "task-1",
    taskName: "Task",
    categoryId: "c1",
    categoryKey: "website_management",
    categoryName: "Website Management",
    endedAt: null,
    status: "completed",
    pausedAt: null,
    pausedSeconds: 0,
    notes: null,
    source: "timer",
    ...partial,
  };
}

function input(overrides: Partial<BuildDaySummaryInput> = {}): BuildDaySummaryInput {
  return {
    workDate: "2026-09-02",
    tz: TZ,
    attendance: {
      id: "att-1",
      clockInAt: local(8, 45),
      clockOutAt: local(17, 10),
      status: "closed",
    },
    breaks: [],
    entries: [],
    categories: CATS,
    reviewStateStored: "draft",
    now: NOW,
    ...overrides,
  };
}

describe("buildDaySummary totals", () => {
  it("computes attendance and break totals with an open break running until now", () => {
    const summary = buildDaySummary(
      input({
        attendance: {
          id: "att-1",
          clockInAt: local(8, 45),
          clockOutAt: null,
          status: "open",
        },
        breaks: [
          { id: "b1", startedAt: local(12, 0), endedAt: local(12, 30) },
          { id: "b2", startedAt: local(15, 0), endedAt: null },
        ],
      }),
    );

    expect(summary.totals.attendanceMinutes).toBe(495); // 08:45 → 17:00
    expect(summary.totals.breakMinutes).toBe(150); // 30 closed + 120 open until now
    expect(summary.attendance?.activeBreak?.id).toBe("b2");
    expect(summary.attendance?.activeBreak?.durationMinutes).toBeNull(); // open → null
    expect(summary.attendance?.breaks[0]?.durationMinutes).toBe(30);
  });

  it("uses clock-out (not now) for closed attendance minutes", () => {
    const summary = buildDaySummary(input());

    expect(summary.totals.attendanceMinutes).toBe(505); // 08:45 → 17:10
  });

  it("subtracts accumulated pause seconds from entry duration", () => {
    const summary = buildDaySummary(
      input({
        entries: [
          entry({
            id: "e1",
            taskName: "Deploy",
            startedAt: local(9, 0),
            endedAt: local(11, 0),
            pausedSeconds: 300, // 5m
          }),
        ],
      }),
    );

    expect(summary.timeEntries[0]?.durationMinutes).toBe(115);
    expect(summary.totals.workMinutes).toBe(115);
  });

  it("subtracts the currently-paused span and reports null duration for active entries", () => {
    const summary = buildDaySummary(
      input({
        entries: [
          // Paused at 14:00, now 17:00 → live pause of 180m, so 60m worked.
          entry({
            id: "e1",
            taskName: "Paused task",
            categoryId: "c6",
            categoryKey: "meeting",
            categoryName: "Meeting",
            startedAt: local(13, 0),
            status: "paused",
            pausedAt: local(14, 0),
          }),
          // Active since 16:00 → 60m so far, but durationMinutes stays null.
          entry({
            id: "e2",
            taskName: "Running task",
            startedAt: local(16, 0),
            status: "active",
          }),
        ],
      }),
    );

    expect(summary.timeEntries[0]?.durationMinutes).toBe(60);
    expect(summary.timeEntries[1]?.durationMinutes).toBeNull();
    expect(summary.totals.workMinutes).toBe(120); // active time still counts
  });
});

describe("buildDaySummary byCategory", () => {
  it("lists every category ordered by sortOrder, including zero-minute ones", () => {
    const summary = buildDaySummary(
      input({
        categories: [...CATS].reverse(), // prove output is re-sorted
        entries: [
          entry({
            id: "e1",
            taskName: "Website work",
            startedAt: local(9, 0),
            endedAt: local(10, 0),
          }),
          entry({
            id: "e2",
            taskName: "Standup",
            categoryId: "c6",
            categoryKey: "meeting",
            categoryName: "Meeting",
            startedAt: local(10, 0),
            endedAt: local(10, 30),
          }),
        ],
      }),
    );

    expect(summary.byCategory.map((c) => c.key)).toEqual([
      "website_management",
      "cyber_security",
      "technology_innovation",
      "infrastructure_management",
      "research",
      "meeting",
      "training",
      "other_tasks",
    ]);
    expect(summary.byCategory[0]?.minutes).toBe(60);
    expect(summary.byCategory[5]?.minutes).toBe(30);
    expect(summary.byCategory[6]).toMatchObject({ key: "training", minutes: 0 });
  });
});

describe("buildDaySummary warnings", () => {
  it("does not warn when entries are merely adjacent", () => {
    const summary = buildDaySummary(
      input({
        entries: [
          entry({ id: "e1", startedAt: local(9, 0), endedAt: local(10, 0) }),
          entry({ id: "e2", startedAt: local(10, 0), endedAt: local(11, 0) }),
        ],
      }),
    );

    expect(summary.warnings).toEqual([]);
    expect(summary.reviewState).toBe("ready");
  });

  it("warns about overlapping entries with zoned clock ranges", () => {
    const summary = buildDaySummary(
      input({
        entries: [
          entry({
            id: "e1",
            taskName: "Deploy",
            startedAt: local(9, 0),
            endedAt: local(10, 0),
          }),
          entry({
            id: "e2",
            taskName: "Standup",
            categoryId: "c6",
            categoryKey: "meeting",
            categoryName: "Meeting",
            startedAt: local(9, 45),
            endedAt: local(10, 15),
          }),
        ],
      }),
    );

    expect(summary.warnings).toEqual([
      {
        type: "overlap",
        message:
          "Two activities overlap: Deploy 09:00–10:00 / Standup 09:45–10:15",
        entryIds: ["e1", "e2"],
      },
    ]);
    expect(summary.reviewState).toBe("draft"); // warnings block "ready"
  });

  it("warns about a 6m gap between consecutive entries but not a 5m gap", () => {
    const sixMinGap = buildDaySummary(
      input({
        entries: [
          entry({ id: "e1", taskName: "Alpha", startedAt: local(9, 0), endedAt: local(10, 0) }),
          entry({ id: "e2", taskName: "Beta", startedAt: local(10, 6), endedAt: local(11, 0) }),
        ],
      }),
    );
    const gap = sixMinGap.warnings.find((w) => w.type === "gap");
    expect(gap).toEqual({
      type: "gap",
      minutes: 6,
      message: "6m gap between Alpha and Beta",
    });
    // 08:45→09:00 and 11:00→17:10 are attendance edges, not entry gaps.
    expect(sixMinGap.warnings.filter((w) => w.type === "gap")).toHaveLength(1);

    const fiveMinGap = buildDaySummary(
      input({
        entries: [
          entry({ id: "e1", startedAt: local(9, 0), endedAt: local(10, 0) }),
          entry({ id: "e2", startedAt: local(10, 5), endedAt: local(11, 0) }),
        ],
      }),
    );
    expect(fiveMinGap.warnings.filter((w) => w.type === "gap")).toHaveLength(0);
    expect(fiveMinGap.reviewState).toBe("ready");
  });

  it("does not warn about a gap between entries when it is covered by a scheduled break", () => {
    // 11:30 to 13:00 (90 min gap) covered by 11:30 to 13:00 break
    const summary = buildDaySummary(
      input({
        attendance: {
          id: "att-1",
          clockInAt: local(8, 30),
          clockOutAt: local(16, 20),
          status: "closed",
        },
        breaks: [
          {
            id: "b1",
            startedAt: local(11, 30),
            endedAt: local(13, 0),
          },
        ],
        entries: [
          entry({
            id: "e1",
            taskName: "Independent learning and exploration",
            startedAt: local(10, 35),
            endedAt: local(11, 30),
          }),
          entry({
            id: "e2",
            taskName: "Final Practice for Time & Task Tracking",
            startedAt: local(13, 0),
            endedAt: local(14, 30),
          }),
        ],
      }),
    );

    const gapWarnings = summary.warnings.filter((w) => w.type === "gap");
    expect(gapWarnings).toHaveLength(0);
    expect(summary.reviewState).toBe("ready");
  });

  it("warns about remaining unallocated gap when a break only partially covers the span", () => {
    // 11:30 to 13:00 (90 min span), but break is only 11:30 to 12:00 (30 min) -> 60 min uncovered
    const summary = buildDaySummary(
      input({
        attendance: {
          id: "att-1",
          clockInAt: local(8, 30),
          clockOutAt: local(16, 20),
          status: "closed",
        },
        breaks: [
          {
            id: "b1",
            startedAt: local(11, 30),
            endedAt: local(12, 0),
          },
        ],
        entries: [
          entry({
            id: "e1",
            taskName: "Task 1",
            startedAt: local(10, 35),
            endedAt: local(11, 30),
          }),
          entry({
            id: "e2",
            taskName: "Task 2",
            startedAt: local(13, 0),
            endedAt: local(14, 30),
          }),
        ],
      }),
    );

    const gapWarnings = summary.warnings.filter((w) => w.type === "gap");
    expect(gapWarnings).toHaveLength(1);
    expect(gapWarnings[0]).toEqual({
      type: "gap",
      minutes: 60,
      message: "60m gap between Task 1 and Task 2",
    });
  });

  it("warns when attendance is still open (missing clock out)", () => {
    const summary = buildDaySummary(
      input({
        attendance: {
          id: "att-1",
          clockInAt: local(8, 45),
          clockOutAt: null,
          status: "open",
        },
      }),
    );

    expect(summary.warnings).toContainEqual({
      type: "missing_clock_out",
      message: "Missing clock out",
    });
    expect(summary.reviewState).toBe("draft");
  });

  it("warns when a task is still open", () => {
    const summary = buildDaySummary(
      input({
        entries: [
          entry({ id: "e1", taskName: "Still running", startedAt: local(16, 0), status: "active" }),
        ],
      }),
    );

    expect(summary.warnings).toContainEqual({
      type: "open_task",
      message: "A task is still open",
    });
  });

  it("warns when attendance is closed but no work was recorded", () => {
    const summary = buildDaySummary(input());

    expect(summary.warnings).toContainEqual({
      type: "no_work",
      message: "No work recorded",
    });
    expect(summary.totals.workMinutes).toBe(0);
    expect(summary.reviewState).toBe("draft");
  });
});

describe("buildDaySummary review state", () => {
  it("derives ready from draft when attendance is closed and warnings are empty", () => {
    const summary = buildDaySummary(
      input({
        entries: [
          entry({ id: "e1", startedAt: local(9, 0), endedAt: local(10, 0) }),
          entry({ id: "e2", startedAt: local(10, 0), endedAt: local(11, 0) }),
        ],
      }),
    );

    expect(summary.reviewState).toBe("ready");
  });

  it("passes stored synced through untouched", () => {
    const summary = buildDaySummary(input({ reviewStateStored: "synced" }));

    expect(summary.reviewState).toBe("synced");
  });

  it("passes stored changed_after_sync through untouched", () => {
    const summary = buildDaySummary(
      input({ reviewStateStored: "changed_after_sync" }),
    );

    expect(summary.reviewState).toBe("changed_after_sync");
  });

  it("keeps reviewed even while warnings exist", () => {
    const summary = buildDaySummary(
      input({
        reviewStateStored: "reviewed",
        attendance: {
          id: "att-1",
          clockInAt: local(8, 45),
          clockOutAt: null,
          status: "open",
        },
      }),
    );

    expect(summary.reviewState).toBe("reviewed");
    expect(summary.warnings.some((w) => w.type === "missing_clock_out")).toBe(true);
  });
});

describe("buildDaySummary day window", () => {
  it("only aggregates entries overlapping the local day", () => {
    const summary = buildDaySummary(
      input({
        entries: [
          // Yesterday evening, fully outside.
          entry({
            id: "old",
            taskName: "Yesterday",
            startedAt: at(1, 20, 0),
            endedAt: at(1, 21, 0),
          }),
          // Ends exactly at local midnight — half-open day starts there.
          entry({
            id: "midnight",
            taskName: "Ended at midnight",
            startedAt: at(1, 23, 0),
            endedAt: at(2, 0, 0),
          }),
          // Starts exactly at local midnight — included.
          entry({
            id: "first",
            taskName: "Started at midnight",
            startedAt: at(2, 0, 0),
            endedAt: at(2, 1, 0),
          }),
        ],
      }),
    );

    expect(summary.timeEntries.map((e) => e.id)).toEqual(["first"]);
    expect(summary.totals.workMinutes).toBe(60);
  });

  it("automatically expands attendance boundaries when tasks or breaks extend past clock-in or clock-out", () => {
    // Attendance originally 08:20 -> 17:00 (520m)
    // Task 1: 08:00 -> 12:00 (starts before clock-in)
    // Break 1: 12:00 -> 13:00
    // Task 2: 17:00 -> 18:00 (ends after clock-out)
    const summary = buildDaySummary(
      input({
        attendance: {
          id: "att-1",
          clockInAt: local(8, 20),
          clockOutAt: local(17, 0),
          status: "closed",
        },
        breaks: [
          {
            id: "b1",
            startedAt: local(12, 0),
            endedAt: local(13, 0),
          },
        ],
        entries: [
          entry({
            id: "e1",
            taskName: "Independent learning",
            startedAt: local(8, 0),
            endedAt: local(12, 0),
          }),
          entry({
            id: "e2",
            taskName: "Research",
            startedAt: local(17, 0),
            endedAt: local(18, 0),
          }),
        ],
      }),
    );

    // Attendance should be expanded to 08:00 -> 18:00 (600 minutes / 10h)
    expect(summary.attendance?.clockInAt).toBe(local(8, 0).toISOString());
    expect(summary.attendance?.clockOutAt).toBe(local(18, 0).toISOString());
    expect(summary.totals.attendanceMinutes).toBe(600);
    expect(summary.totals.workMinutes).toBe(300); // 4h + 1h = 5h = 300m
    expect(summary.totals.breakMinutes).toBe(60); // 1h = 60m
  });
});
