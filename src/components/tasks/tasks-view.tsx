"use client";

/**
 * Tasks — recently used tasks with one-tap Start. The list comes from the
 * server (recent-first); starting posts the timer and toasts the result.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Star, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CategoryBadge } from "@/components/ui/category-badge";
import { Separator } from "@/components/ui/separator";
import { apiFetch } from "@/components/timeline/api";
import { formatDateTime } from "@/components/timeline/time";
import { getCategoryTheme } from "@/lib/categories";
import { cn } from "@/lib/utils";
import type { CategoryDTO, TaskDTO } from "@/lib/types";

interface TasksViewProps {
  timeZone: string;
}

export function TasksView({ timeZone }: TasksViewProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);
  const [startingId, setStartingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch<TaskDTO[]>("/api/tasks/recent"),
      apiFetch<CategoryDTO[]>("/api/categories").catch(
        () => [] as CategoryDTO[],
      ),
    ])
      .then(([recentTasks, categories]) => {
        if (cancelled) return;
        setTasks(recentTasks);
        const names: Record<string, string> = {};
        for (const category of categories) {
          names[category.id] = category.name;
        }
        setCategoryNames(names);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setTasks([]);
        setError(err instanceof Error ? err.message : "Could not load tasks.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchKey]);

  function handleRetry() {
    setLoading(true);
    setError(null);
    setFetchKey((key) => key + 1);
  }

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
      toast.success(`Started ${task.name}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start.");
    } finally {
      setStartingId(null);
    }
  }

  async function handleToggleFavorite(task: TaskDTO) {
    const next = !task.isFavorite;
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, isFavorite: next } : t)),
    );
    try {
      const updated = await apiFetch<TaskDTO>(
        `/api/tasks/${task.id}/favorite`,
        {
          method: "PATCH",
          body: JSON.stringify({ isFavorite: next }),
        },
      );
      setTasks((prev) =>
        prev.map((t) => (t.id === updated.id ? updated : t)),
      );
    } catch (err) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, isFavorite: task.isFavorite } : t,
        ),
      );
      toast.error(
        err instanceof Error ? err.message : "Could not update favorite.",
      );
    }
  }

  return (
    <div className="w-full">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Tasks
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick up where you left off with one-tap restart.
          </p>
        </div>
        {!loading && tasks.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/30 px-3 py-1 text-xs font-semibold text-foreground">
              {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
              <Star className="size-3 fill-amber-500 text-amber-500" />
              {tasks.filter((t) => t.isFavorite).length} favorites
            </span>
          </div>
        )}
      </header>

      <Separator className="my-6" />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" aria-label="Loading tasks">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl bg-muted"
              aria-hidden
            />
          ))}
        </div>
      ) : error ? (
        <Card className="items-start gap-3 p-6" data-testid="tasks-error">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TriangleAlert aria-hidden />
            <p>{error}</p>
          </div>
          <Button
            variant="outline"
            className="h-11 px-4"
            onClick={handleRetry}
          >
            Try again
          </Button>
        </Card>
      ) : tasks.length === 0 ? (
        <Card className="p-8 text-center sm:p-10" data-testid="tasks-list">
          <p className="font-heading text-base font-medium">
            No recent tasks yet
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Start tracking from the Today screen — tasks you use will show up
            here for one-tap restarts.
          </p>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="tasks-list">
          {tasks.map((task, index) => {
            const categoryName = categoryNames[task.categoryId] ?? "Uncategorized";
            const theme = getCategoryTheme(categoryName);
            return (
              <li key={task.id} className="h-full">
                <Card
                  size="sm"
                  className={cn(
                    "h-full flex flex-col justify-between gap-3 border-l-4 p-5 shadow-xs transition-colors",
                    theme.borderClass,
                    task.isFavorite && "border-amber-500/30 bg-amber-500/[0.02]",
                  )}
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="min-w-0 flex-1 flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <CategoryBadge
                          categoryName={categoryName}
                          size="sm"
                        />
                      </div>
                      <p className="truncate font-heading text-base font-semibold text-foreground">
                        {task.name}
                      </p>
                      {task.lastUsedAt && (
                        <p className="text-xs text-muted-foreground">
                          Last used {formatDateTime(task.lastUsedAt, timeZone)}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="size-11 shrink-0 text-muted-foreground hover:text-foreground"
                      data-testid={`favorite-toggle-${index}`}
                      aria-label={`Toggle favorite for ${task.name}`}
                      aria-pressed={task.isFavorite}
                      onClick={() => void handleToggleFavorite(task)}
                    >
                      <Star
                        aria-hidden
                        className={cn(
                          "size-4.5 transition-colors",
                          task.isFavorite
                            ? "fill-amber-500 text-amber-500"
                            : "hover:text-amber-500",
                        )}
                      />
                    </Button>
                    <Button
                      className="h-11 px-5 font-medium shadow-xs"
                      onClick={() => void handleStart(task)}
                      disabled={startingId !== null}
                      aria-label={`Start ${task.name}`}
                    >
                      <Play aria-hidden />
                      {startingId === task.id ? "Starting…" : "Start"}
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
