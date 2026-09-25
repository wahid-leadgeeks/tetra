"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Kanban,
  List,
  Loader2,
  MoreVertical,
  Pencil,
  Play,
  Plus,
  Search,
  Star,
  Trash2,
  TriangleAlert,
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
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/components/timeline/api";
import { getCategoryTheme } from "@/lib/categories";
import type { CategoryDTO, TaskDTO, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TasksViewProps {
  timeZone: string;
}

const COLUMNS: Array<{
  id: TaskStatus;
  title: string;
  dotColor: string;
  badgeClass: string;
  borderClass: string;
}> = [
  {
    id: "todo",
    title: "To Do",
    dotColor: "bg-slate-400 dark:bg-slate-500",
    badgeClass: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20",
    borderClass: "border-slate-500/30",
  },
  {
    id: "in_progress",
    title: "In Progress",
    dotColor: "bg-amber-500 animate-pulse",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
    borderClass: "border-amber-500/30",
  },
  {
    id: "done",
    title: "Done",
    dotColor: "bg-emerald-500",
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    borderClass: "border-emerald-500/30",
  },
];

export function TasksView({ timeZone: _timeZone }: TasksViewProps) {
  const router = useRouter();

  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & display
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  // Task actions
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
      if (onlyFavorites && !t.isFavorite) return false;
      if (selectedCategory !== "all" && t.categoryId !== selectedCategory) return false;
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
  }, [tasks, onlyFavorites, selectedCategory, searchQuery, categoryNames]);

  // Tasks grouped by Kanban column
  const tasksByColumn = useMemo(() => {
    const map: Record<TaskStatus, TaskDTO[]> = {
      todo: [],
      in_progress: [],
      done: [],
    };
    for (const t of filteredTasks) {
      const status = t.status || "todo";
      if (map[status]) {
        map[status].push(t);
      } else {
        map.todo.push(t);
      }
    }
    return map;
  }, [filteredTasks]);

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

      // If task was in todo, move it to in_progress automatically
      if (task.status === "todo") {
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

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
    );

    try {
      await apiFetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      if (showToast) {
        const colTitle = COLUMNS.find((c) => c.id === newStatus)?.title || newStatus;
        toast.success(`Moved to ${colTitle}`);
      }
    } catch {
      // Rollback
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: prevTask.status } : t)),
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
    <div className="w-full space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Tasks Kanban</h1>
            {!loading && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/30 px-2.5 py-0.5 text-xs font-semibold text-foreground">
                {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your workflow across To Do, In Progress, and Done.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* View Mode Toggle */}
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

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-9"
            />
          </div>

          <button
            type="button"
            onClick={() => setOnlyFavorites(!onlyFavorites)}
            className={cn(
              "flex items-center gap-1.5 px-3 h-9 rounded-lg border text-xs font-medium transition-all select-none cursor-pointer",
              onlyFavorites
                ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 font-semibold"
                : "border-border/70 hover:border-border text-muted-foreground hover:text-foreground bg-card/60",
            )}
          >
            <Star
              className={cn(
                "size-3.5",
                onlyFavorites ? "fill-amber-500 text-amber-500" : "text-muted-foreground",
              )}
            />
            <span>Favorites</span>
          </button>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" aria-label="Loading tasks">
          {[0, 1, 2].map((i) => (
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
        /* Kanban Board View */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 items-start">
          {COLUMNS.map((column) => {
            const columnTasks = tasksByColumn[column.id] || [];
            const isDragOver = dragOverColumn === column.id;

            return (
              <div
                key={column.id}
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDrop={(e) => handleDrop(e, column.id)}
                className={cn(
                  "flex flex-col rounded-2xl border bg-card/40 backdrop-blur-xs p-3.5 transition-all min-h-[480px]",
                  column.borderClass,
                  isDragOver && "ring-2 ring-primary bg-primary/[0.03] border-primary",
                )}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 border-b border-border/50 mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className={cn("size-2.5 rounded-full", column.dotColor)} />
                    <h3 className="text-sm font-bold tracking-tight text-foreground">
                      {column.title}
                    </h3>
                    <Badge variant="outline" className={cn("text-[11px] font-mono px-2 py-0", column.badgeClass)}>
                      {columnTasks.length}
                    </Badge>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenCreate(column.id)}
                    className="size-7 text-muted-foreground hover:text-foreground rounded-lg"
                    title={`Add task to ${column.title}`}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </div>

                {/* Cards Container */}
                <div className="space-y-2.5 flex-1 overflow-y-auto">
                  {columnTasks.length === 0 ? (
                    <div className="border border-dashed border-border/70 rounded-xl p-6 text-center text-xs text-muted-foreground/70 my-2">
                      No tasks in {column.title.toLowerCase()}
                    </div>
                  ) : (
                    columnTasks.map((task, colTaskIndex) => {
                      const categoryName = categoryNames[task.categoryId] ?? "Uncategorized";
                      const theme = getCategoryTheme(categoryName);
                      const taskIndex = tasks.findIndex((t) => t.id === task.id);
                      const favoriteTestId = `favorite-toggle-${taskIndex >= 0 ? taskIndex : colTaskIndex}`;

                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          className={cn(
                            "group rounded-xl border border-border/70 bg-card p-3.5 shadow-2xs hover:shadow-xs hover:border-border transition-all cursor-grab active:cursor-grabbing select-none relative space-y-2.5",
                            theme.borderClass,
                            "border-l-4",
                            task.isFavorite && "bg-amber-500/[0.015]",
                          )}
                        >
                          {/* Card Top: Category & Favorite */}
                          <div className="flex items-center justify-between gap-1.5">
                            <CategoryBadge categoryName={categoryName} size="sm" showIcon={false} />

                            <div className="flex items-center gap-1">
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

                              {/* Card Options Popover */}
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    <MoreVertical className="size-3.5" />
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
                            <h4 className="text-sm font-semibold text-foreground leading-snug">
                              {task.name}
                            </h4>
                            {task.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                {task.description}
                              </p>
                            )}
                          </div>

                          {/* Card Footer: Start & Quick Move Controls */}
                          <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void handleStart(task)}
                              disabled={startingId !== null}
                              className="h-7 text-xs px-2.5 gap-1 text-primary hover:text-primary font-medium border-primary/30 hover:bg-primary/10"
                            >
                              <Play className="size-3 fill-primary text-primary" />
                              {startingId === task.id ? "Starting…" : "Start"}
                            </Button>

                            {/* Move Status Buttons */}
                            <div className="flex items-center gap-1">
                              {column.id !== "todo" && (
                                <button
                                  type="button"
                                  onClick={() => void handleMoveStatus(task.id, "todo")}
                                  className="text-[10px] px-1.5 py-0.5 rounded border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                  title="Move to To Do"
                                >
                                  To Do
                                </button>
                              )}
                              {column.id !== "in_progress" && (
                                <button
                                  type="button"
                                  onClick={() => void handleMoveStatus(task.id, "in_progress")}
                                  className="text-[10px] px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-colors"
                                  title="Move to In Progress"
                                >
                                  Doing
                                </button>
                              )}
                              {column.id !== "done" && (
                                <button
                                  type="button"
                                  onClick={() => void handleMoveStatus(task.id, "done")}
                                  className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                                  title="Mark Done"
                                >
                                  Done
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="space-y-3">
          {filteredTasks.length === 0 ? (
            <Card className="p-8 text-center sm:p-10">
              <p className="font-heading text-base font-medium">No tasks found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a task to start tracking your work.
              </p>
            </Card>
          ) : (
            filteredTasks.map((task, listIndex) => {
              const categoryName = categoryNames[task.categoryId] ?? "Uncategorized";
              const theme = getCategoryTheme(categoryName);
              const col = COLUMNS.find((c) => c.id === task.status) || COLUMNS[0];
              const taskIndex = tasks.findIndex((t) => t.id === task.id);
              const favoriteTestId = `favorite-toggle-${taskIndex >= 0 ? taskIndex : listIndex}`;

              return (
                <Card
                  key={task.id}
                  size="sm"
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 border-l-4 shadow-2xs hover:shadow-xs transition-colors",
                    theme.borderClass,
                    task.isFavorite && "border-amber-500/30 bg-amber-500/[0.015]",
                  )}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <CategoryBadge categoryName={categoryName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-foreground truncate">
                        {task.name}
                      </p>
                      {task.description && (
                        <p className="text-xs text-muted-foreground truncate">
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
  onSaved: (task: TaskDTO) => void;
  onDeleted: (taskId: string) => void;
}

function TaskModalDialog({
  open,
  onOpenChange,
  task,
  defaultColumn,
  categories,
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
  onOpenChange,
  onSaved,
  onDeleted,
}: {
  task: TaskDTO | null;
  defaultColumn: TaskStatus;
  categories: CategoryDTO[];
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
  const [description, setDescription] = useState(task?.description || "");
  const [isFavorite, setIsFavorite] = useState(task?.isFavorite ?? false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    try {
      if (isEditing && task) {
        const res = await apiFetch<TaskDTO>(`/api/tasks/${task.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: name.trim(),
            categoryId,
            status,
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
            ? "Modify task name, category, status, and details."
            : "Add a new task directly to your Kanban board."}
        </DialogDescription>
      </DialogHeader>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-center gap-2">
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-4 py-2">
        {/* Name */}
        <div className="space-y-1.5">
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
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground/80">Status</Label>
          <div className="grid grid-cols-3 gap-2">
            {COLUMNS.map((col) => (
              <button
                key={col.id}
                type="button"
                onClick={() => setStatus(col.id)}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition-all select-none cursor-pointer",
                  status === col.id
                    ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                    : "border-border/70 hover:bg-muted text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "size-2 rounded-full",
                    status === col.id ? "bg-primary-foreground" : col.dotColor,
                  )}
                />
                <span>{col.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground/80">Category</Label>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
            {categories.map((cat) => {
              const isSelected = categoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryId(cat.id)}
                  className={cn(
                    "flex items-center gap-1.5 p-2 rounded-lg border text-left text-xs transition-all select-none cursor-pointer",
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
                    className="px-1.5 py-0 border-0 bg-transparent text-[11px]"
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
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
        <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none pt-1">
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
