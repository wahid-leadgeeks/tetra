"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, Sparkles } from "lucide-react";

import { useTour } from "@/components/guide-tour/tour-provider";
import { NotificationMenu } from "@/components/notifications/notification-menu";
import { Wordmark } from "@/components/app-nav/wordmark";
import { NAV_ITEMS } from "@/components/app-nav/app-nav";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface HeaderNavProps {
  email: string;
  name: string;
  image?: string | null;
  timezone: string;
  hasGoogleAuth?: boolean;
}

export function HeaderNav({
  email,
  name,
  image,
  timezone,
  hasGoogleAuth = false,
}: HeaderNavProps) {
  const pathname = usePathname();
  const { openTour } = useTour();

  const currentItem =
    NAV_ITEMS.find((item) =>
      item.href === "/"
        ? pathname === "/"
        : pathname === item.href || pathname.startsWith(`${item.href}/`),
    ) ?? { label: pathname.startsWith("/settings") ? "Settings" : "TETRA", href: "/" };

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

      {/* Right side: Actions, Settings, Notifications & Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
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

        {/* Header Settings Link */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/settings"
              data-testid="header-settings-button"
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
              aria-label="Settings"
            >
              <Settings className="size-4" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="bottom">Settings</TooltipContent>
        </Tooltip>

        {/* Notifications Feature */}
        <NotificationMenu timezone={timezone} />

        {/* User profile with Popover Menu */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              data-testid="header-user-avatar"
              className="flex size-8 items-center justify-center rounded-full overflow-hidden border border-border/80 text-xs font-semibold text-primary select-none cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all bg-primary/10"
              aria-label="User Profile"
            >
              {image ? (
                <Image
                  src={image}
                  alt={name}
                  width={32}
                  height={32}
                  unoptimized
                  referrerPolicy="no-referrer"
                  className="size-full object-cover"
                />
              ) : (
                <span>{initials}</span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="end" className="w-68 p-3 shadow-lg border-border/80">
            <div className="flex items-center gap-3 pb-3 border-b border-border/60">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full overflow-hidden border border-border/80 text-sm font-semibold text-primary bg-primary/10">
                {image ? (
                  <Image
                    src={image}
                    alt={name}
                    width={40}
                    height={40}
                    unoptimized
                    referrerPolicy="no-referrer"
                    className="size-full object-cover"
                  />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-xs text-foreground truncate">{name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{email}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">
                    {timezone}
                  </span>
                  {hasGoogleAuth ? (
                    <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-medium">
                      Google
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="py-2 space-y-1">
              <Link
                href="/settings"
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-foreground hover:bg-muted/80 transition-colors"
              >
                <Settings className="size-4 text-muted-foreground" />
                <span>Settings</span>
              </Link>
              <button
                type="button"
                onClick={openTour}
                className="flex w-full items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-foreground hover:bg-muted/80 transition-colors text-left"
              >
                <Sparkles className="size-4 text-primary" />
                <span>Guide Tour</span>
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}
