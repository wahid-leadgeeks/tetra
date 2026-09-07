import { TetraIcon } from "@/components/ui/tetra-icon";
import { cn } from "@/lib/utils";

/**
 * TETRA wordmark — spaced caps with the faceted geometric emblem.
 * The single brand mark reused on the login card and the app sidebar.
 */
export function Wordmark({
  className,
  iconSize = 18,
}: {
  className?: string;
  iconSize?: number;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 font-bold tracking-[0.25em] text-foreground text-sm",
        className,
      )}
    >
      <TetraIcon size={iconSize} className="shadow-xs shadow-indigo-500/20" />
      TETRA
    </span>
  );
}
