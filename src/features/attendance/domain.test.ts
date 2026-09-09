import { describe, expect, it } from "vitest";
import {
  attendanceTotals,
  envelopeAttendanceSpan,
  hasBreakOverlap,
  isOpenBreak,
  toAttendanceDTO,
  toBreakDTO,
} from "./domain";
import type { BreakInput } from "./domain";

const NOW = new Date("2026-09-03T12:45:00Z");
const CLOCK_IN = new Date("2026-09-03T08:00:00Z");
const CLOCK_OUT = new Date("2026-09-03T17:00:00Z");

function closedBreak(id: string, startedAt: string, endedAt: string): BreakInput {
  return { id, startedAt: new Date(startedAt), endedAt: new Date(endedAt) };
}

function openBreak(id: string, startedAt: string): BreakInput {
  return { id, startedAt: new Date(startedAt), endedAt: null };
}

describe("attendanceTotals", () => {
  it("returns zeros for a fresh clock-in with no breaks", () => {
    expect(attendanceTotals({ clockInAt: NOW, clockOutAt: null }, [], NOW)).toEqual({
      attendanceMinutes: 0,
      breakMinutes: 0,
    });
  });

  it("counts attendance minutes up to now while still clocked in", () => {
    expect(attendanceTotals({ clockInAt: CLOCK_IN, clockOutAt: null }, [], NOW)).toEqual({
      attendanceMinutes: 285,
      breakMinutes: 0,
    });
  });

  it("freezes attendance at clock-out even when now is later", () => {
    const later = new Date("2026-09-03T23:00:00Z");
    expect(
      attendanceTotals({ clockInAt: CLOCK_IN, clockOutAt: CLOCK_OUT }, [], later),
    ).toEqual({ attendanceMinutes: 540, breakMinutes: 0 });
  });

  it("counts an open break until now", () => {
    const breaks = [openBreak("b1", "2026-09-03T12:00:00Z")];
    expect(attendanceTotals({ clockInAt: CLOCK_IN, clockOutAt: null }, breaks, NOW)).toEqual({
      attendanceMinutes: 285,
      breakMinutes: 45,
    });
  });

  it("sums one closed and one open break", () => {
    const breaks = [
      closedBreak("b1", "2026-09-03T10:00:00Z", "2026-09-03T10:30:00Z"),
      openBreak("b2", "2026-09-03T12:00:00Z"),
    ];
    expect(attendanceTotals({ clockInAt: CLOCK_IN, clockOutAt: null }, breaks, NOW)).toEqual({
      attendanceMinutes: 285,
      breakMinutes: 75,
    });
  });

  it("clamps a dangling open break to clock-out (a break cannot outlive the shift)", () => {
    const breaks = [openBreak("b1", "2026-09-03T12:00:00Z")];
    const later = new Date("2026-09-03T23:00:00Z");
    expect(
      attendanceTotals({ clockInAt: CLOCK_IN, clockOutAt: CLOCK_OUT }, breaks, later),
    ).toEqual({ attendanceMinutes: 540, breakMinutes: 300 });
  });

  it("truncates sub-minute spans to whole minutes", () => {
    expect(
      attendanceTotals(
        {
          clockInAt: new Date("2026-09-03T08:00:00Z"),
          clockOutAt: new Date("2026-09-03T08:01:30Z"),
        },
        [],
        NOW,
      ),
    ).toEqual({ attendanceMinutes: 1, breakMinutes: 0 });
  });
});

describe("isOpenBreak", () => {
  it("detects an open break among closed ones", () => {
    expect(
      isOpenBreak([
        closedBreak("b1", "2026-09-03T10:00:00Z", "2026-09-03T10:30:00Z"),
        openBreak("b2", "2026-09-03T12:00:00Z"),
      ]),
    ).toBe(true);
  });

  it("returns false when all breaks are closed or none exist", () => {
    expect(isOpenBreak([])).toBe(false);
    expect(
      isOpenBreak([closedBreak("b1", "2026-09-03T10:00:00Z", "2026-09-03T10:30:00Z")]),
    ).toBe(false);
  });
});

describe("toBreakDTO", () => {
  it("maps an open break with null end and null duration", () => {
    expect(toBreakDTO(openBreak("b1", "2026-09-03T12:00:00Z"))).toEqual({
      id: "b1",
      startedAt: "2026-09-03T12:00:00.000Z",
      endedAt: null,
      durationMinutes: null,
    });
  });

  it("maps a closed break with its computed duration", () => {
    expect(
      toBreakDTO(closedBreak("b1", "2026-09-03T10:00:00Z", "2026-09-03T10:30:00Z")),
    ).toEqual({
      id: "b1",
      startedAt: "2026-09-03T10:00:00.000Z",
      endedAt: "2026-09-03T10:30:00.000Z",
      durationMinutes: 30,
    });
  });
});

