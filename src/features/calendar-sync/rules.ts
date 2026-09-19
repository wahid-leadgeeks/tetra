import type { CalendarRuleDTO } from "./types";

export const DEFAULT_CATEGORY_RULES: readonly CalendarRuleDTO[] = [
  {
    categoryKey: "meeting",
    categoryName: "Meeting",
    keywords: [
      "meeting",
      "standup",
      "sync",
      "catchup",
      "discussion",
      "huddle",
      "1:1",
      "one-on-one",
      "briefing",
      "retrospective",
      "demo",
      "call",
      "interview",
      "debrief",
      "smart goals",
      "goals",
      "planning",
      "session",
      "alignment",
      "business review",
      "quarterly review",
      "presentation",
      "townhall",
      "all-hands",
      "all hands",
    ],
  },
  {
    categoryKey: "training",
    categoryName: "Training",
    keywords: [
      "training",
      "course",
      "learning",
      "workshop",
      "webinar",
      "onboarding",
      "tutorial",
      "class",
      "certification",
      "study",
    ],
  },
  {
    categoryKey: "research",
    categoryName: "Research",
    keywords: [
      "research",
      "investigation",
      "analysis",
      "spike",
      "exploration",
      "benchmarking",
      "survey",
      "feasibility",
    ],
  },
  {
    categoryKey: "website_management",
    categoryName: "Website Management",
    keywords: [
      "website",
      "portal",
      "frontend",
      "backend",
      "api",
      "web",
      "cms",
      "ui",
      "ux",
      "landing page",
    ],
  },
  {
    categoryKey: "cyber_security",
    categoryName: "Cyber Security",
    keywords: [
      "security",
      "audit",
      "cyber",
      "vulnerability",
      "cve",
      "patching",
      "soc",
      "compliance",
      "pentest",
    ],
  },
  {
    categoryKey: "technology_innovation",
    categoryName: "Technology Optimization & Innovation",
    keywords: [
      "optimization",
      "automation",
      "n8n",
      "ai",
      "machine learning",
      "workflow",
      "innovation",
      "bot",
    ],
  },
  {
    categoryKey: "infrastructure_management",
    categoryName: "Infrastructure Management",
    keywords: [
      "infrastructure",
      "devops",
      "server",
      "docker",
      "deploy",
      "kubernetes",
      "aws",
      "cloud",
      "database",
      "postgres",
      "linux",
      "sysadmin",
    ],
  },
  {
    categoryKey: "other_tasks",
    categoryName: "Other Tasks",
    keywords: ["admin", "email", "ticket", "support", "misc", "general", "errand"],
  },
];

export interface MatchCategoryOptions {
  customRules?: readonly CalendarRuleDTO[] | null;
  hasMeetUrl?: boolean;
  guestCount?: number;
}

/**
 * Matches an event title & description against category rules using word boundary matching.
 * Also checks event heuristics (e.g. Google Meet link or multiple guests) before falling back.
 * Returns the matching category key and display name.
 */
export function matchCategory(
  title: string,
  description?: string | null,
  optionsOrCustomRules?: readonly CalendarRuleDTO[] | null | MatchCategoryOptions,
): { categoryKey: string; categoryName: string } {
  let customRules: readonly CalendarRuleDTO[] | null | undefined;
  let hasMeetUrl = false;
  let guestCount = 0;

  if (Array.isArray(optionsOrCustomRules)) {
    customRules = optionsOrCustomRules;
  } else if (optionsOrCustomRules) {
    const opts = optionsOrCustomRules as MatchCategoryOptions;
    customRules = opts.customRules;
    hasMeetUrl = !!opts.hasMeetUrl;
    guestCount = opts.guestCount ?? 0;
  }

  const rules = customRules && customRules.length > 0 ? customRules : DEFAULT_CATEGORY_RULES;
  const content = `${title} ${description ?? ""}`.toLowerCase();

  for (const rule of rules) {
    for (const kw of rule.keywords) {
      // Escape special characters in keyword for safe regex
      const escaped = kw.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
      const regex = new RegExp(`(^|[^a-zA-Z0-9])${escaped}([^a-zA-Z0-9]|$)`, "i");
      if (regex.test(content)) {
        return {
          categoryKey: rule.categoryKey,
          categoryName: rule.categoryName,
        };
      }
    }
  }

  // Heuristic: If event has a video meeting link or multiple guests and no specific tech category matched,
  // classify as Meeting rather than Other Tasks
  if (hasMeetUrl || guestCount > 1) {
    return {
      categoryKey: "meeting",
      categoryName: "Meeting",
    };
  }

  return {
    categoryKey: "other_tasks",
    categoryName: "Other Tasks",
  };
}
