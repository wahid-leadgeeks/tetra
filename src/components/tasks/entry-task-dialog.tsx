"use client";

import { TaskModalDialog } from "@/components/tasks/task-dialog";
import type { CategoryDTO, TaskDTO, TimeEntryDTO } from "@/lib/types";

interface EntryTaskDialogProps {
  entry: TimeEntryDTO | null;
  categories: CategoryDTO[];
  onOpenChange: (open: boolean) => void;
  onSaved: (task: TaskDTO) => void;
}

/**
 * Opens the task editor for the task behind a time entry. Seeds the dialog from
 * `entry.taskDetails` (the task's own category and fields, never the entry's), so a
 * save without changes is a no-op on the task row. Renders nothing without details.
 */
export function EntryTaskDialog({ entry, categories, onOpenChange, onSaved }: EntryTaskDialogProps) {
  const details = entry?.taskDetails;
  if (!entry || !details) return null;

  const category = categories.find((c) => c.id === details.categoryId);
  const task: TaskDTO = {
    id: entry.taskId,
    name: entry.taskName,
    categoryId: details.categoryId,
    categoryKey: category?.key,
    categoryName: category?.name,
    status: details.status,
    priority: details.priority,
    description: details.description,
    dueAt: details.dueAt,
    isFavorite: details.isFavorite,
    lastUsedAt: null,
  };

  return (
    <TaskModalDialog
      open
      onOpenChange={onOpenChange}
      task={task}
      defaultColumn="todo"
      categories={categories}
      existingTasks={[]}
      allowDelete={false}
      onSaved={onSaved}
      onDeleted={() => {}}
    />
  );
}
