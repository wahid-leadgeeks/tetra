import { describe, expect, it } from "vitest";
import {
  computeTaskStats,
  countActiveFilters,
  filterTasks,
  groupTasksByColumn,
  sortTasks,
  type TaskFilterOptions,
} from "./task-filters";
import type { TaskDTO, TaskStatus } from "@/lib/types";

function mockTask(overrides: Partial<TaskDTO> = {}): TaskDTO {
  return {
    id: "task-1",
    name: "Sample Task",
    categoryId: "cat-1",
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

const TODAY = "2026-10-03";

function opts(overrides: Partial<TaskFilterOptions> = {}): TaskFilterOptions {
  return {
    quickFilter: "all",
    hideDone: false,
    selectedCategory: "all",
    searchQuery: "",
    categoryNames: {},
    currentTodayKey: TODAY,
    ...overrides,
  };
}

const ids = (tasks: TaskDTO[]) => tasks.map((t) => t.id);

describe("filterTasks", () => {
  it("returns all tasks with default options", () => {
    const tasks = [mockTask({ id: "a" }), mockTask({ id: "b", status: "done" })];
    expect(ids(filterTasks(tasks, opts()))).toEqual(["a", "b"]);
  });

  it("favorites quick filter keeps only favorites", () => {
    const tasks = [mockTask({ id: "a", isFavorite: true }), mockTask({ id: "b" })];
    expect(ids(filterTasks(tasks, opts({ quickFilter: "favorites" })))).toEqual(["a"]);
  });

  it("due_today matches on the date prefix of dueAt", () => {
    const tasks = [
      mockTask({ id: "today", dueAt: `${TODAY}T23:00:00.000Z` }),
      mockTask({ id: "tomorrow", dueAt: "2026-10-04T00:00:00.000Z" }),
      mockTask({ id: "none", dueAt: null }),
    ];
    expect(ids(filterTasks(tasks, opts({ quickFilter: "due_today" })))).toEqual(["today"]);
  });

  it("overdue keeps past-due open tasks and excludes done/cancelled", () => {
    const tasks = [
      mockTask({ id: "past", dueAt: "2026-10-02T10:00:00.000Z" }),
      mockTask({ id: "today", dueAt: `${TODAY}T00:00:00.000Z` }),
      mockTask({ id: "done", status: "done", dueAt: "2026-10-01T00:00:00.000Z" }),
      mockTask({ id: "cancelled", status: "cancelled", dueAt: "2026-10-01T00:00:00.000Z" }),
      mockTask({ id: "none" }),
    ];
    expect(ids(filterTasks(tasks, opts({ quickFilter: "overdue" })))).toEqual(["past"]);
  });

  it("hideDone removes done and cancelled tasks", () => {
    const tasks = [
      mockTask({ id: "a" }),
      mockTask({ id: "b", status: "done" }),
      mockTask({ id: "c", status: "cancelled" }),
      mockTask({ id: "d", status: "blocked" }),
    ];
    expect(ids(filterTasks(tasks, opts({ hideDone: true })))).toEqual(["a", "d"]);
  });

  it("category filter matches categoryId", () => {
    const tasks = [mockTask({ id: "a", categoryId: "x" }), mockTask({ id: "b", categoryId: "y" })];
    expect(ids(filterTasks(tasks, opts({ selectedCategory: "y" })))).toEqual(["b"]);
  });

  it("search matches name, description and category name case-insensitively", () => {
    const tasks = [
      mockTask({ id: "name", name: "Write REPORT" }),
      mockTask({ id: "desc", name: "x", description: "quarterly report draft" }),
      mockTask({ id: "cat", name: "y", categoryId: "c-rep" }),
      mockTask({ id: "miss", name: "z", categoryId: "c-other" }),
    ];
    const result = filterTasks(
      tasks,
      opts({ searchQuery: "Report", categoryNames: { "c-rep": "Reporting", "c-other": "Ops" } }),
    );
    expect(ids(result)).toEqual(["name", "desc", "cat"]);
  });

  it("whitespace-only search does not filter", () => {
    const tasks = [mockTask({ id: "a" })];
    expect(ids(filterTasks(tasks, opts({ searchQuery: "   " })))).toEqual(["a"]);
  });
});

describe("sortTasks", () => {
  it("does not mutate the input array", () => {
    const tasks = [mockTask({ id: "b", name: "B" }), mockTask({ id: "a", name: "A" })];
    sortTasks(tasks, "name");
    expect(ids(tasks)).toEqual(["b", "a"]);
  });

  it("favorites: favorites first, then lastUsedAt desc, then name", () => {
    const tasks = [
      mockTask({ id: "plain-old", name: "A", lastUsedAt: "2026-01-01T00:00:00.000Z" }),
      mockTask({ id: "fav-b", name: "B", isFavorite: true }),
      mockTask({ id: "fav-a", name: "A", isFavorite: true }),
      mockTask({ id: "plain-new", name: "Z", lastUsedAt: "2026-05-01T00:00:00.000Z" }),
      mockTask({ id: "fav-used", name: "Z", isFavorite: true, lastUsedAt: "2026-02-01T00:00:00.000Z" }),
    ];
    expect(ids(sortTasks(tasks, "favorites"))).toEqual([
      "fav-used",
      "fav-a",
      "fav-b",
      "plain-new",
      "plain-old",
    ]);
  });

  it("recent: lastUsedAt desc, then favorites, then name", () => {
    const tasks = [
      mockTask({ id: "never-b", name: "B" }),
      mockTask({ id: "never-fav", name: "Z", isFavorite: true }),
      mockTask({ id: "never-a", name: "A" }),
      mockTask({ id: "used", name: "M", lastUsedAt: "2026-03-01T00:00:00.000Z" }),
    ];
    expect(ids(sortTasks(tasks, "recent"))).toEqual(["used", "never-fav", "never-a", "never-b"]);
  });

  it("priority: rank desc with missing priority treated as medium, then name", () => {
    const tasks = [
      mockTask({ id: "low", name: "A", priority: "low" }),
      mockTask({ id: "none", name: "B", priority: undefined }),
      mockTask({ id: "medium", name: "A", priority: "medium" }),
      mockTask({ id: "urgent", name: "Z", priority: "urgent" }),
      mockTask({ id: "high", name: "Y", priority: "high" }),
    ];
    expect(ids(sortTasks(tasks, "priority"))).toEqual(["urgent", "high", "medium", "none", "low"]);
  });

  it("name: alphabetical", () => {
    const tasks = [mockTask({ id: "c", name: "Charlie" }), mockTask({ id: "a", name: "alpha" })];
    expect(ids(sortTasks(tasks, "name"))).toEqual(["a", "c"]);
  });

  it("created: newest first, missing createdAt last", () => {
    const tasks = [
      mockTask({ id: "missing", createdAt: undefined }),
      mockTask({ id: "old", createdAt: "2026-01-01T00:00:00.000Z" }),
      mockTask({ id: "new", createdAt: "2026-06-01T00:00:00.000Z" }),
    ];
    expect(ids(sortTasks(tasks, "created"))).toEqual(["new", "old", "missing"]);
  });
});

describe("groupTasksByColumn", () => {
  it("groups by status preserving order and maps unknown status to todo", () => {
    const tasks = [
      mockTask({ id: "t1", status: "todo" }),
      mockTask({ id: "d1", status: "done" }),
      mockTask({ id: "x1", status: "mystery" as TaskStatus }),
      mockTask({ id: "r1", status: "review" }),
      mockTask({ id: "t2", status: "todo" }),
    ];
    const map = groupTasksByColumn(tasks);
    expect(ids(map.todo)).toEqual(["t1", "x1", "t2"]);
    expect(ids(map.done)).toEqual(["d1"]);
    expect(ids(map.review)).toEqual(["r1"]);
    expect(map.backlog).toEqual([]);
    expect(map.in_progress).toEqual([]);
    expect(map.blocked).toEqual([]);
    expect(map.cancelled).toEqual([]);
  });
});

describe("computeTaskStats", () => {
  it("buckets review into inProgress, cancelled into done, unknown into todo", () => {
    const statuses = [
      "backlog",
      "todo",
      "in_progress",
      "review",
      "blocked",
      "done",
      "cancelled",
      "mystery",
    ] as TaskStatus[];
    const tasks = statuses.map((status, i) => mockTask({ id: String(i), status }));
    expect(computeTaskStats(tasks)).toEqual({
      total: 8,
      backlog: 1,
      todo: 2,
      inProgress: 2,
      blocked: 1,
      done: 2,
    });
  });

  it("returns zeros for an empty list", () => {
    expect(computeTaskStats([])).toEqual({
      total: 0,
      backlog: 0,
      todo: 0,
      inProgress: 0,
      blocked: 0,
      done: 0,
    });
  });
});

describe("countActiveFilters", () => {
  const defaults = {
    quickFilter: "all" as const,
    sortBy: "favorites" as const,
    hideDone: false,
    selectedCategory: "all",
  };

  it("returns 0 when every filter is at its default", () => {
    expect(countActiveFilters(defaults)).toBe(0);
  });

  it("counts each non-default filter once", () => {
    expect(
      countActiveFilters({ ...defaults, quickFilter: "overdue", hideDone: true }),
    ).toBe(2);
    expect(countActiveFilters({ ...defaults, selectedCategory: "cat-1" })).toBe(1);
  });

  it("counts a non-default sort and all filters together", () => {
    expect(countActiveFilters({ ...defaults, sortBy: "name" })).toBe(1);
    expect(
      countActiveFilters({
        quickFilter: "favorites",
        sortBy: "created",
        hideDone: true,
        selectedCategory: "cat-2",
      }),
    ).toBe(4);
  });
});
