"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  AlignJustify,
  ArrowUpDown,
  Calendar,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Flame,
  Kanban,
  List,
  Loader2,
  MoreVertical,
  Pencil,
  Play,
  Plus,
  Rows,
  Search,
  Star,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CategoryBadge } from "@/components/ui/category-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/components/timeline/api";
import { getCategoryTheme } from "@/lib/categories";
import { todayKey } from "@/lib/time";
import type { CategoryDTO, TaskDTO, TaskPriority, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TasksViewProps {
  timeZone: string;
}

const DEFAULT_PAGE_SIZE = 15;

type SortOption = "favorites" | "recent" | "name" | "created" | "priority";
type CardDensity = "comfortable" | "compact";
type QuickFilter = "all" | "due_today" | "overdue" | "favorites";

const COLUMNS: Array<{
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

const PRIORITY_CONFIG: Record<
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

export function TasksView({ timeZone }: TasksViewProps) {
  const router = useRouter();
  const currentTodayKey = useMemo(() => todayKey(timeZone || "Asia/Jakarta"), [timeZone]);

  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & display preferences
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [hideDone, setHideDone] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("favorites");
  const [cardDensity, setCardDensity] = useState<CardDensity>("comfortable");

  // Kanban column pagination limits
  const [visibleLimits, setVisibleLimits] = useState<Record<TaskStatus, number>>({
    backlog: DEFAULT_PAGE_SIZE,
    todo: DEFAULT_PAGE_SIZE,
    in_progress: DEFAULT_PAGE_SIZE,
    blocked: DEFAULT_PAGE_SIZE,
    done: DEFAULT_PAGE_SIZE,
    review: DEFAULT_PAGE_SIZE,
    cancelled: DEFAULT_PAGE_SIZE,
  });

  // Kanban column collapsed state
  const [collapsedColumns, setCollapsedColumns] = useState<Record<TaskStatus, boolean>>({
    backlog: false,
    todo: false,
    in_progress: false,
    blocked: false,
    done: false,
    review: false,
    cancelled: false,
  });

  // Mobile segmented column tab
  const [mobileTab, setMobileTab] = useState<TaskStatus | "all">("all");

  // Task actions state
  const [startingId, setStartingId] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  // Task modal dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskDTO | null>(null);
  const [defaultColumnForNew, setDefaultColumnForNew] = useState<TaskStatus>("todo");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [allTasks, cats] = await Promise.all([
        apiFetch<TaskDTO[]>("/api/tasks"),
        apiFetch<CategoryDTO[]>("/api/categories").catch(() => [] as CategoryDTO[]),
      ]);
      setTasks(allTasks);
      setCategories(cats);
    } catch (err) {
      console.error("Failed to load tasks:", err);
      setError(err instanceof Error ? err.message : "Could not load tasks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const [allTasks, cats] = await Promise.all([
          apiFetch<TaskDTO[]>("/api/tasks"),
          apiFetch<CategoryDTO[]>("/api/categories").catch(() => [] as CategoryDTO[]),
        ]);
        if (cancelled) return;
        setTasks(allTasks);
        setCategories(cats);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load tasks:", err);
          setError(err instanceof Error ? err.message : "Could not load tasks.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  const categoryNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const cat of categories) {
      map[cat.id] = cat.name;
    }
    return map;
  }, [categories]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
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
  }, [tasks, quickFilter, hideDone, selectedCategory, searchQuery, categoryNames, currentTodayKey]);

  // Sorted and filtered tasks
  const sortedTasks = useMemo(() => {
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
  }, [filteredTasks, sortBy]);

  // Tasks grouped by Kanban column
  const tasksByColumn = useMemo(() => {
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
  }, [sortedTasks]);

  // Statistics summing exactly across all workflow states
  const stats = useMemo(() => {
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
  }, [tasks]);

  // Column pagination helpers
  function handleLoadMore(columnId: TaskStatus) {
    setVisibleLimits((prev) => ({
      ...prev,
      [columnId]: (prev[columnId] || DEFAULT_PAGE_SIZE) + DEFAULT_PAGE_SIZE,
    }));
  }

  function handleShowAll(columnId: TaskStatus, total: number) {
    setVisibleLimits((prev) => ({
      ...prev,
      [columnId]: total,
    }));
  }

  function handleCollapseLimit(columnId: TaskStatus) {
    setVisibleLimits((prev) => ({
      ...prev,
      [columnId]: DEFAULT_PAGE_SIZE,
    }));
  }

  function toggleColumnCollapse(columnId: TaskStatus) {
    setCollapsedColumns((prev) => ({
      ...prev,
      [columnId]: !prev[columnId],
    }));
  }

  // One-tap start timer
  async function handleStart(task: TaskDTO) {
    setStartingId(task.id);
    try {
      await apiFetch("/api/time-entries/start", {
        method: "POST",
        body: JSON.stringify({
          taskName: task.name,
          categoryId: task.categoryId,
        }),
      });

      // If task was in todo, backlog, or blocked, move it to in_progress automatically
      if (task.status === "todo" || task.status === "backlog" || task.status === "blocked") {
        await handleMoveStatus(task.id, "in_progress", false);
      }

      toast.success(`Started tracking: ${task.name}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start timer.");
    } finally {
      setStartingId(null);
    }
  }

  // Toggle favorite flag
  async function handleToggleFavorite(task: TaskDTO) {
    const next = !task.isFavorite;
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, isFavorite: next } : t)),
    );
    try {
      await apiFetch<TaskDTO>(`/api/tasks/${task.id}/favorite`, {
        method: "PATCH",
        body: JSON.stringify({ isFavorite: next }),
      });
    } catch (err) {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, isFavorite: task.isFavorite } : t)),
      );
      toast.error(err instanceof Error ? err.message : "Could not update favorite.");
    }
  }

  // Move task status
  async function handleMoveStatus(
    taskId: string,
    newStatus: TaskStatus,
    showToast = true,
  ) {
    const prevTask = tasks.find((t) => t.id === taskId);
    if (!prevTask || prevTask.status === newStatus) return;

    const nowIso = new Date().toISOString();
    const isDone = newStatus === "done";
    const isInProgress = newStatus === "in_progress";

    // Optimistic update with completedAt and startedAt transitions
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          status: newStatus,
          completedAt: isDone ? nowIso : newStatus === "todo" || newStatus === "backlog" ? null : t.completedAt,
          startedAt: isInProgress && !t.startedAt ? nowIso : t.startedAt,
        };
      }),
    );

    try {
      await apiFetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: newStatus,
          completedAt: isDone ? nowIso : newStatus === "todo" || newStatus === "backlog" ? null : undefined,
          startedAt: isInProgress && !prevTask.startedAt ? nowIso : undefined,
        }),
      });
      if (showToast) {
        const colTitle = COLUMNS.find((c) => c.id === newStatus)?.title || newStatus;
        toast.success(`Moved to ${colTitle}`);
      }
    } catch {
      // Rollback
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? prevTask : t)),
      );
      toast.error("Failed to move task.");
    }
  }

  // Delete task
  async function handleDeleteTask(taskId: string) {
    if (!confirm("Are you sure you want to delete this task?")) return;

    const prevTasks = [...tasks];
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      await apiFetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
      });
      toast.success("Task deleted");
    } catch {
      setTasks(prevTasks);
      toast.error("Could not delete task.");
    }
  }

  // Drag & drop handlers
  function handleDragStart(e: React.DragEvent, taskId: string) {
    e.dataTransfer.setData("text/plain", taskId);
    setDraggedTaskId(taskId);
  }

  function handleDragOver(e: React.DragEvent, columnId: TaskStatus) {
    e.preventDefault();
    if (dragOverColumn !== columnId) {
      setDragOverColumn(columnId);
    }
  }

  function handleDrop(e: React.DragEvent, columnId: TaskStatus) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain") || draggedTaskId;
    setDragOverColumn(null);
    setDraggedTaskId(null);
    if (taskId) {
      void handleMoveStatus(taskId, columnId);
    }
  }

  function handleOpenCreate(columnId: TaskStatus = "todo") {
    setEditingTask(null);
    setDefaultColumnForNew(columnId);
    setDialogOpen(true);
  }

  function handleOpenEdit(task: TaskDTO) {
    setEditingTask(task);
    setDialogOpen(true);
  }

  return (
    <div className="w-full space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Tasks</h1>
            {!loading && (
              <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-muted/40 px-2.5 py-0.5 font-semibold text-foreground">
                  {stats.total} Total
                </span>
                <span>•</span>
                <span className={cn(stats.backlog > 0 && "text-slate-700 dark:text-slate-300 font-medium")}>
                  {stats.backlog} Backlog
                </span>
                <span>•</span>
                <span className={cn(stats.todo > 0 && "text-blue-700 dark:text-blue-300 font-medium")}>
                  {stats.todo} To Do
                </span>
                <span>•</span>
                <span className={cn(stats.inProgress > 0 && "text-amber-700 dark:text-amber-300 font-medium")}>
                  {stats.inProgress} In Progress
                </span>
                <span>•</span>
                <span className={cn(stats.blocked > 0 && "text-rose-700 dark:text-rose-300 font-medium")}>
                  {stats.blocked} Blocked
                </span>
                <span>•</span>
                <span className={cn(stats.done > 0 && "text-emerald-700 dark:text-emerald-300 font-medium")}>
                  {stats.done} Done
                </span>
              </div>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your work across your workflow.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Card Density Toggle */}
          <div
            className="inline-flex rounded-lg border border-border/70 p-0.5 bg-muted/40"
            title="Card Density"
          >
            <button
              type="button"
              onClick={() => setCardDensity("comfortable")}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                cardDensity === "comfortable"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="Comfortable card view"
              aria-label="Comfortable card density"
            >
              <Rows className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setCardDensity("compact")}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                cardDensity === "compact"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="Compact card view (fits more cards)"
              aria-label="Compact card density"
            >
              <AlignJustify className="size-3.5" />
            </button>
          </div>

          {/* View Mode Toggle (Kanban / List) */}
          <div className="inline-flex rounded-lg border border-border/70 p-0.5 bg-muted/40">
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                viewMode === "kanban"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Kanban className="size-3.5" />
              <span>Kanban</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                viewMode === "list"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <List className="size-3.5" />
              <span>List</span>
            </button>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={() => handleOpenCreate("todo")}
            className="text-xs gap-1.5 h-9 font-medium shadow-xs"
          >
            <Plus className="size-4" />
            New Task
          </Button>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          {/* Search Input */}
          <div className="relative w-full sm:w-60 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-7 text-xs h-9"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                title="Clear search"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Quick Filter Pill Group: [ All ] [ Due Today ] [ Overdue ] [ Favorites ] */}
          <div className="inline-flex rounded-lg border border-border/70 p-0.5 bg-muted/40">
            <button
              type="button"
              onClick={() => setQuickFilter("all")}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md transition-colors select-none",
                quickFilter === "all"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setQuickFilter("due_today")}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md transition-colors select-none",
                quickFilter === "due_today"
                  ? "bg-background text-amber-700 dark:text-amber-300 shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Due Today
            </button>
            <button
              type="button"
              onClick={() => setQuickFilter("overdue")}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md transition-colors select-none",
                quickFilter === "overdue"
                  ? "bg-background text-rose-700 dark:text-rose-300 shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Overdue
            </button>
            <button
              type="button"
              onClick={() => setQuickFilter("favorites")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors select-none",
                quickFilter === "favorites"
                  ? "bg-background text-amber-600 dark:text-amber-400 shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Star className="size-3 fill-amber-500 text-amber-500" />
              <span>Favorites</span>
            </button>
          </div>

          {/* Sort Selector */}
          <Select value={sortBy} onValueChange={(val: SortOption) => setSortBy(val)}>
            <SelectTrigger className="w-[145px] h-9 text-xs">
              <ArrowUpDown className="size-3 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="favorites">Favorites First</SelectItem>
              <SelectItem value="recent">Recently Used</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="name">Alphabetical (A–Z)</SelectItem>
              <SelectItem value="created">Newest Created</SelectItem>
            </SelectContent>
          </Select>

          {/* Hide Done Toggle */}
          <button
            type="button"
            onClick={() => setHideDone(!hideDone)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 h-9 rounded-lg border text-xs font-medium transition-all select-none cursor-pointer",
              hideDone
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold"
                : "border-border/70 hover:border-border text-muted-foreground hover:text-foreground bg-card/60",
            )}
            title="Hide completed tasks"
          >
            {hideDone ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            <span>{hideDone ? "Done Hidden" : "Hide Done"}</span>
          </button>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-medium transition-colors border select-none whitespace-nowrap",
              selectedCategory === "all"
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border/60 hover:bg-muted text-muted-foreground",
            )}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium transition-colors border select-none whitespace-nowrap",
                selectedCategory === cat.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border/60 hover:bg-muted text-muted-foreground",
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content: Kanban or List */}
      <div data-testid="tasks-list">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3" aria-label="Loading tasks">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-64 animate-pulse rounded-xl bg-muted/60" />
            ))}
          </div>
        ) : error ? (
          <Card className="items-start gap-3 p-6" data-testid="tasks-error">
            <div className="flex items-center gap-2 text-destructive">
              <TriangleAlert className="size-4" />
              <p className="text-sm font-medium">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => loadData()} className="mt-2 text-xs">
              Try again
            </Button>
          </Card>
        ) : viewMode === "kanban" ? (
          <div className="space-y-3">
            {/* Mobile Column Switcher (Visible only on < lg screens) */}
            <div className="flex lg:hidden items-center rounded-lg border border-border/70 p-1 bg-muted/40 overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => setMobileTab("all")}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md text-center transition-colors whitespace-nowrap shrink-0",
                  mobileTab === "all"
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground",
                )}
              >
                All Columns
              </button>
              {COLUMNS.map((col) => {
                const count = tasksByColumn[col.id]?.length || 0;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setMobileTab(col.id)}
                    className={cn(
                      "px-3 py-1 text-xs font-medium rounded-md text-center transition-colors whitespace-nowrap shrink-0",
                      mobileTab === col.id
                        ? "bg-background text-foreground shadow-2xs font-semibold"
                        : "text-muted-foreground",
                    )}
                  >
                    {col.title} ({count})
                  </button>
                );
              })}
            </div>

            {/* Kanban Columns Layout (5 core workflow columns) */}
            <div className="flex flex-col lg:flex-row gap-3.5 items-stretch overflow-x-auto pb-2">
              {COLUMNS.map((column) => {
                // If hideDone is active and column is done, skip rendering unless dragged over
                if (hideDone && column.id === "done" && dragOverColumn !== "done") {
                  return null;
                }

                // Mobile tab filter check
                if (mobileTab !== "all" && mobileTab !== column.id) {
                  return null;
                }

                const allColumnTasks = tasksByColumn[column.id] || [];
                const isDragOver = dragOverColumn === column.id;
                const isCollapsed = collapsedColumns[column.id];
                const limit = visibleLimits[column.id] ?? DEFAULT_PAGE_SIZE;
                const visibleTasks = allColumnTasks.slice(0, limit);
                const hasMore = allColumnTasks.length > limit;

                // Collapsed column ribbon
                if (isCollapsed) {
                  return (
                    <div
                      key={column.id}
                      onDragOver={(e) => handleDragOver(e, column.id)}
                      onDrop={(e) => handleDrop(e, column.id)}
                      onClick={() => toggleColumnCollapse(column.id)}
                      className={cn(
                        "flex flex-col items-center justify-between rounded-2xl border bg-card/40 hover:bg-card/70 backdrop-blur-xs p-3 transition-all cursor-pointer select-none",
                        "w-full lg:w-14 h-16 lg:h-[calc(100vh-235px)] lg:min-h-[500px] lg:max-h-[820px]",
                        column.borderClass,
                        isDragOver && "ring-2 ring-primary bg-primary/[0.08] border-primary",
                      )}
                      title={`Expand ${column.title} column (${allColumnTasks.length} tasks)`}
                    >
                      <div className="flex lg:flex-col items-center gap-1.5">
                        <span className={cn("size-2 rounded-full shrink-0", column.dotColor)} />
                        <Badge variant="outline" className={cn("text-[10px] px-1 py-0 font-mono", column.badgeClass)}>
                          {allColumnTasks.length}
                        </Badge>
                      </div>

                      <div className="flex lg:flex-col items-center gap-1.5">
                        <span className="text-xs font-bold text-foreground tracking-wide lg:[writing-mode:vertical-rl] lg:rotate-180">
                          {column.title}
                        </span>
                      </div>

                      <ChevronRight className="size-3.5 text-muted-foreground hidden lg:block" />
                    </div>
                  );
                }

                return (
                  <div
                    key={column.id}
                    onDragOver={(e) => handleDragOver(e, column.id)}
                    onDrop={(e) => handleDrop(e, column.id)}
                    className={cn(
                      "flex flex-col rounded-2xl border bg-card/40 backdrop-blur-xs transition-all",
                      "flex-1 min-w-[240px] w-full",
                      // Viewport-bounded scroll height on desktop:
                      "h-auto lg:h-[calc(100vh-235px)] lg:min-h-[500px] lg:max-h-[820px]",
                      column.borderClass,
                      isDragOver && "ring-2 ring-primary bg-primary/[0.03] border-primary",
                    )}
                  >
                    {/* Pinned Column Header */}
                    <div className="flex items-center justify-between p-3 border-b border-border/50 shrink-0">
                      <div className="flex items-center gap-2">
                        <span className={cn("size-2 rounded-full shrink-0", column.dotColor)} />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                          {column.title}
                        </h3>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] font-mono px-1.5 py-0", column.badgeClass)}
                        >
                          {allColumnTasks.length}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleColumnCollapse(column.id)}
                          className="size-6 text-muted-foreground hover:text-foreground rounded-md"
                          title={`Collapse ${column.title} column`}
                        >
                          <ChevronDown className="size-3 hidden lg:block" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenCreate(column.id)}
                          className="size-6 text-muted-foreground hover:text-foreground rounded-md"
                          title={`Add task to ${column.title}`}
                        >
                          <Plus className="size-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Independent Scrollable Cards Container */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin">
                      {allColumnTasks.length === 0 ? (
                        <div className="border border-dashed border-border/70 rounded-xl p-5 text-center text-xs text-muted-foreground/70 my-2">
                          No tasks in {column.title.toLowerCase()}
                        </div>
                      ) : (
                        <>
                          {visibleTasks.map((task, colTaskIndex) => {
                            const categoryName = categoryNames[task.categoryId] ?? "Uncategorized";
                            const theme = getCategoryTheme(categoryName);
                            const priorityInfo = PRIORITY_CONFIG[task.priority || "medium"];
                            const taskIndex = tasks.findIndex((t) => t.id === task.id);
                            const favoriteTestId = `favorite-toggle-${taskIndex >= 0 ? taskIndex : colTaskIndex}`;

                            // Check due status
                            const isOverdue =
                              task.dueAt &&
                              task.status !== "done" &&
                              task.status !== "cancelled" &&
                              task.dueAt.slice(0, 10) < currentTodayKey;

                            const isDueToday =
                              task.dueAt && task.dueAt.slice(0, 10) === currentTodayKey;

                            // Compact Mode
                            if (cardDensity === "compact") {
                              return (
                                <div
                                  key={task.id}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, task.id)}
                                  className={cn(
                                    "group flex items-center justify-between gap-1.5 rounded-lg border border-border/70 bg-card px-2.5 py-1.5 shadow-2xs hover:shadow-xs hover:border-border transition-all cursor-grab active:cursor-grabbing select-none relative",
                                    theme.borderClass,
                                    "border-l-4",
                                    task.isFavorite && "bg-amber-500/[0.02]",
                                  )}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    <span
                                      className={cn("size-2 rounded-full shrink-0", theme.dotClass)}
                                      title={categoryName}
                                    />
                                    <h4 className="text-xs font-medium text-foreground truncate" title={task.name}>
                                      {task.name}
                                    </h4>
                                    {isOverdue && (
                                      <span className="text-[10px] text-destructive font-semibold shrink-0">!</span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-0.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => void handleToggleFavorite(task)}
                                      className="p-1 rounded-md text-muted-foreground hover:text-amber-500 transition-colors"
                                      title="Toggle favorite"
                                      data-testid={favoriteTestId}
                                      aria-label={`Toggle favorite for ${task.name}`}
                                      aria-pressed={task.isFavorite}
                                    >
                                      <Star
                                        className={cn(
                                          "size-3 transition-colors",
                                          task.isFavorite
                                            ? "fill-amber-500 text-amber-500"
                                            : "text-muted-foreground hover:text-amber-500",
                                        )}
                                      />
                                    </button>

                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => void handleStart(task)}
                                      disabled={startingId !== null}
                                      className="size-5 text-primary hover:text-primary hover:bg-primary/10 rounded"
                                      title="Start timer"
                                    >
                                      <Play className="size-2.5 fill-primary text-primary" />
                                    </Button>

                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <button
                                          type="button"
                                          className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                          <MoreVertical className="size-3" />
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent side="bottom" align="end" className="w-36 p-1 text-xs">
                                        <button
                                          type="button"
                                          onClick={() => handleOpenEdit(task)}
                                          className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-left hover:bg-muted transition-colors text-foreground"
                                        >
                                          <Pencil className="size-3 text-muted-foreground" />
                                          <span>Edit Task</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void handleDeleteTask(task.id)}
                                          className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-left hover:bg-destructive/10 text-destructive transition-colors"
                                        >
                                          <Trash2 className="size-3 text-destructive" />
                                          <span>Delete</span>
                                        </button>
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                </div>
                              );
                            }

                            // Comfortable Mode (Default)
                            return (
                              <div
                                key={task.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, task.id)}
                                className={cn(
                                  "group rounded-xl border border-border/70 bg-card p-3 shadow-2xs hover:shadow-xs hover:border-border transition-all cursor-grab active:cursor-grabbing select-none relative space-y-2",
                                  theme.borderClass,
                                  "border-l-4",
                                  task.isFavorite && "bg-amber-500/[0.015]",
                                )}
                              >
                                {/* Card Top: Category, Priority, Star, Menu */}
                                <div className="flex items-center justify-between gap-1">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <CategoryBadge categoryName={categoryName} size="sm" showIcon={false} />
                                    {task.priority && task.priority !== "medium" && (
                                      <Badge
                                        variant="outline"
                                        className={cn("text-[9px] px-1 py-0", priorityInfo.badgeClass)}
                                      >
                                        {task.priority === "urgent" && <Flame className="size-2.5 mr-0.5 inline" />}
                                        {priorityInfo.label}
                                      </Badge>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-0.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => void handleToggleFavorite(task)}
                                      className="p-1 rounded-md text-muted-foreground hover:text-amber-500 transition-colors"
                                      title="Toggle favorite"
                                      data-testid={favoriteTestId}
                                      aria-label={`Toggle favorite for ${task.name}`}
                                      aria-pressed={task.isFavorite}
                                    >
                                      <Star
                                        className={cn(
                                          "size-3.5 transition-colors",
                                          task.isFavorite
                                            ? "fill-amber-500 text-amber-500"
                                            : "text-muted-foreground hover:text-amber-500",
                                        )}
                                      />
                                    </button>

                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <button
                                          type="button"
                                          className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                          <MoreVertical className="size-3" />
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent side="bottom" align="end" className="w-36 p-1 text-xs">
                                        <button
                                          type="button"
                                          onClick={() => handleOpenEdit(task)}
                                          className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-left hover:bg-muted transition-colors text-foreground"
                                        >
                                          <Pencil className="size-3 text-muted-foreground" />
                                          <span>Edit Task</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void handleDeleteTask(task.id)}
                                          className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-left hover:bg-destructive/10 text-destructive transition-colors"
                                        >
                                          <Trash2 className="size-3 text-destructive" />
                                          <span>Delete</span>
                                        </button>
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                </div>

                                {/* Card Title & Description */}
                                <div>
                                  <h4 className="text-xs font-semibold text-foreground leading-snug">
                                    {task.name}
                                  </h4>
                                  {task.description && (
                                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                                      {task.description}
                                    </p>
                                  )}
                                </div>

                                {/* Due Date / Overdue Indicator */}
                                {task.dueAt && (
                                  <div className="flex items-center gap-1 text-[10px]">
                                    {isOverdue ? (
                                      <span className="flex items-center gap-1 text-destructive font-medium">
                                        <AlertTriangle className="size-2.5" />
                                        Overdue ({task.dueAt.slice(5, 10)})
                                      </span>
                                    ) : isDueToday ? (
                                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                                        <Calendar className="size-2.5" />
                                        Due today
                                      </span>
                                    ) : (
                                      <span className="flex items-center gap-1 text-muted-foreground">
                                        <Calendar className="size-2.5" />
                                        Due {task.dueAt.slice(5, 10)}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Card Footer: Start & Quick Move Controls */}
                                <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-1">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => void handleStart(task)}
                                    disabled={startingId !== null}
                                    className="h-6 text-[11px] px-2 gap-1 text-primary hover:text-primary font-medium border-primary/30 hover:bg-primary/10"
                                  >
                                    <Play className="size-2.5 fill-primary text-primary" />
                                    {startingId === task.id ? "…" : "Start"}
                                  </Button>

                                  {/* Quick Status Mover Pills */}
                                  <div className="flex items-center gap-1">
                                    {column.id !== "todo" && column.id !== "backlog" && (
                                      <button
                                        type="button"
                                        onClick={() => void handleMoveStatus(task.id, "todo")}
                                        className="text-[9px] px-1.5 py-0.5 rounded border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                        title="Move to To Do"
                                      >
                                        To Do
                                      </button>
                                    )}
                                    {column.id !== "in_progress" && (
                                      <button
                                        type="button"
                                        onClick={() => void handleMoveStatus(task.id, "in_progress")}
                                        className="text-[9px] px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-colors"
                                        title="Move to In Progress"
                                      >
                                        Doing
                                      </button>
                                    )}
                                    {column.id !== "blocked" && column.id === "in_progress" && (
                                      <button
                                        type="button"
                                        onClick={() => void handleMoveStatus(task.id, "blocked")}
                                        className="text-[9px] px-1.5 py-0.5 rounded border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 transition-colors"
                                        title="Mark Blocked"
                                      >
                                        Block
                                      </button>
                                    )}
                                    {column.id !== "done" && (
                                      <button
                                        type="button"
                                        onClick={() => void handleMoveStatus(task.id, "done")}
                                        className="text-[9px] px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                                        title="Mark Done"
                                      >
                                        Done
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {/* Progressive Disclosure Load More / Show All */}
                          {hasMore ? (
                            <div className="pt-2 pb-1 text-center border-t border-border/40 mt-3 space-y-1.5">
                              <p className="text-[10px] text-muted-foreground font-medium">
                                Showing {visibleTasks.length} of {allColumnTasks.length}
                              </p>
                              <div className="flex items-center justify-center gap-1.5">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleLoadMore(column.id)}
                                  className="h-6 text-[10px] px-2 font-medium"
                                >
                                  + Load {DEFAULT_PAGE_SIZE}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleShowAll(column.id, allColumnTasks.length)}
                                  className="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground"
                                >
                                  All ({allColumnTasks.length})
                                </Button>
                              </div>
                            </div>
                          ) : allColumnTasks.length > DEFAULT_PAGE_SIZE ? (
                            <div className="pt-2 pb-1 text-center border-t border-border/30 mt-2">
                              <button
                                type="button"
                                onClick={() => handleCollapseLimit(column.id)}
                                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                              >
                                Show less ({DEFAULT_PAGE_SIZE})
                              </button>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* List View */
          <div className="space-y-2.5">
            {sortedTasks.length === 0 ? (
              <Card className="p-8 text-center sm:p-10">
                <p className="font-heading text-base font-medium">No tasks found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create a task to start tracking your work.
                </p>
              </Card>
            ) : (
              sortedTasks.map((task, listIndex) => {
                const categoryName = categoryNames[task.categoryId] ?? "Uncategorized";
                const theme = getCategoryTheme(categoryName);
                const col = COLUMNS.find((c) => c.id === task.status) || COLUMNS[1];
                const priorityInfo = PRIORITY_CONFIG[task.priority || "medium"];
                const taskIndex = tasks.findIndex((t) => t.id === task.id);
                const favoriteTestId = `favorite-toggle-${taskIndex >= 0 ? taskIndex : listIndex}`;

                return (
                  <Card
                    key={task.id}
                    size="sm"
                    className={cn(
                      "flex flex-col sm:flex-row sm:items-center justify-between p-3.5 gap-3 border-l-4 shadow-2xs hover:shadow-xs transition-colors",
                      theme.borderClass,
                      task.isFavorite && "border-amber-500/30 bg-amber-500/[0.015]",
                    )}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <CategoryBadge categoryName={categoryName} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-foreground truncate">
                            {task.name}
                          </p>
                          {task.priority && task.priority !== "medium" && (
                            <Badge
                              variant="outline"
                              className={cn("text-[10px] px-1.5 py-0", priorityInfo.badgeClass)}
                            >
                              {priorityInfo.label}
                            </Badge>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 justify-between sm:justify-end">
                      <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5", col.badgeClass)}>
                        {col.title}
                      </Badge>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => void handleToggleFavorite(task)}
                        className="size-8 text-muted-foreground hover:text-amber-500"
                        data-testid={favoriteTestId}
                        aria-label={`Toggle favorite for ${task.name}`}
                        aria-pressed={task.isFavorite}
                      >
                        <Star
                          className={cn(
                            "size-4",
                            task.isFavorite
                              ? "fill-amber-500 text-amber-500"
                              : "text-muted-foreground hover:text-amber-500",
                          )}
                        />
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void handleStart(task)}
                        disabled={startingId !== null}
                        className="h-8 px-3 text-xs gap-1 font-medium shadow-xs"
                      >
                        <Play className="size-3" />
                        {startingId === task.id ? "Starting…" : "Start"}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(task)}
                        className="h-8 px-2 text-xs"
                      >
                        Edit
                      </Button>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Task Creation & Edit Modal Dialog */}
      <TaskModalDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editingTask}
        defaultColumn={defaultColumnForNew}
        categories={categories}
        existingTasks={tasks}
        onSaved={(savedTask) => {
          setTasks((prev) => {
            const exists = prev.some((t) => t.id === savedTask.id);
            if (exists) {
              return prev.map((t) => (t.id === savedTask.id ? savedTask : t));
            }
            return [savedTask, ...prev];
          });
        }}
        onDeleted={(deletedId) => {
          setTasks((prev) => prev.filter((t) => t.id !== deletedId));
        }}
      />
    </div>
  );
}

interface TaskModalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskDTO | null;
  defaultColumn: TaskStatus;
  categories: CategoryDTO[];
  existingTasks: TaskDTO[];
  onSaved: (task: TaskDTO) => void;
  onDeleted: (taskId: string) => void;
}

function TaskModalDialog({
  open,
  onOpenChange,
  task,
  defaultColumn,
  categories,
  existingTasks,
  onSaved,
  onDeleted,
}: TaskModalDialogProps) {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <TaskModalInner
        key={task?.id ?? defaultColumn ?? "new"}
        task={task}
        defaultColumn={defaultColumn}
        categories={categories}
        existingTasks={existingTasks}
        onOpenChange={onOpenChange}
        onSaved={onSaved}
        onDeleted={onDeleted}
      />
    </Dialog>
  );
}

function TaskModalInner({
  task,
  defaultColumn,
  categories,
  existingTasks,
  onOpenChange,
  onSaved,
  onDeleted,
}: {
  task: TaskDTO | null;
  defaultColumn: TaskStatus;
  categories: CategoryDTO[];
  existingTasks: TaskDTO[];
  onOpenChange: (open: boolean) => void;
  onSaved: (task: TaskDTO) => void;
  onDeleted: (taskId: string) => void;
}) {
  const isEditing = Boolean(task);

  const defaultCatId =
    task?.categoryId || categories.find((c) => c.key === "technology_innovation")?.id || categories[0]?.id || "";

  const [name, setName] = useState(task?.name || "");
  const [categoryId, setCategoryId] = useState<string>(defaultCatId);
  const [status, setStatus] = useState<TaskStatus>(task?.status || defaultColumn);
  const [priority, setPriority] = useState<TaskPriority>(task?.priority || "medium");
  const [dueDate, setDueDate] = useState<string>(task?.dueAt ? task.dueAt.slice(0, 10) : "");
  const [description, setDescription] = useState(task?.description || "");
  const [isFavorite, setIsFavorite] = useState(task?.isFavorite ?? false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Suggest existing similar tasks when creating a new task to prevent accidental duplication
  const similarTasks = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (isEditing || q.length < 2) return [];
    return existingTasks
      .filter((t) => t.name.toLowerCase().includes(q))
      .slice(0, 3);
  }, [name, existingTasks, isEditing]);

  async function handleSave() {
    if (!name.trim()) {
      setError("Task name is required");
      return;
    }
    if (!categoryId) {
      setError("Please select a category");
      return;
    }

    setSaving(true);
    setError(null);

    const dueAtPayload = dueDate ? new Date(dueDate + "T23:59:59Z").toISOString() : null;

    try {
      if (isEditing && task) {
        const res = await apiFetch<TaskDTO>(`/api/tasks/${task.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: name.trim(),
            categoryId,
            status,
            priority,
            dueAt: dueAtPayload,
            description: description.trim() || null,
            isFavorite,
          }),
        });
        toast.success("Task updated");
        onSaved(res);
        onOpenChange(false);
      } else {
        const res = await apiFetch<TaskDTO>("/api/tasks", {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            categoryId,
            status,
            priority,
            dueAt: dueAtPayload,
            description: description.trim() || null,
            isFavorite,
          }),
        });
        toast.success("Task created");
        onSaved(res);
        onOpenChange(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save task");
      toast.error(err instanceof Error ? err.message : "Failed to save task");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!task) return;
    if (!confirm("Are you sure you want to delete this task?")) return;

    setDeleting(true);
    try {
      await apiFetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      toast.success("Task deleted");
      onDeleted(task.id);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete task");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="text-lg font-semibold tracking-tight">
          {isEditing ? "Edit Task" : "Create New Task"}
        </DialogTitle>
        <DialogDescription>
          {isEditing
            ? "Modify task name, status, priority, and workflow details."
            : "Add a new task directly into your active workflow."}
        </DialogDescription>
      </DialogHeader>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-center gap-2">
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-3.5 py-1">
        {/* Name */}
        <div className="space-y-1">
          <Label htmlFor="task-name" className="text-xs font-semibold text-foreground/80">
            Task Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="task-name"
            placeholder="e.g. Implement OAuth Flow"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving || deleting}
            autoFocus
            className="text-sm font-medium"
          />

          {/* Autocomplete / Duplication warning for similar tasks */}
          {similarTasks.length > 0 && (
            <div className="rounded-lg bg-muted/60 border border-border/80 p-2 text-xs text-muted-foreground space-y-1 mt-1">
              <span className="font-semibold text-foreground text-[10px]">
                Similar existing task found:
              </span>
              <div className="flex flex-wrap gap-1">
                {similarTasks.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      setName(st.name);
                      setCategoryId(st.categoryId);
                      if (st.status) setStatus(st.status);
                      if (st.priority) setPriority(st.priority);
                    }}
                    className="px-2 py-0.5 rounded bg-background hover:bg-muted border border-border text-[11px] font-medium text-foreground transition-colors cursor-pointer"
                    title="Click to use this existing task name"
                  >
                    {st.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Status */}
        <div className="space-y-1">
          <Label className="text-xs font-semibold text-foreground/80">Workflow Status</Label>
          <div className="grid grid-cols-5 gap-1.5">
            {COLUMNS.map((col) => (
              <button
                key={col.id}
                type="button"
                onClick={() => setStatus(col.id)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-lg border text-[11px] font-medium transition-all select-none cursor-pointer",
                  status === col.id
                    ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                    : "border-border/70 hover:bg-muted text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    status === col.id ? "bg-primary-foreground" : col.dotColor,
                  )}
                />
                <span className="truncate">{col.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Priority & Due Date */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-foreground/80">Priority</Label>
            <Select value={priority} onValueChange={(val: TaskPriority) => setPriority(val)}>
              <SelectTrigger className="w-full text-xs h-9">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="urgent">🔥 Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="due-date" className="text-xs font-semibold text-foreground/80">
              Due Date
            </Label>
            <Input
              id="due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={saving || deleting}
              className="text-xs h-9"
            />
          </div>
        </div>

        {/* Category */}
        <div className="space-y-1">
          <Label className="text-xs font-semibold text-foreground/80">Category</Label>
          <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
            {categories.map((cat) => {
              const isSelected = categoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryId(cat.id)}
                  className={cn(
                    "flex items-center gap-1.5 p-1.5 rounded-lg border text-left text-xs transition-all select-none cursor-pointer",
                    isSelected
                      ? "border-primary/60 bg-primary/10 text-primary font-semibold shadow-xs"
                      : "border-border/60 hover:border-border hover:bg-muted/40 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <CategoryBadge
                    categoryKey={cat.key}
                    categoryName={cat.name}
                    showIcon={false}
                    size="sm"
                    className="px-1 py-0 border-0 bg-transparent text-[11px]"
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1">
          <Label htmlFor="task-description" className="text-xs font-semibold text-foreground/80">
            Description / Notes
          </Label>
          <Textarea
            id="task-description"
            placeholder="Add context, specifications, or subtasks..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={saving || deleting}
            rows={2}
            className="text-xs resize-none"
          />
        </div>

        {/* Favorite */}
        <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none pt-0.5">
          <input
            type="checkbox"
            checked={isFavorite}
            onChange={(e) => setIsFavorite(e.target.checked)}
            className="rounded border-input text-amber-500 focus:ring-amber-500 size-4"
          />
          <span className="flex items-center gap-1.5">
            <Star className={cn("size-3.5", isFavorite && "fill-amber-500 text-amber-500")} />
            Mark as favorite task
          </span>
        </label>
      </div>

      <DialogFooter className="flex flex-row items-center justify-between gap-2 pt-3 border-t border-border/60">
        <div>
          {isEditing && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={saving || deleting}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs gap-1.5"
            >
              {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              Delete
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving || deleting}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving || deleting}
            className="text-xs gap-1.5 font-medium shadow-sm"
          >
            {saving ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                {isEditing ? "Saving…" : "Creating…"}
              </>
            ) : isEditing ? (
              "Save Changes"
            ) : (
              "Create Task"
            )}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  );
}