describe("toAttendanceDTO", () => {
  it("maps an open attendance with active break and start-sorted breaks", () => {
    const row = {
      id: "a1",
      workDate: "2026-09-03",
      clockInAt: CLOCK_IN,
      clockOutAt: null,
      status: "open" as const,
    };
    const breaks = [
      openBreak("b2", "2026-09-03T12:00:00Z"),
      closedBreak("b1", "2026-09-03T10:00:00Z", "2026-09-03T10:30:00Z"),
    ];
    const dto = toAttendanceDTO(row, breaks, NOW);

    expect(dto.id).toBe("a1");
    expect(dto.workDate).toBe("2026-09-03");
    expect(dto.clockInAt).toBe("2026-09-03T08:00:00.000Z");
    expect(dto.clockOutAt).toBeNull();
    expect(dto.status).toBe("open");
    expect(dto.breakMinutes).toBe(75);
    expect(dto.breaks.map((b) => b.id)).toEqual(["b1", "b2"]);
    expect(dto.activeBreak?.id).toBe("b2");
    expect(dto.breaks[1]?.durationMinutes).toBeNull();
  });

  it("maps a closed day with no active break", () => {
    const row = {
      id: "a1",
      workDate: "2026-09-03",
      clockInAt: CLOCK_IN,
      clockOutAt: CLOCK_OUT,
      status: "closed" as const,
    };
    const breaks = [closedBreak("b1", "2026-09-03T12:00:00Z", "2026-09-03T12:15:00Z")];
    const dto = toAttendanceDTO(row, breaks, NOW);

    expect(dto.status).toBe("closed");
    expect(dto.clockOutAt).toBe("2026-09-03T17:00:00.000Z");
    expect(dto.activeBreak).toBeNull();
    expect(dto.breakMinutes).toBe(15);
    expect(dto.breaks[0]?.durationMinutes).toBe(15);
  });
});

describe("hasBreakOverlap", () => {
  const existing = [
    closedBreak("b1", "2026-09-03T10:00:00Z", "2026-09-03T10:30:00Z"),
    closedBreak("b2", "2026-09-03T12:00:00Z", "2026-09-03T13:00:00Z"),
  ];

  it("returns false for non-overlapping candidate", () => {
    expect(
      hasBreakOverlap(
        {
          startedAt: new Date("2026-09-03T09:00:00Z"),
          endedAt: new Date("2026-09-03T09:30:00Z"),
        },
        existing,
      ),
    ).toBe(false);

    expect(
      hasBreakOverlap(
        {
          startedAt: new Date("2026-09-03T10:45:00Z"),
          endedAt: new Date("2026-09-03T11:15:00Z"),
        },
        existing,
      ),
    ).toBe(false);
  });

  it("returns false for adjacent break (touching boundaries)", () => {
    expect(
      hasBreakOverlap(
        {
          startedAt: new Date("2026-09-03T09:30:00Z"),
          endedAt: new Date("2026-09-03T10:00:00Z"),
        },
        existing,
      ),
    ).toBe(false);

    expect(
      hasBreakOverlap(
        {
          startedAt: new Date("2026-09-03T10:30:00Z"),
          endedAt: new Date("2026-09-03T11:00:00Z"),
        },
        existing,
      ),
    ).toBe(false);
  });

  it("returns true for partial overlaps", () => {
    // Starts before and ends inside b1
    expect(
      hasBreakOverlap(
        {
          startedAt: new Date("2026-09-03T09:45:00Z"),
          endedAt: new Date("2026-09-03T10:15:00Z"),
        },
        existing,
      ),
    ).toBe(true);

    // Starts inside b1 and ends after b1
    expect(
      hasBreakOverlap(
        {
          startedAt: new Date("2026-09-03T10:15:00Z"),
          endedAt: new Date("2026-09-03T10:45:00Z"),
        },
        existing,
      ),
    ).toBe(true);
  });

  it("returns true when candidate encloses existing break", () => {
    expect(
      hasBreakOverlap(
        {
          startedAt: new Date("2026-09-03T09:50:00Z"),
          endedAt: new Date("2026-09-03T10:40:00Z"),
        },
        existing,
      ),
    ).toBe(true);
  });

  it("returns true when candidate is enclosed by existing break", () => {
    expect(
      hasBreakOverlap(
        {
          startedAt: new Date("2026-09-03T10:05:00Z"),
          endedAt: new Date("2026-09-03T10:25:00Z"),
        },
        existing,
      ),
    ).toBe(true);
  });

  it("detects overlap with open break up to now", () => {
    const openList = [openBreak("b-open", "2026-09-03T14:00:00Z")];
    const testNow = new Date("2026-09-03T15:00:00Z");

    expect(
      hasBreakOverlap(
        {
          startedAt: new Date("2026-09-03T14:15:00Z"),
          endedAt: new Date("2026-09-03T14:45:00Z"),
        },
        openList,
        { now: testNow },
      ),
    ).toBe(true);

    // After now does not overlap
    expect(
      hasBreakOverlap(
        {
          startedAt: new Date("2026-09-03T15:05:00Z"),
          endedAt: new Date("2026-09-03T15:30:00Z"),
        },
        openList,
        { now: testNow },
      ),
    ).toBe(false);
  });

  it("respects excludeId option when updating an existing break", () => {
    expect(
      hasBreakOverlap(
        {
          startedAt: new Date("2026-09-03T10:05:00Z"),
          endedAt: new Date("2026-09-03T10:25:00Z"),
        },
        existing,
        { excludeId: "b1" },
      ),
    ).toBe(false);
  });
});

