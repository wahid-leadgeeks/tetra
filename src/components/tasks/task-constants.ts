import type { TaskPriority, TaskStatus } from "@/lib/types";

export const DEFAULT_PAGE_SIZE = 15;

export type SortOption = "favorites" | "recent" | "name" | "created" | "priority";
export type CardDensity = "comfortable" | "compact";
export type QuickFilter = "all" | "due_today" | "overdue" | "favorites";

export const COLUMNS: Array<{
  id: TaskStatus;
  title: string;
  dotColor: string;
  badgeClass: string;
  borderClass: string;
}> = [
  {
    id: "backlog",
    title: "Backlog",
    dotColor: "bg-slate-400 dark:bg-slate-500",
    badgeClass: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20",
    borderClass: "border-slate-500/30",
  },
  {
    id: "todo",
    title: "To Do",
    dotColor: "bg-blue-500",
    badgeClass: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
    borderClass: "border-blue-500/30",
  },
  {
    id: "in_progress",
    title: "In Progress",
    dotColor: "bg-amber-500 animate-pulse",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
    borderClass: "border-amber-500/30",
  },
  {
    id: "blocked",
    title: "Blocked",
    dotColor: "bg-rose-500",
    badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
    borderClass: "border-rose-500/30",
  },
  {
    id: "done",
    title: "Done",
    dotColor: "bg-emerald-500",
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    borderClass: "border-emerald-500/30",
  },
];

export const PRIORITY_CONFIG: Record<
  TaskPriority,
  { label: string; badgeClass: string; dotClass: string; rank: number }
> = {
  urgent: {
    label: "Urgent",
    badgeClass: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30",
    dotClass: "bg-red-500",
    rank: 4,
  },
  high: {
    label: "High",
    badgeClass: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30",
    dotClass: "bg-orange-500",
    rank: 3,
  },
  medium: {
    label: "Medium",
    badgeClass: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
    dotClass: "bg-blue-500",
    rank: 2,
  },
  low: {
    label: "Low",
    badgeClass: "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/30",
    dotClass: "bg-slate-400",
    rank: 1,
  },
};

export type KanbanColumnConfig = (typeof COLUMNS)[number];
