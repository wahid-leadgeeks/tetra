import { describe, expect, it } from "vitest";
import {
  detectOverlaps,
  entryDurationMinutes,
  OverlapError,
  toTimeEntryDTO,
  validateNoOverlap,
  type OverlapEntry,
  type TimeEntryCore,
} from "./domain";

const TZ = "UTC";
const NOW = new Date("2026-09-03T12:00:00Z");

/** 2026-09-03T{hh}:{mm}:00Z */
const T = (hour: number, minute = 0): Date =>
  new Date(
    `2026-09-03T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`,
  );

interface EntryInit {
  id: string;
  taskId: string;
  startedAt: Date;
  endedAt?: Date | null;
  status?: TimeEntryCore["status"];
  pausedAt?: Date | null;
  pausedSeconds?: number;
  notes?: string | null;
  source?: TimeEntryCore["source"];
}

function makeEntry(init: EntryInit): TimeEntryCore {
  return {
    id: init.id,
    taskId: init.taskId,
    categoryId: "cat-1",
    startedAt: init.startedAt,
    endedAt: init.endedAt ?? null,
    status: init.status ?? "completed",
    pausedAt: init.pausedAt ?? null,
    pausedSeconds: init.pausedSeconds ?? 0,
    notes: init.notes ?? null,
    source: init.source ?? "timer",
  };
}

function withName(entry: TimeEntryCore, taskName: string): OverlapEntry {
  return { ...entry, taskName };
}

describe("entryDurationMinutes", () => {
  it("computes elapsed minutes for a completed entry", () => {
    const entry = makeEntry({
      id: "e1",
      taskId: "t1",
      startedAt: T(9),
      endedAt: T(10, 30),
    });
    expect(entryDurationMinutes(entry, NOW)).toBe(90);
  });

  it("uses now as the end for a running entry", () => {
    const entry = makeEntry({
      id: "e1",
      taskId: "t1",
      startedAt: T(9),
      status: "active",
    });
    expect(entryDurationMinutes(entry, T(9, 45))).toBe(45);
  });

  it("subtracts an open pause from a paused entry", () => {
    const entry = makeEntry({
      id: "e1",
      taskId: "t1",
      startedAt: T(9),
      status: "paused",
      pausedAt: T(9, 40),
    });
    // span 50 min, open pause 10 min
    expect(entryDurationMinutes(entry, T(9, 50))).toBe(40);
  });

  it("subtracts accumulated pause seconds and the open pause together", () => {
    const entry = makeEntry({
      id: "e1",
      taskId: "t1",
      startedAt: T(9),
      status: "paused",
      pausedAt: T(9, 30),
      pausedSeconds: 300,
    });
    // span 45 min − 5 min accumulated − 15 min open pause
    expect(entryDurationMinutes(entry, T(9, 45))).toBe(25);
  });

  it("never returns a negative duration", () => {
    const entry = makeEntry({
      id: "e1",
      taskId: "t1",
      startedAt: T(9),
      endedAt: T(9, 10),
      pausedSeconds: 3600,
    });
    expect(entryDurationMinutes(entry, NOW)).toBe(0);
  });

  it("floors partial minutes", () => {
    const entry = makeEntry({
      id: "e1",
      taskId: "t1",
      startedAt: new Date("2026-09-03T09:00:30Z"),
      endedAt: new Date("2026-09-03T09:01:20Z"),
    });
    expect(entryDurationMinutes(entry, NOW)).toBe(0);
  });
});

describe("detectOverlaps", () => {
  it("does not flag adjacent entries", () => {
    const entries = [
      withName(
        makeEntry({ id: "a", taskId: "ta", startedAt: T(8), endedAt: T(9) }),
        "Website Management",
      ),
      withName(
        makeEntry({ id: "b", taskId: "tb", startedAt: T(9), endedAt: T(10) }),
        "Meeting",
      ),
    ];
    expect(detectOverlaps(entries, TZ, NOW)).toEqual([]);
  });

  it("flags intersecting entries with the design error message", () => {
    const entries = [
      withName(
        makeEntry({ id: "a", taskId: "ta", startedAt: T(8), endedAt: T(10) }),
        "Website Management",
      ),
      withName(
        makeEntry({ id: "b", taskId: "tb", startedAt: T(9), endedAt: T(11) }),
        "Meeting",
      ),
    ];
    const warnings = detectOverlaps(entries, TZ, NOW);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.entryIds).toEqual(["a", "b"]);
    expect(warnings[0]?.message).toBe(
      "Two activities overlap: Website Management 08:00–10:00 / Meeting 09:00–11:00",
    );
  });

  it("treats a running entry as extending until now", () => {
    const entries = [
      withName(
        makeEntry({ id: "a", taskId: "ta", startedAt: T(8), status: "active" }),
        "Research",
      ),
      withName(
        makeEntry({ id: "b", taskId: "tb", startedAt: T(10), endedAt: T(11) }),
        "Meeting",
      ),
    ];
    const warnings = detectOverlaps(entries, TZ, NOW);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toBe(
      "Two activities overlap: Research 08:00–12:00 / Meeting 10:00–11:00",
    );
  });

  it("reports every overlapping pair", () => {
    const entries = [
      withName(
        makeEntry({ id: "a", taskId: "ta", startedAt: T(8), endedAt: T(10) }),
        "A",
      ),
      withName(
        makeEntry({ id: "b", taskId: "tb", startedAt: T(9), endedAt: T(11) }),
        "B",
      ),
      withName(
        makeEntry({ id: "c", taskId: "tc", startedAt: T(9, 30), endedAt: T(12) }),
        "C",
      ),
    ];
    expect(detectOverlaps(entries, TZ, NOW)).toHaveLength(3);
  });

  it("ignores disjoint entries", () => {
    const entries = [
      withName(
        makeEntry({ id: "a", taskId: "ta", startedAt: T(8), endedAt: T(9) }),
        "A",
      ),
      withName(
        makeEntry({ id: "b", taskId: "tb", startedAt: T(11), endedAt: T(12) }),
        "B",
      ),
    ];
    expect(detectOverlaps(entries, TZ, NOW)).toEqual([]);
  });
});

