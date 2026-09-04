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
import type { TaskDTO } from "@/lib/types";

interface QuickStartProps {
  timeZone: string;
  refresh: () => void;
}

export function QuickStart({ refresh }: QuickStartProps) {
  const [favorites, setFavorites] = useState<TaskDTO[] | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<TaskDTO[]>("/api/tasks/recent")
      .then((recent) => {
        if (!cancelled) {
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
      className="flex flex-col gap-3"
    >
      <h2
        id="quick-start-heading"
        className="text-sm font-medium text-muted-foreground"
      >
        Quick start
      </h2>
      <div className="flex flex-wrap gap-2">
        {favorites.map((task, index) => (
          <button
            key={task.id}
            type="button"
            data-testid={`quick-start-task-${index}`}
            aria-label={`Start ${task.name}`}
            className="inline-flex h-11 items-center rounded-full border border-input px-4 text-sm text-muted-foreground outline-none transition-colors select-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
            disabled={startingId !== null}
            onClick={() => void handleStart(task)}
          >
            {startingId === task.id ? (
              <Loader2 aria-hidden className="mr-1.5 size-4 animate-spin" />
            ) : null}
            {task.name}
          </button>
        ))}
      </div>
    </section>
  );
}
