"use client";

import { useState } from "react";
import { ArrowUpDown, Eye, EyeOff, Search, SlidersHorizontal, Star, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { QuickFilter, SortOption } from "@/components/tasks/task-constants";
import { countActiveFilters } from "@/components/tasks/task-filters";
import type { CategoryDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TasksFilterBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  quickFilter: QuickFilter;
  setQuickFilter: (filter: QuickFilter) => void;
  sortBy: SortOption;
  setSortBy: (sort: SortOption) => void;
  hideDone: boolean;
  setHideDone: (hide: boolean) => void;
  selectedCategory: string;
  setSelectedCategory: (categoryId: string) => void;
  categories: CategoryDTO[];
}

type ControlProps = Omit<TasksFilterBarProps, "searchQuery" | "setSearchQuery">;

function QuickFilterPills({
  quickFilter,
  setQuickFilter,
  className,
}: Pick<ControlProps, "quickFilter" | "setQuickFilter"> & { className?: string }) {
  const pill = "px-2.5 py-1 text-xs font-medium rounded-md transition-colors select-none";
  return (
    <div
      className={cn("inline-flex rounded-lg border border-border/70 p-0.5 bg-muted/40", className)}
    >
      <button
        type="button"
        onClick={() => setQuickFilter("all")}
        className={cn(
          pill,
          quickFilter === "all"
            ? "bg-background text-foreground shadow-2xs font-semibold"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        All
      </button>
      <button
        type="button"
        onClick={() => setQuickFilter("due_today")}
        className={cn(
          pill,
          quickFilter === "due_today"
            ? "bg-background text-amber-700 dark:text-amber-300 shadow-2xs font-semibold"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Due Today
      </button>
      <button
        type="button"
        onClick={() => setQuickFilter("overdue")}
        className={cn(
          pill,
          quickFilter === "overdue"
            ? "bg-background text-rose-700 dark:text-rose-300 shadow-2xs font-semibold"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Overdue
      </button>
      <button
        type="button"
        onClick={() => setQuickFilter("favorites")}
        className={cn(
          "flex items-center gap-1",
          pill,
          quickFilter === "favorites"
            ? "bg-background text-amber-600 dark:text-amber-400 shadow-2xs font-semibold"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Star className="size-3 fill-amber-500 text-amber-500" />
        <span>Favorites</span>
      </button>
    </div>
  );
}

function CategorySelect({
  selectedCategory,
  setSelectedCategory,
  categories,
  className,
}: Pick<ControlProps, "selectedCategory" | "setSelectedCategory" | "categories"> & {
  className?: string;
}) {
  return (
    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
      <SelectTrigger
        className={cn("h-9 text-xs", className)}
        aria-label="Filter by category"
        data-testid="tasks-category-select"
      >
        <SelectValue placeholder="All categories" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All categories</SelectItem>
        {categories.map((cat) => (
          <SelectItem key={cat.id} value={cat.id}>
            {cat.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SortSelect({
  sortBy,
  setSortBy,
  className,
}: Pick<ControlProps, "sortBy" | "setSortBy"> & { className?: string }) {
  return (
    <Select value={sortBy} onValueChange={(val: SortOption) => setSortBy(val)}>
      <SelectTrigger className={cn("h-9 text-xs", className)} aria-label="Sort tasks">
        <ArrowUpDown className="size-3 mr-1 text-muted-foreground" />
        <SelectValue placeholder="Sort by" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="favorites">Favorites First</SelectItem>
        <SelectItem value="recent">Recently Used</SelectItem>
        <SelectItem value="priority">Priority</SelectItem>
        <SelectItem value="name">Alphabetical (A–Z)</SelectItem>
        <SelectItem value="created">Newest Created</SelectItem>
      </SelectContent>
    </Select>
  );
}

function HideDoneToggle({
  hideDone,
  setHideDone,
  className,
}: Pick<ControlProps, "hideDone" | "setHideDone"> & { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => setHideDone(!hideDone)}
      aria-pressed={hideDone}
      className={cn(
        "flex items-center gap-1.5 px-2.5 h-9 rounded-lg border text-xs font-medium transition-all select-none cursor-pointer",
        hideDone
          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold"
          : "border-border/70 hover:border-border text-muted-foreground hover:text-foreground bg-card/60",
        className,
      )}
      title="Hide completed tasks"
    >
      {hideDone ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      <span>{hideDone ? "Done Hidden" : "Hide Done"}</span>
    </button>
  );
}

export function TasksFilterBar({
  searchQuery,
  setSearchQuery,
  quickFilter,
  setQuickFilter,
  sortBy,
  setSortBy,
  hideDone,
  setHideDone,
  selectedCategory,
  setSelectedCategory,
  categories,
}: TasksFilterBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeCount = countActiveFilters({ quickFilter, sortBy, hideDone, selectedCategory });

  function clearFilters() {
    setQuickFilter("all");
    setSortBy("favorites");
    setHideDone(false);
    setSelectedCategory("all");
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Search Input */}
      <div className="relative flex-1 min-w-0 md:flex-none md:w-60">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 pr-7 text-xs h-9"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
            title="Clear search"
            aria-label="Clear search"
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      {/* Mobile: Filters button opens a bottom sheet */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setSheetOpen(true)}
        className="md:hidden h-9 gap-1.5 text-xs"
        data-testid="tasks-filters-button"
      >
        <SlidersHorizontal className="size-3.5" />
        Filters
        {activeCount > 0 && (
          <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {activeCount}
          </span>
        )}
      </Button>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" data-testid="tasks-filters-sheet" className="md:hidden">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 pb-2">
            <QuickFilterPills
              quickFilter={quickFilter}
              setQuickFilter={setQuickFilter}
              className="self-start flex-wrap"
            />
            <CategorySelect
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              categories={categories}
              className="w-full"
            />
            <SortSelect sortBy={sortBy} setSortBy={setSortBy} className="w-full" />
            <HideDoneToggle hideDone={hideDone} setHideDone={setHideDone} className="w-full" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              disabled={activeCount === 0}
              className="h-9 text-xs"
            >
              Clear filters
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop: single filter row */}
      <div className="hidden md:flex items-center gap-2 flex-wrap">
        <QuickFilterPills quickFilter={quickFilter} setQuickFilter={setQuickFilter} />
        <CategorySelect
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          categories={categories}
          className="w-[160px]"
        />
        <SortSelect sortBy={sortBy} setSortBy={setSortBy} className="w-[145px]" />
        <HideDoneToggle hideDone={hideDone} setHideDone={setHideDone} />
      </div>
    </div>
  );
}
