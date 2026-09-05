/**
 * Split-entry service tests. planSplit is pure and tested directly; the
 * database is mocked at the db boundary only — assertions cover the UPDATE
 * and INSERT payloads, the day-changed flag, overlap re-validation, and the
 * returned DTOs.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { timeEntries } from "@/server/db/schema";
import type { TimeEntryDTO } from "@/lib/types";
import { OverlapError } from "./domain";
import type { TimeEntryCore } from "./domain";
import { planSplit, splitTimeEntry } from "./entry-split";

const { txSelect, txUpdate, txInsert, transactionMock } = vi.hoisted(() => {
  const state = {
    selectRows: [] as unknown[],
    updateCalls: [] as { set: unknown; where: unknown }[],
    insertCalls: [] as { values: unknown }[],
  };
  function makeSelectChain() {
    const promise = Promise.resolve(state.selectRows);
    const chain: Record<string, unknown> = {
      then: promise.then.bind(promise),
      catch: promise.catch.bind(promise),
    };
    for (const method of ["from", "where", "limit", "for", "orderBy"]) {
      chain[method] = () => chain;
    }
    return chain;
  }
  const tx = {
    select: () => makeSelectChain(),
    update: () => {
      const call: { set: unknown; where: unknown } = {
        set: undefined,
        where: undefined,
      };
      const chain = {
        set(value: unknown) {
          call.set = value;
          return chain;
        },
        where(value: unknown) {
          call.where = value;
          return chain;
        },
      };
      state.updateCalls.push(call);
      return chain;
    },
    insert: () => {
      const call = { values: undefined as unknown };
      const chain = {
        values(value: unknown) {
          call.values = value;
          return chain;
        },
        returning: async () => [{ id: "entry-second" }],
      };
      state.insertCalls.push(call);
      return chain;
    },
  };
  return {
    txSelect: state,
    txUpdate: state.updateCalls,
    txInsert: state.insertCalls,
    transactionMock: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
  };
});

vi.mock("@/server/db", () => ({
  db: { transaction: (fn: (tx: unknown) => Promise<unknown>) => transactionMock(fn) },
}));

const {
  assertCategoryExistsMock,
  fetchEntriesInRangeMock,
  markDayChangedMock,
  requireEntryDtoMock,
  upsertTaskMock,
} = vi.hoisted(() => ({
  assertCategoryExistsMock: vi.fn(),
  fetchEntriesInRangeMock: vi.fn(),
  markDayChangedMock: vi.fn(),
  requireEntryDtoMock: vi.fn(),
  upsertTaskMock: vi.fn(),
}));

vi.mock("./entry-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./entry-helpers")>();
  return {
    ...actual,
    assertCategoryExists: assertCategoryExistsMock,
    fetchEntriesInRange: fetchEntriesInRangeMock,
    markDayChanged: markDayChangedMock,
    requireEntryDto: requireEntryDtoMock,
    upsertTask: upsertTaskMock,
  };
});

type EntryRow = typeof timeEntries.$inferSelect;

const START = new Date("2026-09-03T02:00:00Z"); // 09:00 Jakarta
const END = new Date("2026-09-03T03:00:00Z"); // 10:00 Jakarta
const SPLIT = new Date("2026-09-03T02:30:00Z"); // 09:30 Jakarta

function makeEntryRow(overrides: Partial<EntryRow> = {}): EntryRow {
  return {
    id: "entry-1",
    userId: "user-1",
    taskId: "task-1",
    categoryId: "cat-meeting",
    startedAt: START,
    endedAt: END,
    status: "completed",
    pausedAt: null,
    pausedSeconds: 0,
    notes: "Original notes",
    source: "manual",
    createdAt: START,
    updatedAt: START,
    ...overrides,
  };
}

function makeEntryDTO(id: string): TimeEntryDTO {
  return {
    id,
    taskId: "task-1",
    taskName: "Team meeting",
    categoryId: "cat-meeting",
    categoryKey: "meeting",
    categoryName: "Meeting",
    startedAt: START.toISOString(),
    endedAt: (id === "entry-1" ? SPLIT : END).toISOString(),
    status: "completed",
    notes: null,
    source: "manual",
    durationMinutes: 30,
    pausedSeconds: 0,
    pausedAt: null,
  };
}

function noOverlaps() {
  fetchEntriesInRangeMock.mockResolvedValue({
    entries: [] as TimeEntryCore[],
    taskNamesById: new Map<string, string>(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  txSelect.selectRows = [];
  txUpdate.length = 0;
  txInsert.length = 0;
  requireEntryDtoMock.mockImplementation(async (_userId: string, id: string) =>
    makeEntryDTO(id),
  );
  noOverlaps();
});

describe("planSplit", () => {
  it("rejects a split point at or before the start", () => {
    // Given a completed entry and split points on/before the start
    const entry = makeEntryRow();
    // When planning the split
    // Then each candidate is rejected
    for (const at of [
      START,
      new Date(START.getTime() - 60_000),
    ]) {
      expect(() => planSplit(entry, at)).toThrow(
        "Split time must be strictly between start and end",
      );
    }
  });

  it("rejects a split point at or after the end", () => {
    // Given a completed entry and split points on/after the end
    const entry = makeEntryRow();
    // When planning the split
    // Then each candidate is rejected
    for (const at of [END, new Date(END.getTime() + 60_000)]) {
      expect(() => planSplit(entry, at)).toThrow(
        "Split time must be strictly between start and end",
      );
    }
  });

  it("rejects an entry that is not completed", () => {
    // Given a still-running entry
    const entry = makeEntryRow({ status: "active", endedAt: null });
    // When planning a split at its midpoint
    // Then the split is rejected
    expect(() => planSplit(entry, SPLIT)).toThrow(
      "Only completed entries can be split",
    );
  });

  it("produces adjacent segments that preserve wall time exactly", () => {
    // Given a 60-minute completed entry
    const entry = makeEntryRow();
    // When planning a split at the 30-minute mark
    const plan = planSplit(entry, SPLIT);
    // Then the first ends where the second starts, and the second ends at the original end
    expect(plan.first.endedAt).toEqual(SPLIT);
    expect(plan.second.startedAt).toEqual(SPLIT);
    expect(plan.second.endedAt).toEqual(END);
    const firstWall = plan.first.endedAt.getTime() - START.getTime();
    const secondWall =
      plan.second.endedAt.getTime() - plan.second.startedAt.getTime();
    expect(firstWall + secondWall).toBe(END.getTime() - START.getTime());
  });

  it("splits paused seconds proportionally, preserving the total", () => {
    // Given a 60-minute entry with 20 paused minutes
    const entry = makeEntryRow({ pausedSeconds: 1200 });
    // When planning a split at the 30-minute mark
    const plan = planSplit(entry, SPLIT);
    // Then pause is divided by wall ratio and sums to the original
    expect(plan.first.pausedSeconds).toBe(600);
    expect(plan.second.pausedSeconds).toBe(600);
    expect(plan.first.pausedSeconds + plan.second.pausedSeconds).toBe(1200);
  });

  it("keeps zero pause at zero", () => {
    // Given an entry with no paused time
    const entry = makeEntryRow({ pausedSeconds: 0 });
    // When planning the split
    const plan = planSplit(entry, SPLIT);
    // Then both segments stay unpaused
    expect(plan.first.pausedSeconds).toBe(0);
    expect(plan.second.pausedSeconds).toBe(0);
  });
});

describe("splitTimeEntry", () => {
  it("updates the first segment and inserts the second, keeping the task", async () => {
    // Given a stored completed entry and no conflicting entries
    txSelect.selectRows = [makeEntryRow()];
    // When the entry is split at 09:30
    const result = await splitTimeEntry(
      "user-1",
      "Asia/Jakarta",
      "entry-1",
      SPLIT.toISOString(),
    );
    // Then the original row is cut at the split point
    expect(txUpdate).toHaveLength(1);
    expect(txUpdate[0]!.set).toMatchObject({
      endedAt: SPLIT,
      pausedSeconds: 0,
    });
    // And the second segment covers the rest, same task and category
    expect(txInsert).toHaveLength(1);
    expect(txInsert[0]!.values).toMatchObject({
      userId: "user-1",
      taskId: "task-1",
      categoryId: "cat-meeting",
      startedAt: SPLIT,
      endedAt: END,
      status: "completed",
      notes: null,
      source: "manual",
    });
    // And both overlap checks exclude the original row — the row still
    // spans the full range during validation, so the second segment must
    // not be checked against its own origin
    expect(fetchEntriesInRangeMock).toHaveBeenCalledTimes(2);
    for (const call of fetchEntriesInRangeMock.mock.calls) {
      expect(call[4]).toBe("entry-1");
    }
    // And the day is flagged changed and both DTOs are returned
    expect(markDayChangedMock).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "2026-09-03",
    );
    expect(result.first.id).toBe("entry-1");
    expect(result.second.id).toBe("entry-second");
  });

  it("reassigns the second segment to a new task and category", async () => {
    // Given a stored completed entry
    txSelect.selectRows = [makeEntryRow()];
    upsertTaskMock.mockResolvedValue({ id: "task-2" });
    // When splitting with a second task name and category
    await splitTimeEntry(
      "user-1",
      "Asia/Jakarta",
      "entry-1",
      SPLIT.toISOString(),
      "Server review",
      "cat-cyber",
    );
    // Then the task is upserted and the insert uses the new ids
    expect(upsertTaskMock).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "Server review",
      "cat-cyber",
      expect.any(Date),
    );
    expect(assertCategoryExistsMock).toHaveBeenCalledWith(
      expect.anything(),
      "cat-cyber",
    );
    expect(txInsert[0]!.values).toMatchObject({
      taskId: "task-2",
      categoryId: "cat-cyber",
    });
  });

  it("rejects an unknown entry", async () => {
    // Given no stored entry for that id
    txSelect.selectRows = [];
    // When splitting
    // Then the service rejects with the human message
    await expect(
      splitTimeEntry("user-1", "Asia/Jakarta", "missing", SPLIT.toISOString()),
    ).rejects.toThrow("Entry not found");
  });

  it("rejects a split point outside the entry", async () => {
    // Given a stored completed entry
    txSelect.selectRows = [makeEntryRow()];
    // When splitting exactly at the end time
    // Then the pure validation rejects it before any write
    await expect(
      splitTimeEntry("user-1", "Asia/Jakarta", "entry-1", END.toISOString()),
    ).rejects.toThrow("Split time must be strictly between start and end");
    expect(txUpdate).toHaveLength(0);
    expect(txInsert).toHaveLength(0);
  });

  it("rejects a running entry", async () => {
    // Given a stored active entry
    txSelect.selectRows = [makeEntryRow({ status: "active", endedAt: null })];
    // When splitting
    // Then the split is rejected
    await expect(
      splitTimeEntry("user-1", "Asia/Jakarta", "entry-1", SPLIT.toISOString()),
    ).rejects.toThrow("Only completed entries can be split");
  });

  it("re-validates overlaps against other entries", async () => {
    // Given a stored entry and a conflicting neighbor after the split point
    txSelect.selectRows = [makeEntryRow()];
    const conflict: TimeEntryCore = {
      id: "entry-other",
      taskId: "task-other",
      categoryId: "cat-meeting",
      startedAt: new Date("2026-09-03T02:40:00Z"),
      endedAt: new Date("2026-09-03T02:50:00Z"),
      status: "completed",
      pausedAt: null,
      pausedSeconds: 0,
      notes: null,
      source: "manual",
    };
    fetchEntriesInRangeMock.mockResolvedValue({
      entries: [conflict],
      taskNamesById: new Map([["task-other", "Neighbor"]]),
    });
    // When splitting
    // Then the overlap surfaces as OverlapError and nothing is written
    await expect(
      splitTimeEntry("user-1", "Asia/Jakarta", "entry-1", SPLIT.toISOString()),
    ).rejects.toThrow(OverlapError);
    expect(txUpdate).toHaveLength(0);
    expect(txInsert).toHaveLength(0);
  });

  it("rejects an invalid split timestamp", async () => {
    // Given a garbage ISO string
    // When splitting
    // Then the request is rejected before the transaction reads
    await expect(
      splitTimeEntry("user-1", "Asia/Jakarta", "entry-1", "not-a-date"),
    ).rejects.toThrow("Invalid split time");
    expect(transactionMock).not.toHaveBeenCalled();
  });
});
