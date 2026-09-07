import * as React from "react";
import { cn } from "@/lib/utils";
import { getCategoryTheme } from "@/lib/categories";

export interface CategoryBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  categoryKey?: string | null;
  categoryName?: string | null;
  showIcon?: boolean;
  showDot?: boolean;
  size?: "sm" | "md";
}

export function CategoryBadge({
  categoryKey,
  categoryName,
  showIcon = false,
  showDot = true,
  size = "sm",
  className,
  ...props
}: CategoryBadgeProps) {
  const theme = getCategoryTheme(categoryKey ?? categoryName);
  const Icon = theme.icon;
  const displayName = categoryName || theme.name;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors select-none",
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-xs",
        theme.badgeClass,
        className,
      )}
      {...props}
    >
      {showDot && (
        <span
          aria-hidden
          className={cn(
            "rounded-full shrink-0",
            size === "sm" ? "size-1.5" : "size-2",
            theme.dotClass,
          )}
        />
      )}
      {showIcon && <Icon aria-hidden className="size-3 shrink-0" />}
      <span className="truncate">{displayName}</span>
    </span>
  );
}
