"use client";

import { useState } from "react";

import { DEFAULT_PAGE_SIZE } from "@/components/tasks/task-constants";
import type { TaskStatus } from "@/lib/types";

interface UseKanbanStateOptions {
  onMoveStatus: (taskId: string, newStatus: TaskStatus) => Promise<void>;
}

export function useKanbanState({ onMoveStatus }: UseKanbanStateOptions) {
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
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

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
      void onMoveStatus(taskId, columnId);
    }
  }

  return {
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
  };
}
