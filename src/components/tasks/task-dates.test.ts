import { describe, expect, it } from "vitest";

import { zonedDayKey } from "@/lib/time";
import { dueDateKey, isDueToday, isOverdue } from "./task-dates";

describe("task-dates", () => {
  const dueAt = "2026-10-07T23:59:59Z";

  it("dueDateKey takes the date part", () => {
    expect(dueDateKey(dueAt)).toBe("2026-10-07");
  });

  it("is due today (not overdue) on the due date in UTC+7", () => {
    // 2026-10-07 20:00 UTC is 2026-10-08 03:00 in Jakarta; use an instant on the 7th locally.
    const today = zonedDayKey(new Date("2026-10-07T05:00:00Z"), "Asia/Jakarta");
    expect(today).toBe("2026-10-07");
    expect(isDueToday(dueAt, today)).toBe(true);
    expect(isOverdue(dueAt, "todo", today)).toBe(false);
  });

  it("is overdue the next day in UTC+7", () => {
    const today = zonedDayKey(new Date("2026-10-08T05:00:00Z"), "Asia/Jakarta");
    expect(today).toBe("2026-10-08");
    expect(isOverdue(dueAt, "todo", today)).toBe(true);
    expect(isDueToday(dueAt, today)).toBe(false);
  });

  it("never reports done/cancelled/no-due tasks as overdue", () => {
    expect(isOverdue(dueAt, "done", "2026-10-09")).toBe(false);
    expect(isOverdue(dueAt, "cancelled", "2026-10-09")).toBe(false);
    expect(isOverdue(null, "todo", "2026-10-09")).toBe(false);
  });
});
