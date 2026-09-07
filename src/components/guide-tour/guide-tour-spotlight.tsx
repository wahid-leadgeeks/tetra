"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Keyboard,
  Play,
  Sparkles,
  X,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SpotlightStep {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  route: string;
  selector: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  tips: string[];
}

export const SPOTLIGHT_STEPS: SpotlightStep[] = [
  {
    id: "today-hero",
    title: "Start Work & Active Timer",
    subtitle: "Today Screen",
    badge: "1. Work Tracking",
    route: "/",
    selector: '[data-tour="today-hero"]',
    icon: Play,
    description:
      "Clock in with one click or start any task directly — attendance opens automatically. The live stopwatch tracks elapsed time with zero drift, and you can switch or pause tasks instantly.",
    tips: [
      "Clock in or start tasks directly",
      "Live stopwatch with zero drift",
      "One-tap pause, resume & switch",
    ],
  },
  {
    id: "today-overview",
    title: "Real-Time Overview & Targets",
    subtitle: "Today Screen",
    badge: "2. Overview",
    route: "/",
    selector: '[data-tour="today-overview"]',
    icon: Sparkles,
    description:
      "See your total work time and breaks at a glance. Monitor progress toward the 8-hour daily target and see live category time distribution.",
    tips: [
      "Work and break KPI totals",
      "8-hour target progress bar",
      "Time distribution by category",
    ],
  },
  {
    id: "quick-start",
    title: "One-Tap Quick Start",
    subtitle: "Today Screen",
    badge: "3. Quick Start",
    route: "/",
    selector: '[data-tour="quick-start"]',
    icon: Zap,
    description:
      "Star your frequent activities on the Tasks page to turn them into one-tap Quick Start chips here. Switch between active tasks in a fraction of a second.",
    tips: [
      "One-tap task restart",
      "Preserves categories and names",
      "Manage favorites on Tasks page",
    ],
  },
  {
    id: "timeline",
    title: "Visual Timeline & Gap Detection",
    subtitle: "Timeline Page",
    badge: "4. Timeline",
    route: "/timeline",
    selector: '[data-tour="timeline-main"]',
    icon: Clock,
    description:
      "Review every activity and break chronologically. TETRA automatically detects unlogged gaps (>5 mins) and lets you backfill them with 1 click, or split existing activities.",
    tips: [
      "Chronological activity order",
      "Automatic unlogged gap detection",
      "1-click 'Fill gap' backfill & split",
    ],
  },
  {
    id: "review-sync",
    title: "Daily Review & Google Sheet Sync",
    subtitle: "Reports Page",
    badge: "5. Review & Sync",
    route: "/reports",
    selector: '[data-tour="review-sync"]',
    icon: FileSpreadsheet,
    description:
      "Verify daily totals and category breakdowns. Once reviewed, synchronize clean, validated rows directly into your company Google Sheet or export updated spreadsheets.",
    tips: [
      "Preview exact Sheet cells before writing",
      "Safe, idempotent write logic",
      "Supports file-only sync (.xlsx)",
    ],
  },
  {
    id: "sidebar-nav",
    title: "Lightning Keyboard Shortcuts",
    subtitle: "Pro Flow",
    badge: "6. Fast Navigation",
    route: "/",
    selector: '[data-tour="sidebar-nav"]',
    icon: Keyboard,
    description:
      "Track all day without ever reaching for your mouse! Keys 1–5 switch pages instantly, 's' starts or switches tasks, Space pauses/resumes, 'b' takes breaks, and '?' opens help.",
    tips: [
      "Keys 1–5 for instant tabs",
      "Space to pause, 'b' to break",
      "Press '?' anywhere for shortcut help",
    ],
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface GuideTourSpotlightProps {
  open: boolean;
  onClose: () => void;
}

export function GuideTourSpotlight({ open, onClose }: GuideTourSpotlightProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [targetFound, setTargetFound] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const step = SPOTLIGHT_STEPS[stepIndex] ?? SPOTLIGHT_STEPS[0]!;
  const StepIcon = step.icon;

  // Navigate to step's route if different from current
  useEffect(() => {
    if (!open) return;
    if (step.route && pathname !== step.route) {
      router.push(step.route);
    }
  }, [open, stepIndex, step.route, pathname, router]);

  // Find target element and measure bounding rect
  const updateTargetRect = useCallback(() => {
    if (!open) return;

    const el = document.querySelector(step.selector);
    if (!el) {
      setTargetFound(false);
      return;
    }

    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setTargetRect({
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
      setTargetFound(true);
    }
  }, [open, step.selector]);

  // Scroll into view & track target element
  useEffect(() => {
    if (!open) return;

    let timeoutId: NodeJS.Timeout;
    let attempts = 0;

    const findAndScroll = () => {
      const el = document.querySelector(step.selector);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        updateTargetRect();
      } else if (attempts < 20) {
        attempts += 1;
        timeoutId = setTimeout(findAndScroll, 100);
      } else {
        setTargetFound(false);
      }
    };

    timeoutId = setTimeout(findAndScroll, 150);

    return () => clearTimeout(timeoutId);
  }, [open, stepIndex, step.selector, pathname, updateTargetRect]);

  // Track on scroll and window resize with RAF
  useLayoutEffect(() => {
    if (!open) return;

    let rafId: number;
    const handleUpdate = () => {
      rafId = requestAnimationFrame(updateTargetRect);
    };

    window.addEventListener("scroll", handleUpdate, { passive: true });
    window.addEventListener("resize", handleUpdate, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", handleUpdate);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [open, updateTargetRect]);

  const handleNext = useCallback(() => {
    if (stepIndex < SPOTLIGHT_STEPS.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      onClose();
    }
  }, [stepIndex, onClose]);

  const handlePrev = useCallback(() => {
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1);
    }
  }, [stepIndex]);

  // Keyboard controls: ArrowRight/Enter -> next, ArrowLeft -> prev, Escape -> close
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, handleNext, handlePrev]);

  const handleJumpToStep = (index: number) => {
    setStepIndex(index);
  };

  // Compute popover card position relative to target spotlight
  const popoverStyle = useMemo(() => {
    if (typeof window === "undefined") return {};

    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const isMobile = winW < 768;

    if (isMobile) {
      return {
        bottom: 16,
        left: 16,
        right: 16,
      };
    }

    if (!targetRect || !targetFound) {
      return {
        top: Math.max(20, (winH - 420) / 2),
        left: Math.max(20, (winW - 480) / 2),
        width: 480,
      };
    }

    const popoverW = 480;
    const popoverH = 340;

    const spaceBelow = winH - (targetRect.top + targetRect.height + 24);
    const spaceAbove = targetRect.top - 24;

    let top: number;
    if (spaceBelow >= popoverH || spaceBelow >= spaceAbove) {
      top = Math.min(winH - popoverH - 24, targetRect.top + targetRect.height + 16);
    } else {
      top = Math.max(24, targetRect.top - popoverH - 16);
    }

    let left = targetRect.left;
    if (left + popoverW > winW - 24) {
      left = winW - popoverW - 24;
    }
    if (left < 24) {
      left = 24;
    }

    return {
      top,
      left,
      width: popoverW,
    };
  }, [targetRect, targetFound]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Guide Tour: Step ${stepIndex + 1} of ${SPOTLIGHT_STEPS.length} - ${step.title}`}
      className="fixed inset-0 z-50 overflow-hidden select-none"
    >
      {/* Dark backdrop cutout spotlight */}
      {targetFound && targetRect ? (
        <div
          aria-hidden
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
          }}
          className="fixed rounded-2xl pointer-events-none transition-all duration-300 ease-out border-2 border-primary shadow-[0_0_0_9999px_rgba(15,23,42,0.74),0_0_35px_rgba(99,102,241,0.5)] ring-4 ring-primary/30"
        />
      ) : (
        <div
          aria-hidden
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Floating Tour Popover Card */}
      <div
        ref={popoverRef}
        style={popoverStyle}
        className={cn(
          "fixed z-50 flex flex-col rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-2xl backdrop-blur-md transition-all duration-300 ease-out animate-in fade-in zoom-in-95",
        )}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <StepIcon className="size-4" />
            </span>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {step.badge}
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                {step.subtitle}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close guide tour"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content body */}
        <div className="flex flex-col gap-3 py-4">
          <h3 className="font-heading text-lg sm:text-xl font-bold tracking-tight text-foreground">
            {step.title}
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {step.description}
          </p>

          <div className="flex flex-col gap-1.5 pt-1">
            {step.tips.map((tip) => (
              <div key={tip} className="flex items-center gap-2 text-xs text-foreground">
                <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                <span>{tip}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/60">
          {/* Step dots */}
          <div className="flex items-center gap-1.5" aria-label="Tour progress">
            {SPOTLIGHT_STEPS.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleJumpToStep(idx)}
                aria-label={`Go to step ${idx + 1}: ${s.title}`}
                className={cn(
                  "size-2.5 rounded-full transition-all cursor-pointer",
                  idx === stepIndex
                    ? "w-6 bg-primary"
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/60",
                )}
              />
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handlePrev}
              disabled={stepIndex === 0}
              className="h-9 px-3 text-xs"
            >
              <ArrowLeft className="size-3.5 mr-1" />
              Back
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleNext}
              className="h-9 px-4 text-xs font-semibold shadow-xs"
            >
              {stepIndex === SPOTLIGHT_STEPS.length - 1 ? (
                "Finish Tour"
              ) : (
                <>
                  Next
                  <ArrowRight className="size-3.5 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
