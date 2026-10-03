"use client";

import { useMemo, useState } from "react";
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import {
  type CardDensity,
  type QuickFilter,
  type SortOption,
} from "@/components/tasks/task-constants";
import { TaskModalDialog } from "@/components/tasks/task-dialog";
import {
  computeTaskStats,
  countActiveFilters,
  filterTasks,
  groupTasksByColumn,
  sortTasks,
} from "@/components/tasks/task-filters";
import { TaskListView } from "@/components/tasks/task-list-view";
import { TasksFilterBar } from "@/components/tasks/tasks-filter-bar";
import { TasksHeader } from "@/components/tasks/tasks-header";
import { useKanbanState } from "@/components/tasks/use-kanban-state";
import { useTasksState } from "@/components/tasks/use-tasks-state";
import { todayKey } from "@/lib/time";
import type { TaskDTO, TaskStatus } from "@/lib/types";

interface TasksViewProps {
  timeZone: string;
}

export function TasksView({ timeZone }: TasksViewProps) {
  const currentTodayKey = useMemo(() => todayKey(timeZone || "Asia/Jakarta"), [timeZone]);

  const {
    tasks,
    setTasks,
    categories,
    loading,
    error,
    startingId,
    loadData,
    handleStart,
    handleToggleFavorite,
    handleMoveStatus,
    handleDeleteTask,
  } = useTasksState();

  // Filters & display preferences
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [hideDone, setHideDone] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("favorites");
  const [cardDensity, setCardDensity] = useState<CardDensity>("comfortable");

  const kanban = useKanbanState({ onMoveStatus: handleMoveStatus });

  // Task modal dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskDTO | null>(null);
  const [defaultColumnForNew, setDefaultColumnForNew] = useState<TaskStatus>("todo");

  const categoryNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const cat of categories) {
      map[cat.id] = cat.name;
    }
    return map;
  }, [categories]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return filterTasks(tasks, {
      quickFilter,
      hideDone,
      selectedCategory,
      searchQuery,
      categoryNames,
      currentTodayKey,
    });
  }, [tasks, quickFilter, hideDone, selectedCategory, searchQuery, categoryNames, currentTodayKey]);

  // Sorted and filtered tasks
  const sortedTasks = useMemo(() => {
    return sortTasks(filteredTasks, sortBy);
  }, [filteredTasks, sortBy]);

  // Tasks grouped by Kanban column
  const tasksByColumn = useMemo(() => {
    return groupTasksByColumn(sortedTasks);
  }, [sortedTasks]);

  // Statistics summing exactly across all workflow states
  const stats = useMemo(() => {
    return computeTaskStats(tasks);
  }, [tasks]);

  function handleOpenCreate(columnId: TaskStatus = "todo") {
    setEditingTask(null);
    setDefaultColumnForNew(columnId);
    setDialogOpen(true);
  }

  function handleOpenEdit(task: TaskDTO) {
    setEditingTask(task);
    setDialogOpen(true);
  }

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    countActiveFilters({ quickFilter, sortBy, hideDone, selectedCategory }) > 0;

  function handleClearFilters() {
    setSearchQuery("");
    setQuickFilter("all");
    setSortBy("favorites");
    setHideDone(false);
    setSelectedCategory("all");
  }

  return (
    <div className="w-full space-y-5">
      {/* Header Bar */}
      <TasksHeader
        loading={loading}
        stats={stats}
        cardDensity={cardDensity}
        setCardDensity={setCardDensity}
        viewMode={viewMode}
        setViewMode={setViewMode}
        handleOpenCreate={handleOpenCreate}
      />

      {/* Filter and Control Bar */}
      <TasksFilterBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        quickFilter={quickFilter}
        setQuickFilter={setQuickFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
        hideDone={hideDone}
        setHideDone={setHideDone}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        categories={categories}
      />

      {/* Main Content: Kanban or List */}
      <div data-testid="tasks-list">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3" aria-label="Loading tasks" data-loading="true">
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
          <KanbanBoard
            kanban={kanban}
            hideDone={hideDone}
            tasks={tasks}
            tasksByColumn={tasksByColumn}
            cardDensity={cardDensity}
            categoryNames={categoryNames}
            currentTodayKey={currentTodayKey}
            startingId={startingId}
            handleOpenCreate={handleOpenCreate}
            handleToggleFavorite={handleToggleFavorite}
            handleStart={handleStart}
            handleOpenEdit={handleOpenEdit}
            handleDeleteTask={handleDeleteTask}
            handleMoveStatus={handleMoveStatus}
          />
        ) : (
          /* List View */
          <TaskListView
            sortedTasks={sortedTasks}
            tasks={tasks}
            categoryNames={categoryNames}
            startingId={startingId}
            handleToggleFavorite={handleToggleFavorite}
            handleStart={handleStart}
            handleOpenEdit={handleOpenEdit}
            onCreate={() => handleOpenCreate("todo")}
            onClearFilters={hasActiveFilters ? handleClearFilters : undefined}
          />
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
