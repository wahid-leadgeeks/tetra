"use client";

/**
 * Quick start (DESIGN.md): one chip per favorite task on the Today screen.
 * A tap starts the timer immediately — the server stops any running task
 * first (switching semantics), so chips stay available while working.
 */
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { apiFetch } from "@/components/timeline/api";
import { getCategoryTheme } from "@/lib/categories";
import { cn } from "@/lib/utils";
import type { CategoryDTO, TaskDTO } from "@/lib/types";

interface QuickStartProps {
  timeZone: string;
  refresh: () => void;
}

export function QuickStart({ refresh }: QuickStartProps) {
  const [favorites, setFavorites] = useState<TaskDTO[] | null>(null);
  const [categoryKeys, setCategoryKeys] = useState<Record<string, string>>({});
  const [startingId, setStartingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch<TaskDTO[]>("/api/tasks/recent"),
      apiFetch<CategoryDTO[]>("/api/categories").catch(() => [] as CategoryDTO[]),
    ])
      .then(([recent, categories]) => {
        if (!cancelled) {
          const map: Record<string, string> = {};
          for (const c of categories) {
            map[c.id] = c.key;
          }
          setCategoryKeys(map);
          setFavorites(recent.filter((task) => task.isFavorite));
        }
      })
      .catch(() => {
        if (!cancelled) setFavorites([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start.");
    } finally {
      setStartingId(null);
    }
  }

  if (favorites === null || favorites.length === 0) return null;

  return (
    <section
      aria-labelledby="quick-start-heading"
      data-testid="quick-start"
      data-tour="quick-start"
      className="flex flex-col gap-3"
    >
      <h2
        id="quick-start-heading"
        className="text-sm font-medium text-muted-foreground"
      >
        Quick start
      </h2>
      <div className="flex flex-wrap gap-2">
        {favorites.map((task, index) => {
          const categoryKey = categoryKeys[task.categoryId];
          const theme = getCategoryTheme(categoryKey);
          return (
            <button
              key={task.id}
              type="button"
              data-testid={`quick-start-task-${index}`}
              aria-label={`Start ${task.name}`}
              className={cn(
                "inline-flex h-11 items-center rounded-full border border-input px-4 text-sm text-foreground outline-none transition-all select-none hover:bg-muted/80 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
                theme.hoverClass,
              )}
              disabled={startingId !== null}
              onClick={() => void handleStart(task)}
            >
              {startingId === task.id ? (
                <Loader2 aria-hidden className="mr-2 size-3.5 animate-spin" />
              ) : (
                <span
                  aria-hidden
                  className={cn("mr-2 size-2 rounded-full shrink-0", theme.dotClass)}
                />
              )}
              <span className="font-medium">{task.name}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
