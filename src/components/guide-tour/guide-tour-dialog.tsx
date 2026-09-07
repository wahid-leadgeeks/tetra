"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  Command,
  FileSpreadsheet,
  Play,
  Scissors,
  Sparkles,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/keyboard/kbd";
import { cn } from "@/lib/utils";

interface GuideTourDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TourStep {
  title: string;
  subtitle: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  body: React.ReactNode;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to TETRA",
    subtitle: "Your effortless Google Sheet companion",
    badge: "Overview",
    icon: Sparkles,
    accentColor: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
    body: (
      <div className="flex flex-col gap-3 text-sm text-muted-foreground leading-relaxed">
        <p>
          The company Google Sheet is the official time tracking report, but filling
          it out cell-by-cell every day is tedious and prone to errors.
        </p>
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3.5 text-foreground flex flex-col gap-1.5">
          <p className="font-semibold text-xs tracking-wide uppercase text-indigo-600 dark:text-indigo-400">
            TETRA&apos;s Core Mission
          </p>
          <p className="text-sm">
            Record raw work with minimal friction during the day, calculate totals
            automatically, and synchronize clean, validated rows into your Google Sheet with a single click.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          No spreadsheet clones, no employee surveillance, no complex overhead.
        </p>
      </div>
    ),
  },
  {
    title: "Today Screen: Live Tracking",
    subtitle: "Clock in and track in seconds",
    badge: "Tracking",
    icon: Play,
    accentColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    body: (
      <div className="flex flex-col gap-3 text-sm text-muted-foreground leading-relaxed">
        <div className="grid gap-2.5">
          <div className="flex items-start gap-3 rounded-lg border border-border p-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 font-semibold text-xs">
              1
            </span>
            <div>
              <p className="font-medium text-foreground">Start Work or Task</p>
              <p className="text-xs">
                Clock in at the start of your day, or immediately start a task — attendance opens automatically.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-border p-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 font-semibold text-xs">
              2
            </span>
            <div>
              <p className="font-medium text-foreground">Live Timer & Quick Switch</p>
              <p className="text-xs">
                Pause, resume, or switch tasks on the fly. Star favorite tasks to launch them in one tap via Quick Start chips.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-border p-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 font-semibold text-xs">
              3
            </span>
            <div>
              <p className="font-medium text-foreground">Track Breaks Effortlessly</p>
              <p className="text-xs">
                Step away for lunch or coffee with one tap. Returning resumes your work seamlessly without losing progress.
              </p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "Timeline & Gap Detection",
    subtitle: "Review your day chronologically",
    badge: "Timeline",
    icon: Clock,
    accentColor: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
    body: (
      <div className="flex flex-col gap-3 text-sm text-muted-foreground leading-relaxed">
        <p>
          The Timeline visualizes every task and break in chronological order with distinct color-coded category badges.
        </p>
        <div className="grid gap-2 text-xs">
          <div className="flex items-center gap-2.5 rounded-lg border border-border p-2.5">
            <Zap className="size-4 text-amber-500 shrink-0" />
            <span>
              <strong className="text-foreground">Unlogged Gap Detection:</strong> If there&apos;s an untracked gap longer than 5 minutes, an inline <em>Fill Gap</em> button lets you backfill it instantly.
            </span>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg border border-border p-2.5">
            <Scissors className="size-4 text-violet-500 shrink-0" />
            <span>
              <strong className="text-foreground">Split & Edit:</strong> Did one block cover two activities? Click <em>Split</em> to divide it precisely.
            </span>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "Daily Review & Sheet Sync",
    subtitle: "Verify totals and sync safely",
    badge: "Reports & Sync",
    icon: FileSpreadsheet,
    accentColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    body: (
      <div className="flex flex-col gap-3 text-sm text-muted-foreground leading-relaxed">
        <p>
          Before anything touches your Google Sheet, TETRA compiles your full day into an auditable Daily Review:
        </p>
        <ul className="grid gap-1.5 text-xs">
          <li className="flex items-center gap-2">
            <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
            <span>Attendance hours, break duration, and active work totals.</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
            <span>Distribution bar across all 8 official work categories.</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
            <span>Zero-error guarantee: overlap detection and missing clock-out alerts.</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
            <span>
              <strong>Narrow writes:</strong> Only target cells are updated. Unrelated notes or coworker rows are never overwritten.
            </span>
          </li>
        </ul>
      </div>
    ),
  },
  {
    title: "Speed & Shortcuts",
    subtitle: "Power user workflow for maximum focus",
    badge: "Shortcuts",
    icon: Command,
    accentColor: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
    body: (
      <div className="flex flex-col gap-3 text-sm text-muted-foreground leading-relaxed">
        <p>Keep your hands on the keyboard and track without breaking focus:</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center justify-between rounded-lg border border-border p-2">
            <span className="text-foreground">Today</span>
            <Kbd>1</Kbd>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-2">
            <span className="text-foreground">Timeline</span>
            <Kbd>2</Kbd>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-2">
            <span className="text-foreground">Tasks</span>
            <Kbd>3</Kbd>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-2">
            <span className="text-foreground">Reports</span>
            <Kbd>4</Kbd>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-2">
            <span className="text-foreground">Start Task</span>
            <Kbd>s</Kbd>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-2">
            <span className="text-foreground">Pause / Resume</span>
            <Kbd>Space</Kbd>
          </div>
        </div>
        <p className="text-xs text-center text-muted-foreground pt-1">
          Press <Kbd>?</Kbd> anywhere in the app to view the complete shortcuts cheat sheet.
        </p>
      </div>
    ),
  },
];

export function GuideTourDialog({ open, onOpenChange }: GuideTourDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <TourDialogBody onClose={() => onOpenChange(false)} />}
    </Dialog>
  );
}

function TourDialogBody({ onClose }: { onClose: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const current = TOUR_STEPS[stepIndex] ?? TOUR_STEPS[0]!;
  const Icon = current.icon;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  function handleNext() {
    if (isLast) {
      onClose();
    } else {
      setStepIndex((i) => Math.min(TOUR_STEPS.length - 1, i + 1));
    }
  }

  function handleBack() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  return (
    <DialogContent className="max-w-md p-6 sm:max-w-lg">
        <DialogHeader className="gap-3">
          <div className="flex items-center justify-between">
            <div
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                current.accentColor,
              )}
            >
              <Icon className="size-3.5" />
              <span>{current.badge}</span>
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              Step {stepIndex + 1} of {TOUR_STEPS.length}
            </span>
          </div>
          <div>
            <DialogTitle className="text-xl font-bold tracking-tight">
              {current.title}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-0.5">
              {current.subtitle}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="py-2 min-h-[220px] flex flex-col justify-center">
          {current.body}
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 py-2" aria-hidden="true">
          {TOUR_STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStepIndex(i)}
              aria-label={`Go to step ${i + 1}`}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === stepIndex
                  ? "w-6 bg-primary"
                  : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50",
              )}
            />
          ))}
        </div>

        <DialogFooter className="flex-row items-center justify-between sm:justify-between gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-muted-foreground text-xs hover:text-foreground"
          >
            Skip Tour
          </Button>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleBack}
                className="h-9 px-3.5"
              >
                Back
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={handleNext}
              className="h-9 px-4 font-medium"
            >
              {isLast ? "Get Started" : "Next"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
  );
}
