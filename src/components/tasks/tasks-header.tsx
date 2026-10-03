"use client";

import { AlignJustify, Kanban, LayoutGrid, List, Plus, Rows } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { CardDensity } from "@/components/tasks/task-constants";
import type { TaskStats } from "@/components/tasks/task-filters";
import type { TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const DENSITY_DISABLED_TIP = "Density only applies to Kanban view";

const DENSITY_OPTIONS = [
  { id: "comfortable", label: "Comfortable", tip: "Comfortable cards", Icon: Rows },
  { id: "compact", label: "Compact", tip: "Compact cards", Icon: AlignJustify },
] as const;

interface TasksHeaderProps {
  loading: boolean;
  stats: TaskStats;
  cardDensity: CardDensity;
  setCardDensity: (density: CardDensity) => void;
  viewMode: "kanban" | "list";
  setViewMode: (mode: "kanban" | "list") => void;
  handleOpenCreate: (columnId?: TaskStatus) => void;
}

export function TasksHeader({
  loading,
  stats,
  cardDensity,
  setCardDensity,
  viewMode,
  setViewMode,
  handleOpenCreate,
}: TasksHeaderProps) {
  const densityDisabled = viewMode === "list";

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
      <div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Tasks</h1>
          {!loading && (
            <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-muted/40 px-2.5 py-0.5 font-semibold text-foreground">
                {stats.total} Total
              </span>
              <span>•</span>
              <span className={cn(stats.backlog > 0 && "text-slate-700 dark:text-slate-300 font-medium")}>
                {stats.backlog} Backlog
              </span>
              <span>•</span>
              <span className={cn(stats.todo > 0 && "text-blue-700 dark:text-blue-300 font-medium")}>
                {stats.todo} To Do
              </span>
              <span>•</span>
              <span className={cn(stats.inProgress > 0 && "text-amber-700 dark:text-amber-300 font-medium")}>
                {stats.inProgress} In Progress
              </span>
              <span>•</span>
              <span className={cn(stats.blocked > 0 && "text-rose-700 dark:text-rose-300 font-medium")}>
                {stats.blocked} Blocked
              </span>
              <span>•</span>
              <span className={cn(stats.done > 0 && "text-emerald-700 dark:text-emerald-300 font-medium")}>
                {stats.done} Done
              </span>
            </div>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your work across your workflow.
        </p>
      </div>

      <div className="flex items-center gap-2.5 flex-wrap">
        {/* Card Density Toggle (md+) */}
        <div className="hidden md:flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Density</span>
          <div className="inline-flex rounded-lg border border-border/70 p-0.5 bg-muted/40">
            {DENSITY_OPTIONS.map(({ id, label, tip, Icon }) => (
              <Tooltip key={id}>
                <TooltipTrigger asChild>
                  <span className={cn(densityDisabled && "cursor-not-allowed")}>
                    <button
                      type="button"
                      onClick={() => setCardDensity(id)}
                      disabled={densityDisabled}
                      className={cn(
                        "p-1.5 rounded-md transition-colors disabled:pointer-events-none disabled:opacity-50",
                        cardDensity === id
                          ? "bg-background text-foreground shadow-2xs font-semibold"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      aria-label={`${label} card density`}
                      aria-pressed={cardDensity === id}
                    >
                      <Icon className="size-3.5" />
                    </button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{densityDisabled ? DENSITY_DISABLED_TIP : tip}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* View Mode Toggle (Kanban / List) (md+) */}
        <div className="hidden md:inline-flex rounded-lg border border-border/70 p-0.5 bg-muted/40">
          <button
            type="button"
            onClick={() => setViewMode("kanban")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
              viewMode === "kanban"
                ? "bg-background text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Kanban className="size-3.5" />
            <span>Kanban</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
              viewMode === "list"
                ? "bg-background text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <List className="size-3.5" />
            <span>List</span>
          </button>
        </div>

        {/* View menu (all widths) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs"
              data-testid="tasks-view-menu"
            >
              <LayoutGrid className="size-3.5" />
              View
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Layout</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={viewMode}
              onValueChange={(v) => setViewMode(v as "kanban" | "list")}
            >
              <DropdownMenuRadioItem value="kanban">Kanban</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="list">List</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Density</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={cardDensity}
              onValueChange={(v) => setCardDensity(v as CardDensity)}
            >
              <DropdownMenuRadioItem
                value="comfortable"
                disabled={densityDisabled}
                title={densityDisabled ? DENSITY_DISABLED_TIP : undefined}
              >
                Comfortable
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem
                value="compact"
                disabled={densityDisabled}
                title={densityDisabled ? DENSITY_DISABLED_TIP : undefined}
              >
                Compact
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          type="button"
          size="sm"
          onClick={() => handleOpenCreate("todo")}
          className="text-xs gap-1.5 h-9 font-medium shadow-xs"
        >
          <Plus className="size-4" />
          New Task
        </Button>
      </div>
    </div>
  );
}
