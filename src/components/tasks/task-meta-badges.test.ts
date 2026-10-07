import { describe, expect, it } from "vitest";

import { dueBadgeInfo, PRIORITY_BADGES, STATUS_CHIPS } from "./task-meta-badges";

describe("task-meta-badges labels", () => {
  it("maps priorities to labels", () => {
    expect(PRIORITY_BADGES.urgent.label).toBe("Urgent");
    expect(PRIORITY_BADGES.high.label).toBe("High");
    expect(PRIORITY_BADGES.medium.label).toBe("Medium");
    expect(PRIORITY_BADGES.low.label).toBe("Low");
  });

  it("has status chips only for blocked, review and done", () => {
    expect(Object.keys(STATUS_CHIPS).sort()).toEqual(["blocked", "done", "review"]);
    expect(STATUS_CHIPS.review?.label).toBe("Review");
  });

  it("labels due dates", () => {
    const due = "2026-10-07T23:59:59Z";
    expect(dueBadgeInfo(due, "todo", "2026-10-07")).toEqual({ label: "Due today", tone: "today" });
    expect(dueBadgeInfo(due, "todo", "2026-10-08")).toEqual({
      label: "Overdue (10-07)",
      tone: "overdue",
    });
    expect(dueBadgeInfo(due, "done", "2026-10-08")).toEqual({
      label: "Due 10-07",
      tone: "upcoming",
    });
    expect(dueBadgeInfo(due, "todo", "2026-10-01")).toEqual({
      label: "Due 10-07",
      tone: "upcoming",
    });
  });
});
