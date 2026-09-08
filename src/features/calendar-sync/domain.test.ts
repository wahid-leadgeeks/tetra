import { describe, expect, it } from "vitest";
import { findOverlappingEntries, processCalendarEvent } from "./domain";
import { DEFAULT_CATEGORY_RULES, matchCategory } from "./rules";
import type { RawCalendarEvent } from "./google";
import type { TimeEntryDTO } from "@/lib/types";

describe("Calendar Category Rule Matching", () => {
  it("matches meeting keywords accurately", () => {
    expect(matchCategory("Daily Standup").categoryKey).toBe("meeting");
    expect(matchCategory("Team Sync & Planning").categoryKey).toBe("meeting");
    expect(matchCategory("1:1 with Manager").categoryKey).toBe("meeting");
    expect(matchCategory("Sprint Retrospective").categoryKey).toBe("meeting");
    expect(matchCategory("Client Call").categoryKey).toBe("meeting");
  });

  it("matches training keywords accurately", () => {
    expect(matchCategory("React 19 Workshop").categoryKey).toBe("training");
    expect(matchCategory("Security Awareness Training").categoryKey).toBe("training"); // training rule matches before security
    expect(matchCategory("Employee Onboarding").categoryKey).toBe("training");
    expect(matchCategory("TypeScript Tutorial").categoryKey).toBe("training");
  });

  it("matches research keywords accurately", () => {
    expect(matchCategory("PostgreSQL Performance Investigation").categoryKey).toBe("research");
    expect(matchCategory("AI Model Benchmarking Spike").categoryKey).toBe("research");
    expect(matchCategory("Competitive Analysis").categoryKey).toBe("research");
  });

  it("matches website management keywords accurately", () => {
    expect(matchCategory("Fix Landing Page Bug").categoryKey).toBe("website_management");
    expect(matchCategory("Employee Portal API Review").categoryKey).toBe("website_management");
    expect(matchCategory("Frontend UI Polish").categoryKey).toBe("website_management");
  });

  it("matches cyber security keywords accurately", () => {
    expect(matchCategory("Quarterly SOC Audit").categoryKey).toBe("cyber_security");
    expect(matchCategory("CVE Patching & Vulnerability Scan").categoryKey).toBe("cyber_security");
    expect(matchCategory("Pentest Verification").categoryKey).toBe("cyber_security");
  });

  it("matches technology innovation keywords accurately", () => {
    expect(matchCategory("n8n Automation Workflow").categoryKey).toBe("technology_innovation");
    expect(matchCategory("AI Chatbot Integration Optimization").categoryKey).toBe("technology_innovation");
  });

  it("matches infrastructure management keywords accurately", () => {
    expect(matchCategory("Docker Container Migration").categoryKey).toBe("infrastructure_management");
    expect(matchCategory("Kubernetes Cluster Deploy").categoryKey).toBe("infrastructure_management");
    expect(matchCategory("AWS Server Provisioning").categoryKey).toBe("infrastructure_management");
  });

  it("falls back to other_tasks for uncategorized events", () => {
    expect(matchCategory("Lunch with Dave").categoryKey).toBe("other_tasks");
    expect(matchCategory("Personal Appointment").categoryKey).toBe("other_tasks");
  });

  it("supports custom rules override", () => {
    const custom = [
      { categoryKey: "research", categoryName: "Research", keywords: ["custom_keyword"] },
    ];
    expect(matchCategory("Project custom_keyword demo", null, custom).categoryKey).toBe("research");
  });
});

describe("Calendar Overlap Detection", () => {
  const existingEntries = [
    {
      id: "entry-1",
      taskName: "Portal API",
      startedAt: new Date("2026-09-08T09:00:00Z"),
      endedAt: new Date("2026-09-08T10:00:00Z"),
    },
    {
      id: "entry-2",
      taskName: "Review PR",
      startedAt: new Date("2026-09-08T14:00:00Z"),
      endedAt: new Date("2026-09-08T15:30:00Z"),
    },
  ];

  it("detects when an event overlaps with an existing entry", () => {
    // Event: 09:30 - 10:30 (overlaps entry-1)
    const overlaps = findOverlappingEntries(
      new Date("2026-09-08T09:30:00Z"),
      new Date("2026-09-08T10:30:00Z"),
      existingEntries,
    );
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].id).toBe("entry-1");
  });

  it("does not report overlap when event is completely adjacent or outside", () => {
    // Event: 10:00 - 11:00 (exact adjacent, half-open does not overlap [09:00, 10:00))
    const overlaps = findOverlappingEntries(
      new Date("2026-09-08T10:00:00Z"),
      new Date("2026-09-08T11:00:00Z"),
      existingEntries,
    );
    expect(overlaps).toHaveLength(0);
  });
});

describe("Calendar Event Processing", () => {
  const existingDTOs: TimeEntryDTO[] = [
    {
      id: "e-1",
      taskId: "t-1",
      taskName: "Code Review",
      categoryId: "c-1",
      categoryKey: "website_management",
      categoryName: "Website Management",
      startedAt: "2026-09-08T02:00:00.000Z", // 09:00 Jakarta (UTC+7)
      endedAt: "2026-09-08T03:00:00.000Z",   // 10:00 Jakarta (UTC+7)
      status: "completed",
      notes: null,
      source: "manual",
      durationMinutes: 60,
      pausedSeconds: 0,
      pausedAt: null,
    },
  ];

  it("converts a timed Google Calendar event into a full suggestion DTO", () => {
    const raw: RawCalendarEvent = {
      id: "gcal-1",
      summary: "Daily Team Standup",
      description: "Discuss daily tasks",
      start: { dateTime: "2026-09-08T02:30:00.000Z" }, // 09:30 Jakarta
      end: { dateTime: "2026-09-08T03:00:00.000Z" },   // 10:00 Jakarta
    };

    const suggestion = processCalendarEvent(raw, existingDTOs, "Asia/Jakarta", DEFAULT_CATEGORY_RULES);
    expect(suggestion).not.toBeNull();
    expect(suggestion!.id).toBe("gcal-1");
    expect(suggestion!.title).toBe("Daily Team Standup");
    expect(suggestion!.suggestedCategoryKey).toBe("meeting");
    expect(suggestion!.durationMinutes).toBe(30);
    expect(suggestion!.formattedClock).toBe("09:30 – 10:00");
    expect(suggestion!.hasOverlap).toBe(true);
    expect(suggestion!.overlappingEntryIds).toContain("e-1");
    expect(suggestion!.overlappingTaskNames).toContain("Code Review");
  });

  it("handles all-day events correctly", () => {
    const raw: RawCalendarEvent = {
      id: "gcal-2",
      summary: "National Holiday",
      start: { date: "2026-09-08" },
      end: { date: "2026-09-09" },
    };

    const suggestion = processCalendarEvent(raw, existingDTOs, "Asia/Jakarta");
    expect(suggestion).not.toBeNull();
    expect(suggestion!.isAllDay).toBe(true);
    expect(suggestion!.formattedClock).toBe("All day");
    expect(suggestion!.hasOverlap).toBe(false);
  });
});
