import { describe, expect, it } from "vitest";
import { filterTodayTasks } from "./today-tasks-card";
import type { TaskDTO } from "@/lib/types";

function mockTask(overrides: Partial<TaskDTO> = {}): TaskDTO {
  return {
    id: "task-1",
    name: "Sample Task",
    categoryId: "cat-1",
    categoryKey: "ENG",
    categoryName: "Engineering",
    status: "todo",
    priority: "medium",
    description: null,
    isFavorite: false,
    dueAt: null,
    startedAt: null,
    completedAt: null,
    lastUsedAt: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("filterTodayTasks", () => {
  const timezone = "Asia/Jakarta";
  const todayStr = "2026-09-30";

  it("includes in_progress tasks regardless of due date", () => {
    const tasks: TaskDTO[] = [
      mockTask({ id: "t1", name: "Active work", status: "in_progress" }),
      mockTask({ id: "t2", name: "Backlog item", status: "backlog" }),
    ];

    const result = filterTodayTasks(tasks, timezone, todayStr);
    expect(result.inProgressTasks).toHaveLength(1);
    expect(result.inProgressTasks[0]?.id).toBe("t1");
    expect(result.allTodayTasks).toHaveLength(1);
  });

  it("includes tasks due today", () => {
    const tasks: TaskDTO[] = [
      mockTask({
        id: "t1",
        name: "Due today task",
        status: "todo",
        dueAt: "2026-09-30T10:00:00.000Z",
      }),
      mockTask({
        id: "t2",
        name: "Due next week",
        status: "todo",
        dueAt: "2026-10-07T10:00:00.000Z",
      }),
    ];

    const result = filterTodayTasks(tasks, timezone, todayStr);
    expect(result.dueTodayTasks).toHaveLength(1);
    expect(result.dueTodayTasks[0]?.id).toBe("t1");
    expect(result.allTodayTasks).toHaveLength(1);
  });

  it("identifies overdue tasks that are still open", () => {
    const tasks: TaskDTO[] = [
      mockTask({
        id: "t1",
        name: "Overdue task",
        status: "todo",
        dueAt: "2026-09-25T10:00:00.000Z",
      }),
      mockTask({
        id: "t2",
        name: "Past task but already done",
        status: "done",
        dueAt: "2026-09-25T10:00:00.000Z",
        completedAt: "2026-09-25T12:00:00.000Z",
      }),
      mockTask({
        id: "t3",
        name: "Past task but cancelled",
        status: "cancelled",
        dueAt: "2026-09-25T10:00:00.000Z",
      }),
    ];

    const result = filterTodayTasks(tasks, timezone, todayStr);
    expect(result.overdueTasks).toHaveLength(1);
    expect(result.overdueTasks[0]?.id).toBe("t1");
    expect(result.allTodayTasks).toHaveLength(1);
  });

  it("includes tasks completed today in completedTodayTasks", () => {
    const tasks: TaskDTO[] = [
      mockTask({
        id: "t1",
        name: "Finished today",
        status: "done",
        completedAt: "2026-09-30T08:30:00.000Z",
      }),
      mockTask({
        id: "t2",
        name: "Finished yesterday",
        status: "done",
        completedAt: "2026-09-29T15:00:00.000Z",
      }),
    ];

    const result = filterTodayTasks(tasks, timezone, todayStr);
    expect(result.completedTodayTasks).toHaveLength(1);
    expect(result.completedTodayTasks[0]?.id).toBe("t1");
    expect(result.allTodayTasks).toHaveLength(1);
  });

  it("excludes backlog and unscheduled todo tasks from today's focus", () => {
    const tasks: TaskDTO[] = [
      mockTask({ id: "t1", name: "Backlog item", status: "backlog" }),
      mockTask({ id: "t2", name: "Future idea", status: "todo", dueAt: null }),
      mockTask({ id: "t3", name: "Blocked item", status: "blocked", dueAt: null }),
    ];

    const result = filterTodayTasks(tasks, timezone, todayStr);
    expect(result.allTodayTasks).toHaveLength(0);
  });

  it("treats dialog-written T23:59:59Z due dates as date-only (no UTC+7 day shift)", () => {
    const tasks: TaskDTO[] = [
      mockTask({ id: "t1", status: "todo", dueAt: "2026-10-07T23:59:59Z" }),
      mockTask({ id: "t2", status: "todo", dueAt: "2026-10-06T23:59:59Z" }),
    ];

    const result = filterTodayTasks(tasks, "Asia/Jakarta", "2026-10-07");
    expect(result.dueTodayTasks.map((t) => t.id)).toEqual(["t1"]);
    expect(result.overdueTasks.map((t) => t.id)).toEqual(["t2"]);
  });
});
