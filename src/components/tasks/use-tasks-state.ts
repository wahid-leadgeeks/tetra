"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { COLUMNS } from "@/components/tasks/task-constants";
import { apiFetch } from "@/components/timeline/api";
import type { CategoryDTO, TaskDTO, TaskStatus } from "@/lib/types";

export function useTasksState() {
  const router = useRouter();

  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Task actions state
  const [startingId, setStartingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [allTasks, cats] = await Promise.all([
        apiFetch<TaskDTO[]>("/api/tasks"),
        apiFetch<CategoryDTO[]>("/api/categories").catch(() => [] as CategoryDTO[]),
      ]);
      setTasks(allTasks);
      setCategories(cats);
    } catch (err) {
      console.error("Failed to load tasks:", err);
      setError(err instanceof Error ? err.message : "Could not load tasks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const [allTasks, cats] = await Promise.all([
          apiFetch<TaskDTO[]>("/api/tasks"),
          apiFetch<CategoryDTO[]>("/api/categories").catch(() => [] as CategoryDTO[]),
        ]);
        if (cancelled) return;
        setTasks(allTasks);
        setCategories(cats);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load tasks:", err);
          setError(err instanceof Error ? err.message : "Could not load tasks.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  // One-tap start timer
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

      // If task was in todo, backlog, or blocked, move it to in_progress automatically
      if (task.status === "todo" || task.status === "backlog" || task.status === "blocked") {
        await handleMoveStatus(task.id, "in_progress", false);
      }

      toast.success(`Started tracking: ${task.name}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start timer.");
    } finally {
      setStartingId(null);
    }
  }

  // Toggle favorite flag
  async function handleToggleFavorite(task: TaskDTO) {
    const next = !task.isFavorite;
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, isFavorite: next } : t)),
    );
    try {
      await apiFetch<TaskDTO>(`/api/tasks/${task.id}/favorite`, {
        method: "PATCH",
        body: JSON.stringify({ isFavorite: next }),
      });
    } catch (err) {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, isFavorite: task.isFavorite } : t)),
      );
      toast.error(err instanceof Error ? err.message : "Could not update favorite.");
    }
  }

  // Move task status
  async function handleMoveStatus(
    taskId: string,
    newStatus: TaskStatus,
    showToast = true,
  ) {
    const prevTask = tasks.find((t) => t.id === taskId);
    if (!prevTask || prevTask.status === newStatus) return;

    const nowIso = new Date().toISOString();
    const isDone = newStatus === "done";
    const isInProgress = newStatus === "in_progress";

    // Optimistic update with completedAt and startedAt transitions
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          status: newStatus,
          completedAt: isDone ? nowIso : newStatus === "todo" || newStatus === "backlog" ? null : t.completedAt,
          startedAt: isInProgress && !t.startedAt ? nowIso : t.startedAt,
        };
      }),
    );

    try {
      await apiFetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: newStatus,
          completedAt: isDone ? nowIso : newStatus === "todo" || newStatus === "backlog" ? null : undefined,
          startedAt: isInProgress && !prevTask.startedAt ? nowIso : undefined,
        }),
      });
      if (showToast) {
        const colTitle = COLUMNS.find((c) => c.id === newStatus)?.title || newStatus;
        toast.success(`Moved to ${colTitle}`);
      }
    } catch {
      // Rollback
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? prevTask : t)),
      );
      toast.error("Failed to move task.");
    }
  }

  // Delete task
  async function handleDeleteTask(taskId: string) {
    if (!confirm("Are you sure you want to delete this task?")) return;

    const prevTasks = [...tasks];
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      await apiFetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
      });
      toast.success("Task deleted");
    } catch {
      setTasks(prevTasks);
      toast.error("Could not delete task.");
    }
  }

  return {
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
  };
}
