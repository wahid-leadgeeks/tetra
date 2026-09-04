import { cn } from "@/lib/utils";

/**
 * Subtle keyboard-key badge (DESIGN.md: calm, strong typography).
 * Decorative by default — pair with `aria-hidden` when the shortcut
 * is documented elsewhere (e.g. the shortcuts dialog).
 */
export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 font-mono text-xs text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
