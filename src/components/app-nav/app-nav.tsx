"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  Clock,
  LayoutDashboard,
  ListTodo,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Kbd } from "@/components/keyboard/kbd";
import { useTour } from "@/components/guide-tour/tour-provider";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  testId: string;
  shortcut: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/",
    label: "Today",
    icon: CalendarDays,
    testId: "nav-today",
    shortcut: "1",
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    testId: "nav-dashboard",
    shortcut: "2",
  },
  {
    href: "/timeline",
    label: "Timeline",
    icon: Clock,
    testId: "nav-timeline",
    shortcut: "3",
  },
  {
    href: "/tasks",
    label: "Tasks",
    icon: ListTodo,
    testId: "nav-tasks",
    shortcut: "4",
  },
  {
    href: "/reports",
    label: "Reports",
    icon: BarChart3,
    testId: "nav-reports",
    shortcut: "5",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    testId: "nav-settings",
    shortcut: "6",
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop sidebar navigation (DESIGN.md: sidebar on desktop). */
export function SidebarNav() {
  const pathname = usePathname();
  const { openTour } = useTour();

  return (
    <nav aria-label="Primary" data-tour="sidebar-nav" className="flex flex-col gap-1 px-3">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            data-testid={item.testId}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium outline-none transition-all select-none focus-visible:ring-3 focus-visible:ring-ring/50",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon
              aria-hidden
              className={cn(
                "size-4.5 shrink-0 transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            />
            {item.label}
            <Kbd aria-hidden="true" className="ml-auto">
              {item.shortcut}
            </Kbd>
          </Link>
        );
      })}

      <div className="mt-3 pt-3 border-t border-sidebar-border/60">
        <button
          type="button"
          onClick={openTour}
          data-testid="sidebar-guide-tour"
          className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-xs font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer select-none"
        >
          <Sparkles aria-hidden className="size-4 text-primary shrink-0" />
          <span>Guide Tour</span>
        </button>
      </div>
    </nav>
  );
}

/** Mobile bottom navigation (DESIGN.md: bottom navigation on mobile). */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80 md:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-6 pb-[env(safe-area-inset-bottom)]">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 px-0.5 sm:px-1 text-[10px] sm:text-[11px] font-medium outline-none transition-colors select-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <item.icon
                  aria-hidden
                  className={cn("size-4.5 sm:size-5", active && "text-foreground")}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
