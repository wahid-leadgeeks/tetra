"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";

import { useTour } from "@/components/guide-tour/tour-provider";
import { NotificationMenu } from "@/components/notifications/notification-menu";
import { Wordmark } from "@/components/app-nav/wordmark";
import { NAV_ITEMS } from "@/components/app-nav/app-nav";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface HeaderNavProps {
  email: string;
  name: string;
  timezone: string;
}

export function HeaderNav({ email, name }: HeaderNavProps) {
  const pathname = usePathname();
  const { openTour } = useTour();

  const currentItem =
    NAV_ITEMS.find((item) =>
      item.href === "/"
        ? pathname === "/"
        : pathname === item.href || pathname.startsWith(`${item.href}/`),
    ) ?? { label: "TETRA", href: "/" };

  const initials = (name || email || "U")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header
      data-tour="header-nav"
      className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border/60 bg-background/80 px-4 sm:px-6 md:px-8 backdrop-blur-md select-none transition-colors"
    >
      {/* Left side: Context & Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="md:hidden">
          <Link href="/" className="flex items-center gap-2">
            <Wordmark />
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-2 text-sm">
          <Link
            href="/"
            className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            TETRA
          </Link>
          <span className="text-muted-foreground/50 text-xs">/</span>
          <span className="font-heading font-semibold text-foreground text-sm tracking-tight">
            {currentItem.label}
          </span>
        </div>
      </div>

      {/* Right side: Actions, Notifications & Profile */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={openTour}
              className="hidden sm:inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
            >
              <Sparkles className="size-3.5 text-primary" />
              <span>Tour</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Interactive app tour</TooltipContent>
        </Tooltip>

        {/* Notifications Feature */}
        <NotificationMenu />

        {/* User initials indicator */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              data-testid="header-user-avatar"
              className="flex size-8 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary select-none cursor-default"
            >
              {initials}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="font-medium text-xs">{name}</p>
            <p className="text-[11px] text-muted-foreground">{email}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
