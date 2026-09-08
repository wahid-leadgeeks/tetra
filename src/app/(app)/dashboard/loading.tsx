import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-8 pb-12 animate-in fade-in-50 duration-200">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Dashboard
            </h1>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
              <Loader2 className="size-3 animate-spin text-primary" />
              <span>Loading progress…</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Daily, weekly, and monthly time tracking progress and official sheet targets.
          </p>
        </div>

        {/* Date control skeleton */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="flex gap-2 border-b border-border/80 pb-2">
        <Skeleton className="h-8 w-24 rounded-md" />
        <Skeleton className="h-8 w-20 rounded-md" />
        <Skeleton className="h-8 w-20 rounded-md" />
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="shadow-xs border-border/80">
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-36 mt-2" />
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <Skeleton className="h-2.5 w-full rounded-full" />
              <div className="flex justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table Skeleton */}
      <Card className="shadow-xs border-border/80">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-4 w-96 mt-1" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </CardContent>
      </Card>
    </div>
  );
}