describe("validateNoOverlap", () => {
  it("throws OverlapError naming the conflicting ranges", () => {
    const existing = makeEntry({
      id: "e1",
      taskId: "task-1",
      startedAt: T(9, 30),
      endedAt: T(11),
    });
    let thrown: OverlapError | undefined;
    try {
      validateNoOverlap(
        { id: "c1", taskName: "Manual Task", startedAt: T(9), endedAt: T(10) },
        [existing],
        new Map([["task-1", "Existing Task"]]),
        TZ,
        NOW,
      );
    } catch (error) {
      if (error instanceof OverlapError) thrown = error;
    }
    expect(thrown).toBeDefined();
    expect(thrown?.details).toEqual([
      {
        entryIds: ["c1", "e1"],
        message:
          "Two activities overlap: Manual Task 09:00–10:00 / Existing Task 09:30–11:00",
      },
    ]);
    expect(thrown?.message).toBe(
      "Two activities overlap: Manual Task 09:00–10:00 / Existing Task 09:30–11:00",
    );
  });

  it("orders the pair by start time", () => {
    const existing = makeEntry({
      id: "e1",
      taskId: "task-1",
      startedAt: T(9),
      endedAt: T(10, 30),
    });
    let message: string | undefined;
    try {
      validateNoOverlap(
        { taskName: "Later Task", startedAt: T(10), endedAt: T(11) },
        [existing],
        new Map([["task-1", "Existing Task"]]),
        TZ,
        NOW,
      );
    } catch (error) {
      if (error instanceof OverlapError) message = error.details[0]?.message;
    }
    expect(message).toBe(
      "Two activities overlap: Existing Task 09:00–10:30 / Later Task 10:00–11:00",
    );
  });

  it("accepts adjacent ranges", () => {
    const existing = makeEntry({
      id: "e1",
      taskId: "task-1",
      startedAt: T(9),
      endedAt: T(10),
    });
    expect(() =>
      validateNoOverlap(
        { taskName: "Earlier", startedAt: T(8), endedAt: T(9) },
        [existing],
        new Map([["task-1", "Existing Task"]]),
        TZ,
        NOW,
      ),
    ).not.toThrow();
  });

  it("ignores the candidate itself by id", () => {
    const self = makeEntry({
      id: "e1",
      taskId: "task-1",
      startedAt: T(9, 30),
      endedAt: T(11),
    });
    expect(() =>
      validateNoOverlap(
        { id: "e1", taskName: "Same", startedAt: T(9), endedAt: T(10) },
        [self],
        new Map([["task-1", "Same"]]),
        TZ,
        NOW,
      ),
    ).not.toThrow();
  });

  it("conflicts with a still-running entry", () => {
    const running = makeEntry({
      id: "e1",
      taskId: "task-1",
      startedAt: T(8),
      status: "active",
    });
    expect(() =>
      validateNoOverlap(
        { taskName: "Manual Task", startedAt: T(11), endedAt: T(11, 30) },
        [running],
        new Map([["task-1", "Running Task"]]),
        TZ,
        NOW,
      ),
    ).toThrow(OverlapError);
  });
});

describe("toTimeEntryDTO", () => {
  const task = { name: "Deploy" };
  const category = { key: "infrastructure", name: "Infrastructure" };

  it("maps a completed entry with server-calculated duration", () => {
    const entry = makeEntry({
      id: "e1",
      taskId: "task-1",
      startedAt: T(9),
      endedAt: T(11),
      pausedSeconds: 600,
      notes: "deploy notes",
      source: "manual",
    });
    expect(toTimeEntryDTO(entry, task, category, NOW)).toEqual({
      id: "e1",
      taskId: "task-1",
      taskName: "Deploy",
      categoryId: "cat-1",
      categoryKey: "infrastructure",
      categoryName: "Infrastructure",
      startedAt: "2026-09-03T09:00:00.000Z",
      endedAt: "2026-09-03T11:00:00.000Z",
      status: "completed",
      notes: "deploy notes",
      source: "manual",
      durationMinutes: 110,
      pausedSeconds: 600,
      pausedAt: null,
    });
  });

  it("reports null duration and null endedAt while active or paused", () => {
    const active = makeEntry({
      id: "e1",
      taskId: "task-1",
      startedAt: T(9),
      status: "active",
    });
    const activeDto = toTimeEntryDTO(active, task, category, NOW);
    expect(activeDto.durationMinutes).toBeNull();
    expect(activeDto.endedAt).toBeNull();

    const paused = makeEntry({
      id: "e2",
      taskId: "task-1",
      startedAt: T(9),
      status: "paused",
      pausedAt: T(9, 30),
    });
    const pausedDto = toTimeEntryDTO(paused, task, category, NOW);
    expect(pausedDto.durationMinutes).toBeNull();
    expect(pausedDto.pausedAt).toBe("2026-09-03T09:30:00.000Z");
  });
});
