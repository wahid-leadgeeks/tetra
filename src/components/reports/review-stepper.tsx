"use client";

/**
 * Review & Sync as a 3-step stepper:
 *   1. Resolve "Needs attention"  2. Mark reviewed  3. Preview, then Sync.
 * Exactly one filled (primary) button — the current step's main action.
 * Secondary sheet actions live in the header "More" menu.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import {
  Check,
  CloudUpload,
  Download,
  Ellipsis,
  Eye,
  FileSpreadsheet,
  LogOut,
  Upload,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  computeReviewStep,
  type ReviewStepNumber,
} from "@/components/reports/review-step";
import { isBlockingWarning } from "@/features/daily-summary/domain";
import type { DaySummaryDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ReviewStepperProps {
  summary: DaySummaryDTO;
  dayKey: string;
  marking: boolean;
  syncing: boolean;
  pulling: boolean;
  clockingOut: boolean;
  canMarkReviewed: boolean;
  onMarkReviewed: () => void;
  onPreview: () => void;
  onSync: () => void;
  onSyncUnreviewed: () => void;
  onPull: () => void;
  onFileSync: () => void;
  onQuickClockOut: () => void;
}

interface StepProps {
  step: ReviewStepNumber;
  title: string;
  done: boolean;
  current: boolean;
  children?: ReactNode;
  testId: string;
  isLast?: boolean;
}

function Step({ step, title, done, current, children, testId, isLast = false }: StepProps) {
  // Plain text status (never a Badge): e2e relies on the header badge being
  // the only `[data-slot="badge"]` containing "Reviewed".
  const status = done ? "Done" : current ? "Current step" : "Up next";
  return (
    <li
      className={cn("relative flex gap-3", !isLast && "pb-5")}
      aria-current={current ? "step" : undefined}
      data-testid={testId}
      data-state={done ? "done" : current ? "current" : "upcoming"}
    >
      {!isLast && (
        <span aria-hidden className="absolute left-3.5 top-8 bottom-0 w-px bg-border" />
      )}
      <span
        aria-hidden
        className={cn(
          "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums",
          done
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            : current
              ? "border-primary text-primary"
              : "border-border text-muted-foreground",
        )}
      >
        {done ? <Check className="size-3.5" /> : step}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
          <h3
            className={cn(
              "text-sm font-semibold",
              !current && !done && "text-muted-foreground",
            )}
          >
            <span className="sr-only">Step {step}: </span>
            {title}
          </h3>
          <span
            className={cn(
              "text-[11px] font-medium",
              done
                ? "text-emerald-700 dark:text-emerald-400"
                : current
                  ? "text-primary"
                  : "text-muted-foreground",
            )}
          >
            {status}
          </span>
        </div>
        {children}
      </div>
    </li>
  );
}

export function ReviewStepper({
  summary,
  dayKey,
  marking,
  syncing,
  pulling,
  clockingOut,
  canMarkReviewed,
  onMarkReviewed,
  onPreview,
  onSync,
  onSyncUnreviewed,
  onPull,
  onFileSync,
  onQuickClockOut,
}: ReviewStepperProps) {
  const { current, done } = computeReviewStep(summary);
  const warnings = summary.warnings;
  const hasMissingClockOut = warnings.some((w) => w.type === "missing_clock_out");

  return (
    <Card
      className="shadow-xs border-border/80"
      data-tour="review-sync"
      data-testid="review-stepper"
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Review &amp; Sync</CardTitle>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 text-muted-foreground hover:text-foreground"
                aria-label="More sync actions"
                data-testid="review-more-menu"
              >
                <Ellipsis aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              <DropdownMenuItem
                disabled={pulling}
                onSelect={() => onPull()}
                data-testid="pull-button"
                title="Read IN, OUT, breaks, categories & notes from Google Sheet for this day"
              >
                <Download aria-hidden />
                {pulling ? "Pulling…" : "Pull from Sheet"}
              </DropdownMenuItem>
              <DropdownMenuItem
                // Open the dialog only after the menu has closed so focus
                // management of the two layers does not collide.
                onSelect={() => {
                  window.setTimeout(onFileSync, 0);
                }}
                data-testid="sync-file-button"
                title="No Google account needed — upload the report file, get it back updated"
              >
                <FileSpreadsheet aria-hidden />
                Sync to file
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={syncing}
                onSelect={() => onSyncUnreviewed()}
                data-testid="sync-unreviewed-button"
                title="Sync this day to Google Sheet without marking it reviewed first"
              >
                <CloudUpload aria-hidden />
                {syncing ? "Syncing…" : "Sync now (unreviewed)"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col" aria-label="Review steps">
          <Step
            step={1}
            title="Resolve “Needs attention”"
            done={done[1]}
            current={current === 1}
            testId="review-step-1"
          >
            {warnings.length === 0 ? (
              <p className="text-xs text-muted-foreground">No issues found.</p>
            ) : (
              <div className="flex flex-col gap-2.5" data-testid="review-warnings">
                <ul className="grid gap-1.5">
                  {warnings.map((warning, index) => (
                    <li
                      key={`${warning.type}-${index}`}
                      className={cn(
                        "text-xs leading-relaxed",
                        isBlockingWarning(warning)
                          ? "text-muted-foreground"
                          : "text-muted-foreground/60",
                      )}
                    >
                      {warning.message}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    asChild
                    variant={current === 1 ? "default" : "outline"}
                    className="h-11 px-3 text-xs font-medium sm:h-9"
                  >
                    <Link href={`/timeline?date=${dayKey}`}>
                      <Wrench aria-hidden className="size-3.5" />
                      Fix issues on Timeline
                    </Link>
                  </Button>
                  {hasMissingClockOut && (
                    <Button
                      variant="outline"
                      className="h-11 px-3 text-xs font-medium cursor-pointer sm:h-9"
                      onClick={onQuickClockOut}
                      disabled={clockingOut}
                      data-testid="review-clockout-action"
                    >
                      <LogOut aria-hidden className="size-3.5" />
                      {clockingOut ? "Closing…" : "Clock out now"}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </Step>

          <Step
            step={2}
            title="Mark reviewed"
            done={done[2]}
            current={current === 2}
            testId="review-step-2"
          >
            <div>
              <Button
                variant={current === 2 ? "default" : "outline"}
                className="h-11 px-4 font-medium shadow-xs sm:h-9"
                onClick={onMarkReviewed}
                disabled={!canMarkReviewed || marking}
                title={canMarkReviewed ? undefined : "This day is already reviewed."}
                data-testid="review-submit"
              >
                {marking ? "Reviewing…" : "Mark reviewed"}
              </Button>
            </div>
          </Step>

          <Step
            step={3}
            title="Preview, then Sync to Sheet"
            done={done[3]}
            current={current === 3}
            testId="review-step-3"
            isLast
          >
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="h-11 px-4 font-medium shadow-xs sm:h-9"
                onClick={onPreview}
                data-testid="review-preview-button"
              >
                <Eye aria-hidden />
                Preview
              </Button>
              {/* Never gated by step: the server owns the review/config checks. */}
              <Button
                variant={current === 3 ? "default" : "outline"}
                className="h-11 px-4 font-medium shadow-xs sm:h-9"
                onClick={onSync}
                disabled={syncing}
                data-testid="sync-button"
              >
                <Upload aria-hidden />
                {syncing ? "Syncing…" : "Sync to Sheet"}
              </Button>
            </div>
          </Step>
        </ol>
      </CardContent>
    </Card>
  );
}
