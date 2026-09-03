import { cn } from "@/lib/utils";

/**
 * TETRA wordmark — spaced caps with a small accent square.
 * The single brand mark reused on the login card and the app sidebar.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 font-semibold tracking-[0.3em] text-foreground",
        className,
      )}
    >
      <span
        aria-hidden
        className="inline-block size-2 shrink-0 rounded-[3px] bg-primary"
      />
      TETRA
    </span>
  );
}
