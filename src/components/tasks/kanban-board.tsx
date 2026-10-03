"use client";

import { KanbanColumn } from "@/components/tasks/kanban-column";
import { COLUMNS, type CardDensity } from "@/components/tasks/task-constants";
import type { useKanbanState } from "@/components/tasks/use-kanban-state";
import type { TaskDTO, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface KanbanBoardProps {
  kanban: ReturnType<typeof useKanbanState>;
  hideDone: boolean;
  tasks: TaskDTO[];
  tasksByColumn: Record<TaskStatus, TaskDTO[]>;
  cardDensity: CardDensity;
  categoryNames: Record<string, string>;
  currentTodayKey: string;
  startingId: string | null;
  handleOpenCreate: (columnId?: TaskStatus) => void;
  handleToggleFavorite: (task: TaskDTO) => Promise<void>;
  handleStart: (task: TaskDTO) => Promise<void>;
  handleOpenEdit: (task: TaskDTO) => void;
  handleDeleteTask: (taskId: string) => Promise<void>;
  handleMoveStatus: (taskId: string, newStatus: TaskStatus) => Promise<void>;
}

export function KanbanBoard({
  kanban,
  hideDone,
  tasks,
  tasksByColumn,
  cardDensity,
  categoryNames,
  currentTodayKey,
  startingId,
  handleOpenCreate,
  handleToggleFavorite,
  handleStart,
  handleOpenEdit,
  handleDeleteTask,
  handleMoveStatus,
}: KanbanBoardProps) {
  const {
    visibleLimits,
    collapsedColumns,
    mobileTab,
    setMobileTab,
    dragOverColumn,
    handleLoadMore,
    handleShowAll,
    handleCollapseLimit,
    toggleColumnCollapse,
    handleDragStart,
    handleDragOver,
    handleDrop,
  } = kanban;

  return (
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
      <div className="flex flex-col lg:flex-row gap-2.5 xl:gap-3 items-stretch overflow-x-auto pb-2 min-w-0">
        {COLUMNS.map((column) => {
          // If hideDone is active and column is done, skip rendering unless dragged over
          if (hideDone && column.id === "done" && dragOverColumn !== "done") {
            return null;
          }

          // Mobile tab filter check
          if (mobileTab !== "all" && mobileTab !== column.id) {
            return null;
          }

          return (
            <KanbanColumn
              key={column.id}
              column={column}
              tasks={tasks}
              tasksByColumn={tasksByColumn}
              dragOverColumn={dragOverColumn}
              collapsedColumns={collapsedColumns}
              visibleLimits={visibleLimits}
              cardDensity={cardDensity}
              categoryNames={categoryNames}
              currentTodayKey={currentTodayKey}
              startingId={startingId}
              handleDragOver={handleDragOver}
              handleDrop={handleDrop}
              toggleColumnCollapse={toggleColumnCollapse}
              handleOpenCreate={handleOpenCreate}
              handleLoadMore={handleLoadMore}
              handleShowAll={handleShowAll}
              handleCollapseLimit={handleCollapseLimit}
              handleDragStart={handleDragStart}
              handleToggleFavorite={handleToggleFavorite}
              handleStart={handleStart}
              handleOpenEdit={handleOpenEdit}
              handleDeleteTask={handleDeleteTask}
              handleMoveStatus={handleMoveStatus}
            />
          );
        })}
      </div>
    </div>
  );
}
