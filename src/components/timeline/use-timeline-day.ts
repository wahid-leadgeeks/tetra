"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch } from "@/components/timeline/api";
import type { CategoryDTO, DaySummaryDTO } from "@/lib/types";

export function useTimelineDay(initialDay: string) {
  const router = useRouter();
  const [dayKey, setDayKey] = useState(initialDay);
  const [summary, setSummary] = useState<DaySummaryDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<DaySummaryDTO>(`/api/days/${dayKey}`)
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSummary(null);
        setError(err instanceof Error ? err.message : "Could not load the day.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dayKey, fetchKey]);

  useEffect(() => {
    let cancelled = false;
    apiFetch<CategoryDTO[]>("/api/categories")
      .then((data) => {
        if (!cancelled) setCategories(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setCategoriesError(
            err instanceof Error ? err.message : "Could not load categories.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleDayChange(nextDay: string) {
    setDayKey(nextDay);
    setLoading(true);
    setError(null);
  }

  function refresh() {
    setLoading(true);
    setError(null);
    setFetchKey((key) => key + 1);
    router.refresh();
  }

  return {
    dayKey,
    summary,
    loading,
    error,
    categories,
    categoriesError,
    handleDayChange,
    refresh,
  };
}
