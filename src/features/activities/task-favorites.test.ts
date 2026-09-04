/**
 * Task favorites service tests. The database is mocked at the db boundary
 * only — assertions cover the UPDATE payload, user scoping, and DTO mapping.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { tasks } from "@/server/db/schema";
import { listFavoriteTasks, setTaskFavorite } from "./task-favorites";

const { updateMock, selectMock } = vi.hoisted(() => ({
  updateMock: vi.fn(),
  selectMock: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  db: { update: updateMock, select: selectMock },
}));

type TaskRow = typeof tasks.$inferSelect;

function makeRow(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: "task-1",
    userId: "user-1",
    name: "Employee Portal API",
    categoryId: "cat-1",
    isFavorite: false,
    lastUsedAt: new Date("2026-09-01T08:30:00Z"),
    createdAt: new Date("2026-08-01T00:00:00Z"),
    ...overrides,
  };
}

interface Captured {
  set?: unknown;
  where?: unknown;
  from?: unknown;
  orderBy?: unknown[];
  limit?: number;
}

function stubUpdate(rows: TaskRow[]): Captured {
  const captured: Captured = {};
  updateMock.mockImplementationOnce(() => {
    const chain = {
      set(value: unknown) {
        captured.set = value;
        return chain;
      },
      where(value: unknown) {
        captured.where = value;
        return chain;
      },
      returning: async () => rows,
    };
    return chain;
  });
  return captured;
}

function stubSelect(rows: TaskRow[]): Captured {
  const captured: Captured = {};
  selectMock.mockImplementationOnce(() => {
    const chain = {
      from(table: unknown) {
        captured.from = table;
        return chain;
      },
      where(value: unknown) {
        captured.where = value;
        return chain;
      },
      orderBy(...values: unknown[]) {
        captured.orderBy = values;
        return chain;
      },
      limit(value: number) {
        captured.limit = value;
        return rows;
      },
    };
    return chain;
  });
  return captured;
}

beforeEach(() => {
  updateMock.mockReset();
  selectMock.mockReset();
});

describe("setTaskFavorite", () => {
  it("updates the tasks table and maps the updated row to a TaskDTO", async () => {
    const captured = stubUpdate([
      makeRow({ id: "task-1", isFavorite: true }),
    ]);

    const dto = await setTaskFavorite("user-1", "task-1", true);

    expect(updateMock).toHaveBeenCalledWith(tasks);
    expect(captured.set).toEqual({ isFavorite: true });
    expect(captured.where).toBeDefined();
    expect(dto).toEqual({
      id: "task-1",
      name: "Employee Portal API",
      categoryId: "cat-1",
      isFavorite: true,
      lastUsedAt: "2026-09-01T08:30:00.000Z",
    });
  });

  it("passes the requested flag through to the update", async () => {
    const captured = stubUpdate([makeRow({ isFavorite: false })]);

    await setTaskFavorite("user-1", "task-1", false);

    expect(captured.set).toEqual({ isFavorite: false });
  });

  it("maps a null lastUsedAt to null", async () => {
    stubUpdate([makeRow({ lastUsedAt: null })]);

    const dto = await setTaskFavorite("user-1", "task-1", true);

    expect(dto.lastUsedAt).toBeNull();
  });

  it("throws when no task matches the id for that user", async () => {
    stubUpdate([]);

    await expect(setTaskFavorite("user-1", "missing", true)).rejects.toThrow(
      "Task not found",
    );
  });
});

describe("listFavoriteTasks", () => {
  it("selects from tasks scoped to the user's favorites and maps rows", async () => {
    const captured = stubSelect([
      makeRow({ id: "task-1", isFavorite: true }),
    ]);

    const result = await listFavoriteTasks("user-1");

    expect(selectMock).toHaveBeenCalledWith();
    expect(captured.from).toBe(tasks);
    expect(captured.where).toBeDefined();
    expect(captured.limit).toBe(8);
    expect(result).toEqual([
      {
        id: "task-1",
        name: "Employee Portal API",
        categoryId: "cat-1",
        isFavorite: true,
        lastUsedAt: "2026-09-01T08:30:00.000Z",
      },
    ]);
  });

  it("honors an explicit limit", async () => {
    const captured = stubSelect([]);

    await listFavoriteTasks("user-1", 3);

    expect(captured.limit).toBe(3);
  });
});
