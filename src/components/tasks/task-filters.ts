import { PRIORITY_CONFIG, type QuickFilter, type SortOption } from "@/components/tasks/task-constants";
import type { TaskDTO, TaskStatus } from "@/lib/types";

export interface TaskFilterOptions {
  quickFilter: QuickFilter;
  hideDone: boolean;
  selectedCategory: string;
  searchQuery: string;
  categoryNames: Record<string, string>;
  currentTodayKey: string;
}

export interface TaskStats {
  total: number;
  backlog: number;
  todo: number;
  inProgress: number;
  blocked: number;
  done: number;
}

export interface ActiveFilterState {
  quickFilter: QuickFilter;
  sortBy: SortOption;
  hideDone: boolean;
  selectedCategory: string;
}

// Number of non-default filter controls (search is always visible, so it is not counted)
export function countActiveFilters({
  quickFilter,
  sortBy,
  hideDone,
  selectedCategory,
}: ActiveFilterState): number {
  let count = 0;
  if (quickFilter !== "all") count += 1;
  if (sortBy !== "favorites") count += 1;
  if (hideDone) count += 1;
  if (selectedCategory !== "all") count += 1;
  return count;
}

// Filtered tasks
export function filterTasks(
  tasks: TaskDTO[],
  {
    quickFilter,
    hideDone,
    selectedCategory,
    searchQuery,
    categoryNames,
    currentTodayKey,
  }: TaskFilterOptions,
): TaskDTO[] {
  return tasks.filter((t) => {
    // Quick filter
    if (quickFilter === "favorites" && !t.isFavorite) return false;
    if (quickFilter === "due_today") {
      if (!t.dueAt) return false;
      if (t.dueAt.slice(0, 10) !== currentTodayKey) return false;
    }
    if (quickFilter === "overdue") {
      if (!t.dueAt) return false;
      if (t.status === "done" || t.status === "cancelled") return false;
      if (t.dueAt.slice(0, 10) >= currentTodayKey) return false;
    }

    // Hide done toggle
    if (hideDone && (t.status === "done" || t.status === "cancelled")) return false;

    // Category filter
    if (selectedCategory !== "all" && t.categoryId !== selectedCategory) return false;

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const catName = categoryNames[t.categoryId] || "";
      const matchesName = t.name.toLowerCase().includes(q);
      const matchesDesc = t.description ? t.description.toLowerCase().includes(q) : false;
      const matchesCat = catName.toLowerCase().includes(q);
      if (!matchesName && !matchesDesc && !matchesCat) return false;
    }
    return true;
  });
}

// Sorted and filtered tasks
export function sortTasks(filteredTasks: TaskDTO[], sortBy: SortOption): TaskDTO[] {
  return [...filteredTasks].sort((a, b) => {
    if (sortBy === "favorites") {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      const aTime = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
      const bTime = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;
      return a.name.localeCompare(b.name);
    }
    if (sortBy === "recent") {
      const aTime = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
      const bTime = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      return a.name.localeCompare(b.name);
    }
    if (sortBy === "priority") {
      const rankA = PRIORITY_CONFIG[a.priority || "medium"].rank;
      const rankB = PRIORITY_CONFIG[b.priority || "medium"].rank;
      if (rankA !== rankB) return rankB - rankA;
      return a.name.localeCompare(b.name);
    }
    if (sortBy === "name") {
      return a.name.localeCompare(b.name);
    }
    if (sortBy === "created") {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    }
    return 0;
  });
}

// Tasks grouped by Kanban column
export function groupTasksByColumn(sortedTasks: TaskDTO[]): Record<TaskStatus, TaskDTO[]> {
  const map: Record<TaskStatus, TaskDTO[]> = {
    backlog: [],
    todo: [],
    in_progress: [],
    blocked: [],
    done: [],
    review: [],
    cancelled: [],
  };
  for (const t of sortedTasks) {
    const status = t.status || "todo";
    if (map[status]) {
      map[status].push(t);
    } else {
      map.todo.push(t);
    }
  }
  return map;
}

// Statistics summing exactly across all workflow states
export function computeTaskStats(tasks: TaskDTO[]): TaskStats {
  let backlog = 0;
  let todo = 0;
  let inProgress = 0;
  let blocked = 0;
  let done = 0;
  for (const t of tasks) {
    if (t.status === "backlog") backlog += 1;
    else if (t.status === "todo") todo += 1;
    else if (t.status === "in_progress" || t.status === "review") inProgress += 1;
    else if (t.status === "blocked") blocked += 1;
    else if (t.status === "done" || t.status === "cancelled") done += 1;
    else todo += 1;
  }
  return { total: tasks.length, backlog, todo, inProgress, blocked, done };
}
