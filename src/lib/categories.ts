import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  CheckSquare,
  Cpu,
  Globe,
  GraduationCap,
  Search,
  Server,
  ShieldAlert,
  Users,
} from "lucide-react";

export interface CategoryTheme {
  key: string;
  name: string;
  shortName: string;
  icon: LucideIcon;
  badgeClass: string;
  dotClass: string;
  borderClass: string;
  barColor: string;
  hoverClass: string;
  accentBg: string;
}

export const CATEGORY_THEMES: Record<string, CategoryTheme> = {
  website_management: {
    key: "website_management",
    name: "Website Management",
    shortName: "Website",
    icon: Globe,
    badgeClass:
      "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
    dotClass: "bg-emerald-500",
    borderClass: "border-l-emerald-500",
    barColor: "bg-emerald-500",
    hoverClass: "hover:border-emerald-400 hover:bg-emerald-500/5",
    accentBg: "bg-emerald-500/10",
  },
  cyber_security: {
    key: "cyber_security",
    name: "Cyber Security",
    shortName: "Security",
    icon: ShieldAlert,
    badgeClass:
      "bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/25",
    dotClass: "bg-rose-500",
    borderClass: "border-l-rose-500",
    barColor: "bg-rose-500",
    hoverClass: "hover:border-rose-400 hover:bg-rose-500/5",
    accentBg: "bg-rose-500/10",
  },
  technology_innovation: {
    key: "technology_innovation",
    name: "Technology Optimization & Innovation",
    shortName: "Tech & Innovation",
    icon: Cpu,
    badgeClass:
      "bg-violet-500/12 text-violet-700 dark:text-violet-300 border-violet-500/25",
    dotClass: "bg-violet-500",
    borderClass: "border-l-violet-500",
    barColor: "bg-violet-500",
    hoverClass: "hover:border-violet-400 hover:bg-violet-500/5",
    accentBg: "bg-violet-500/10",
  },
  infrastructure_management: {
    key: "infrastructure_management",
    name: "Infrastructure Management",
    shortName: "Infrastructure",
    icon: Server,
    badgeClass:
      "bg-blue-500/12 text-blue-700 dark:text-blue-300 border-blue-500/25",
    dotClass: "bg-blue-500",
    borderClass: "border-l-blue-500",
    barColor: "bg-blue-500",
    hoverClass: "hover:border-blue-400 hover:bg-blue-500/5",
    accentBg: "bg-blue-500/10",
  },
  research: {
    key: "research",
    name: "Research",
    shortName: "Research",
    icon: Search,
    badgeClass:
      "bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/25",
    dotClass: "bg-amber-500",
    borderClass: "border-l-amber-500",
    barColor: "bg-amber-500",
    hoverClass: "hover:border-amber-400 hover:bg-amber-500/5",
    accentBg: "bg-amber-500/10",
  },
  meeting: {
    key: "meeting",
    name: "Meeting",
    shortName: "Meeting",
    icon: Users,
    badgeClass:
      "bg-sky-500/12 text-sky-700 dark:text-sky-300 border-sky-500/25",
    dotClass: "bg-sky-500",
    borderClass: "border-l-sky-500",
    barColor: "bg-sky-500",
    hoverClass: "hover:border-sky-400 hover:bg-sky-500/5",
    accentBg: "bg-sky-500/10",
  },
  training: {
    key: "training",
    name: "Training",
    shortName: "Training",
    icon: GraduationCap,
    badgeClass:
      "bg-orange-500/12 text-orange-700 dark:text-orange-300 border-orange-500/25",
    dotClass: "bg-orange-500",
    borderClass: "border-l-orange-500",
    barColor: "bg-orange-500",
    hoverClass: "hover:border-orange-400 hover:bg-orange-500/5",
    accentBg: "bg-orange-500/10",
  },
  other_tasks: {
    key: "other_tasks",
    name: "Other Tasks",
    shortName: "Other",
    icon: CheckSquare,
    badgeClass:
      "bg-slate-500/12 text-slate-700 dark:text-slate-300 border-slate-500/25",
    dotClass: "bg-slate-400",
    borderClass: "border-l-slate-400",
    barColor: "bg-slate-400",
    hoverClass: "hover:border-slate-400 hover:bg-slate-500/5",
    accentBg: "bg-slate-500/10",
  },
};

export const CATEGORIES = Object.values(CATEGORY_THEMES).map((theme) => ({
  key: theme.key,
  name: theme.name,
}));

const DEFAULT_THEME: CategoryTheme = {
  key: "unknown",
  name: "General Task",
  shortName: "General",
  icon: Briefcase,
  badgeClass: "bg-primary/10 text-primary border-primary/20",
  dotClass: "bg-primary",
  borderClass: "border-l-primary",
  barColor: "bg-primary",
  hoverClass: "hover:border-primary/40",
  accentBg: "bg-primary/10",
};

/** Normalize category key or name into a key */
export function getCategoryTheme(
  keyOrName?: string | null,
): CategoryTheme {
  if (!keyOrName) return DEFAULT_THEME;
  const normalized = keyOrName.trim().toLowerCase().replace(/[\s&/-]+/g, "_");

  if (CATEGORY_THEMES[normalized]) {
    return CATEGORY_THEMES[normalized];
  }

  // Look up by matching name
  for (const theme of Object.values(CATEGORY_THEMES)) {
    if (
      theme.name.toLowerCase() === keyOrName.trim().toLowerCase() ||
      theme.shortName.toLowerCase() === keyOrName.trim().toLowerCase()
    ) {
      return theme;
    }
  }

  return DEFAULT_THEME;
}
