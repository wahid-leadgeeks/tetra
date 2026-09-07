import { cn } from "@/lib/utils";

interface TetraIconProps {
  className?: string;
  size?: number;
}

/**
 * TETRA Geometric Icon — 4-faceted tetrahedron emblem forming a stylized 'T'
 * with modern indigo, violet, and cyan gradients.
 */
export function TetraIcon({ className, size = 20 }: TetraIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="tetra-g-left" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
        <linearGradient id="tetra-g-right" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id="tetra-g-mid" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#4338ca" />
        </linearGradient>
        <linearGradient id="tetra-g-bottom" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="50%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#312e81" />
        </linearGradient>
      </defs>

      {/* Top Left wing facet */}
      <polygon
        points="16,6 4,13 13.5,15"
        fill="url(#tetra-g-left)"
        stroke="#4f46e5"
        strokeWidth="0.5"
      />

      {/* Top Right wing facet */}
      <polygon
        points="16,6 28,13 18.5,15"
        fill="url(#tetra-g-right)"
        stroke="#6366f1"
        strokeWidth="0.5"
      />

      {/* Top Center apex facet */}
      <polygon
        points="16,6 13.5,15 18.5,15"
        fill="url(#tetra-g-mid)"
      />

      {/* Bottom Faceted Diamond (T-stem) */}
      <polygon
        points="16,16 11,21.5 16,27.5 21,21.5"
        fill="url(#tetra-g-bottom)"
        stroke="#4f46e5"
        strokeWidth="0.5"
      />

      {/* Radiant inner highlights */}
      <line
        x1="16"
        y1="7"
        x2="16"
        y2="14.5"
        stroke="#e0e7ff"
        strokeWidth="0.75"
        strokeLinecap="round"
        opacity="0.8"
      />
      <line
        x1="16"
        y1="17"
        x2="16"
        y2="26"
        stroke="#a5f3fc"
        strokeWidth="0.75"
        strokeLinecap="round"
        opacity="0.9"
      />
    </svg>
  );
}
