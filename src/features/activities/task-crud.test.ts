/**
 * Task CRUD mutation tests for Kanban & Task view.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { tasks } from "@/server/db/schema";
import { createTask, deleteTask, updateTask } from "./entry-mutations";

const { insertMock, updateMock, selectMock, deleteMock } = vi.hoisted(() => ({
  insertMock: vi.fn(),
  updateMock: vi.fn(),
  selectMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  db: {
    insert: insertMock,
    update: updateMock,
    select: selectMock,
    delete: deleteMock,
  },
}));

type TaskRow = typeof tasks.$inferSelect;

function makeRow(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: "task-1",
    userId: "user-1",
    name: "Build Kanban Board",
    categoryId: "cat-1",
    status: "todo",
    description: "Implement 3-column kanban board with drag and drop",
    isFavorite: false,
    lastUsedAt: new Date("2026-09-14T10:00:00Z"),
    createdAt: new Date("2026-09-14T09:00:00Z"),
    ...overrides,
  };
}

describe("createTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a task with default status and returns TaskDTO", async () => {
    // 1. assertCategoryExists check
    selectMock.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: "cat-1" }]),
        }),
      }),
    });

    // 2. insert task
    const mockRow = makeRow();
    insertMock.mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockRow]),
      }),
    });

    // 3. fetch category for DTO
    selectMock.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { key: "ENG", name: "Engineering" },
          ]),
        }),
      }),
    });

    const result = await createTask("user-1", {
      name: "Build Kanban Board",
      categoryId: "cat-1",
      description: "Implement 3-column kanban board with drag and drop",
    });

    expect(result.id).toBe("task-1");
    expect(result.name).toBe("Build Kanban Board");
    expect(result.status).toBe("todo");
    expect(result.categoryName).toBe("Engineering");
  });

  it("rejects empty task names", async () => {
    selectMock.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: "cat-1" }]),
        }),
      }),
    });

    await expect(
      createTask("user-1", {
        name: "   ",
        categoryId: "cat-1",
      }),
    ).rejects.toThrow("Task name cannot be empty");
  });
});

describe("updateTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates status from todo to in_progress", async () => {
    // 1. check existing task
    selectMock.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([makeRow({ status: "todo" })]),
        }),
      }),
    });

    // 2. update task
    const updatedRow = makeRow({ status: "in_progress" });
    updateMock.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([updatedRow]),
        }),
      }),
    });

    // 3. fetch category for DTO
    selectMock.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { key: "ENG", name: "Engineering" },
          ]),
        }),
      }),
    });

    const result = await updateTask("user-1", "task-1", {
      status: "in_progress",
    });

    expect(result.status).toBe("in_progress");
  });

  it("throws if task not found", async () => {
    selectMock.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    await expect(
      updateTask("user-1", "non-existent", { status: "done" }),
    ).rejects.toThrow("Task not found");
  });
});

describe("deleteTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes a task successfully", async () => {
    deleteMock.mockReturnValueOnce({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "task-1" }]),
      }),
    });

    const success = await deleteTask("user-1", "task-1");
    expect(success).toBe(true);
  });

  it("returns false when task is not found or not owned by user", async () => {
    deleteMock.mockReturnValueOnce({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    });

    const success = await deleteTask("user-1", "missing");
    expect(success).toBe(false);
  });
});