describe("envelopeAttendanceSpan", () => {
  const clockIn = new Date("2026-09-08T01:20:00Z"); // 08:20 local
  const clockOut = new Date("2026-09-08T10:00:00Z"); // 17:00 local
  const now = new Date("2026-09-08T12:00:00Z");

  it("leaves bounds unchanged when intervals are strictly inside", () => {
    const result = envelopeAttendanceSpan(
      { clockInAt: clockIn, clockOutAt: clockOut },
      [
        { startedAt: new Date("2026-09-08T02:00:00Z"), endedAt: new Date("2026-09-08T05:00:00Z") },
        { startedAt: new Date("2026-09-08T06:00:00Z"), endedAt: new Date("2026-09-08T09:00:00Z") },
      ],
      now,
    );
    expect(result.clockInAt).toEqual(clockIn);
    expect(result.clockOutAt).toEqual(clockOut);
    expect(result.expanded).toBe(false);
  });

  it("expands clockInAt earlier when an entry starts before clockIn", () => {
    const earlierStart = new Date("2026-09-08T01:00:00Z"); // 08:00 local
    const result = envelopeAttendanceSpan(
      { clockInAt: clockIn, clockOutAt: clockOut },
      [{ startedAt: earlierStart, endedAt: new Date("2026-09-08T05:00:00Z") }],
      now,
    );
    expect(result.clockInAt).toEqual(earlierStart);
    expect(result.clockOutAt).toEqual(clockOut);
    expect(result.expanded).toBe(true);
  });

  it("expands clockOutAt later when an entry ends after clockOut", () => {
    const laterEnd = new Date("2026-09-08T11:00:00Z"); // 18:00 local
    const result = envelopeAttendanceSpan(
      { clockInAt: clockIn, clockOutAt: clockOut },
      [{ startedAt: new Date("2026-09-08T10:00:00Z"), endedAt: laterEnd }],
      now,
    );
    expect(result.clockInAt).toEqual(clockIn);
    expect(result.clockOutAt).toEqual(laterEnd);
    expect(result.expanded).toBe(true);
  });

  it("expands both clockInAt and clockOutAt when intervals extend in both directions", () => {
    const earlierStart = new Date("2026-09-08T01:00:00Z"); // 08:00
    const laterEnd = new Date("2026-09-08T11:00:00Z"); // 18:00
    const result = envelopeAttendanceSpan(
      { clockInAt: clockIn, clockOutAt: clockOut },
      [
        { startedAt: earlierStart, endedAt: new Date("2026-09-08T05:00:00Z") },
        { startedAt: new Date("2026-09-08T10:00:00Z"), endedAt: laterEnd },
      ],
      now,
    );
    expect(result.clockInAt).toEqual(earlierStart);
    expect(result.clockOutAt).toEqual(laterEnd);
    expect(result.expanded).toBe(true);
  });

  it("leaves clockOutAt null when attendance is open but expands clockInAt if needed", () => {
    const earlierStart = new Date("2026-09-08T01:00:00Z");
    const result = envelopeAttendanceSpan(
      { clockInAt: clockIn, clockOutAt: null },
      [{ startedAt: earlierStart, endedAt: new Date("2026-09-08T05:00:00Z") }],
      now,
    );
    expect(result.clockInAt).toEqual(earlierStart);
    expect(result.clockOutAt).toBeNull();
    expect(result.expanded).toBe(true);
  });
});

