"use client";

/**
 * Tasks — recently used tasks with one-tap Start. The list comes from the
 * server (recent-first); starting posts the timer and toasts the result.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { apiFetch } from "@/components/timeline/api";
import { formatDateTime } from "@/components/timeline/time";
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

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Tasks
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick up where you left off.
        </p>
      </header>

      <Separator className="my-6" />

      {loading ? (
        <div className="grid gap-3" aria-label="Loading tasks">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl bg-muted"
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
        <ul className="grid gap-3" data-testid="tasks-list">
          {tasks.map((task) => (
            <li key={task.id}>
              <Card size="sm" className="gap-0 px-4 py-4 sm:px-5">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-muted-foreground">
                      {categoryNames[task.categoryId] ?? "Uncategorized"}
                    </p>
                    <p className="truncate font-heading text-base font-medium">
                      {task.name}
                    </p>
                    {task.lastUsedAt && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Last used {formatDateTime(task.lastUsedAt, timeZone)}
                      </p>
                    )}
                  </div>
                  <Button
                    className="h-11 px-5"
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
          ))}
        </ul>
      )}
    </div>
  );
}
