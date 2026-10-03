"use client";

import { Play, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CategoryBadge } from "@/components/ui/category-badge";
import { COLUMNS, PRIORITY_CONFIG } from "@/components/tasks/task-constants";
import { getCategoryTheme } from "@/lib/categories";
import type { TaskDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TaskListViewProps {
  sortedTasks: TaskDTO[];
  tasks: TaskDTO[];
  categoryNames: Record<string, string>;
  startingId: string | null;
  handleToggleFavorite: (task: TaskDTO) => Promise<void>;
  handleStart: (task: TaskDTO) => Promise<void>;
  handleOpenEdit: (task: TaskDTO) => void;
  onCreate: () => void;
  onClearFilters?: () => void;
}

export function TaskListView({
  sortedTasks,
  tasks,
  categoryNames,
  startingId,
  handleToggleFavorite,
  handleStart,
  handleOpenEdit,
  onCreate,
  onClearFilters,
}: TaskListViewProps) {
  return (
    <div className="space-y-2.5">
      {sortedTasks.length === 0 ? (
        <Card className="p-8 text-center sm:p-10">
          <p className="font-heading text-base font-medium">No tasks found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {onClearFilters
              ? "No tasks match your filters."
              : "Create a task to start tracking your work."}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button type="button" size="sm" onClick={onCreate} className="text-xs">
              New Task
            </Button>
            {onClearFilters && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClearFilters}
                className="text-xs"
              >
                Clear filters
              </Button>
            )}
          </div>
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
                <CategoryBadge categoryName={categoryName} size="sm" className="max-w-[130px] sm:max-w-[160px] truncate shrink-0" />
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
                    <div className="mt-1.5 rounded-md bg-muted/40 border border-border/30 px-2.5 py-1 text-xs text-foreground/85 leading-relaxed break-words line-clamp-2">
                      {task.description}
                    </div>
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
  );
}
