"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  Clock,
  ListTodo,
  Settings,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Kbd } from "@/components/keyboard/kbd";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  testId: string;
  shortcut: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/",
    label: "Today",
    icon: CalendarDays,
    testId: "nav-today",
    shortcut: "1",
  },
  {
    href: "/timeline",
    label: "Timeline",
    icon: Clock,
    testId: "nav-timeline",
    shortcut: "2",
  },
  {
    href: "/tasks",
    label: "Tasks",
    icon: ListTodo,
    testId: "nav-tasks",
    shortcut: "3",
  },
  {
    href: "/reports",
    label: "Reports",
    icon: BarChart3,
    testId: "nav-reports",
    shortcut: "4",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    testId: "nav-settings",
    shortcut: "5",
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop sidebar navigation (DESIGN.md: sidebar on desktop). */
export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex flex-col gap-1 px-3">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            data-testid={item.testId}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium outline-none transition-colors select-none focus-visible:ring-3 focus-visible:ring-ring/50",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon aria-hidden className="size-4.5 shrink-0" />
            {item.label}
            <Kbd aria-hidden="true" className="ml-auto">
              {item.shortcut}
            </Kbd>
          </Link>
        );
      })}
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
      <ul className="mx-auto grid max-w-lg grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium outline-none transition-colors select-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <item.icon
                  aria-hidden
                  className={cn("size-5", active && "text-foreground")}
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
