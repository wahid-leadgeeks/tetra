"use client";

import { ChevronDown, ChevronRight, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TaskCard } from "@/components/tasks/task-card";
import {
  DEFAULT_PAGE_SIZE,
  type CardDensity,
  type KanbanColumnConfig,
} from "@/components/tasks/task-constants";
import type { TaskDTO, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  column: KanbanColumnConfig;
  tasks: TaskDTO[];
  tasksByColumn: Record<TaskStatus, TaskDTO[]>;
  dragOverColumn: TaskStatus | null;
  collapsedColumns: Record<TaskStatus, boolean>;
  visibleLimits: Record<TaskStatus, number>;
  cardDensity: CardDensity;
  categoryNames: Record<string, string>;
  currentTodayKey: string;
  startingId: string | null;
  handleDragOver: (e: React.DragEvent, columnId: TaskStatus) => void;
  handleDrop: (e: React.DragEvent, columnId: TaskStatus) => void;
  toggleColumnCollapse: (columnId: TaskStatus) => void;
  handleOpenCreate: (columnId?: TaskStatus) => void;
  handleLoadMore: (columnId: TaskStatus) => void;
  handleShowAll: (columnId: TaskStatus, total: number) => void;
  handleCollapseLimit: (columnId: TaskStatus) => void;
  handleDragStart: (e: React.DragEvent, taskId: string) => void;
  handleToggleFavorite: (task: TaskDTO) => Promise<void>;
  handleStart: (task: TaskDTO) => Promise<void>;
  handleOpenEdit: (task: TaskDTO) => void;
  handleDeleteTask: (taskId: string) => Promise<void>;
  handleMoveStatus: (taskId: string, newStatus: TaskStatus) => Promise<void>;
}

export function KanbanColumn({
  column,
  tasks,
  tasksByColumn,
  dragOverColumn,
  collapsedColumns,
  visibleLimits,
  cardDensity,
  categoryNames,
  currentTodayKey,
  startingId,
  handleDragOver,
  handleDrop,
  toggleColumnCollapse,
  handleOpenCreate,
  handleLoadMore,
  handleShowAll,
  handleCollapseLimit,
  handleDragStart,
  handleToggleFavorite,
  handleStart,
  handleOpenEdit,
  handleDeleteTask,
  handleMoveStatus,
}: KanbanColumnProps) {
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
        onDragOver={(e) => handleDragOver(e, column.id)}
        onDrop={(e) => handleDrop(e, column.id)}
        onClick={() => toggleColumnCollapse(column.id)}
        className={cn(
          "flex flex-col items-center justify-between rounded-2xl border bg-card/40 hover:bg-card/70 backdrop-blur-xs p-3 transition-all cursor-pointer select-none shrink-0",
          "w-full lg:w-12 h-16 lg:h-[calc(100vh-235px)] lg:min-h-[500px] lg:max-h-[820px]",
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
      onDragOver={(e) => handleDragOver(e, column.id)}
      onDrop={(e) => handleDrop(e, column.id)}
      className={cn(
        "flex flex-col rounded-2xl border bg-card/40 backdrop-blur-xs transition-all",
        "flex-1 min-w-[185px] w-full",
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
            <p>No tasks in {column.title.toLowerCase()}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleOpenCreate(column.id)}
              className="mt-2 h-7 gap-1 text-xs"
            >
              <Plus className="size-3" />
              Add task
            </Button>
          </div>
        ) : (
          <>
            {visibleTasks.map((task, colTaskIndex) => {
              const taskIndex = tasks.findIndex((t) => t.id === task.id);
              const favoriteTestId = `favorite-toggle-${taskIndex >= 0 ? taskIndex : colTaskIndex}`;

              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  columnId={column.id}
                  favoriteTestId={favoriteTestId}
                  cardDensity={cardDensity}
                  categoryNames={categoryNames}
                  currentTodayKey={currentTodayKey}
                  startingId={startingId}
                  handleDragStart={handleDragStart}
                  handleToggleFavorite={handleToggleFavorite}
                  handleStart={handleStart}
                  handleOpenEdit={handleOpenEdit}
                  handleDeleteTask={handleDeleteTask}
                  handleMoveStatus={handleMoveStatus}
                />
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
}
