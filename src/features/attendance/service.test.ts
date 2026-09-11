import { beforeEach, describe, expect, it, vi } from "vitest";
import { autoClosePastAttendances, clockIn, updateAttendanceTimes } from "./service";

const { selectMock, updateMock, insertMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  updateMock: vi.fn(),
  insertMock: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  db: {
    select: selectMock,
    update: updateMock,
    insert: insertMock,
  },
}));

describe("Attendance autoClosePastAttendances", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("auto-closes past open attendance and updates status to closed", async () => {
    const pastAttendance = {
      id: "att-past",
      userId: "user-1",
      workDate: "2026-09-09",
      clockInAt: new Date("2026-09-09T02:49:00Z"),
      clockOutAt: null,
      status: "open",
    };

    // 1. pastOpen select
    selectMock.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([pastAttendance]),
      }),
    });

    // 2. update breakEntries
    updateMock.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    // 3. update timeEntries
    updateMock.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    // 4. select dayEntries
    selectMock.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          {
            startedAt: new Date("2026-09-09T03:00:00Z"),
            endedAt: new Date("2026-09-09T11:00:00Z"),
          },
        ]),
      }),
    });

    // 5. select dayBreaks
    selectMock.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    // 6. update dailyAttendance
    const updateDailyCaptured: { set?: unknown } = {};
    updateMock.mockReturnValueOnce({
      set: vi.fn().mockImplementation((val) => {
        updateDailyCaptured.set = val;
        return {
          where: vi.fn().mockResolvedValue([]),
        };
      }),
    });

    await autoClosePastAttendances("user-1", "Asia/Jakarta");

    expect(updateDailyCaptured.set).toMatchObject({
      status: "closed",
      clockOutAt: new Date("2026-09-09T11:00:00Z"),
    });
  });

  it("clockIn auto-closes past open shifts before checking today conflict", async () => {
    // 1. pastOpen select in autoClosePastAttendances (none in this case)
    selectMock.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    // 2. conflict check in clockIn (no conflict for today)
    selectMock.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    // 3. insert new dailyAttendance
    const createdRow = {
      id: "att-today",
      userId: "user-1",
      workDate: "2026-09-10",
      clockInAt: new Date("2026-09-10T02:00:00Z"),
      clockOutAt: null,
      status: "open",
    };
    insertMock.mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([createdRow]),
      }),
    });

    // 4. loadBreaks in refreshDTO
    selectMock.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    const result = await clockIn("user-1", "Asia/Jakarta");
    expect(result.id).toBe("att-today");
    expect(result.status).toBe("open");
  });

  it("updateAttendanceTimes closes open attendance and sets status to closed", async () => {
    const existing = {
      id: "att-1",
      userId: "user-1",
      workDate: "2026-09-11",
      clockInAt: new Date("2026-09-11T01:00:00Z"),
      clockOutAt: null,
      status: "open",
      reviewState: "draft",
    };

    // 1. select existing
    selectMock.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([existing]),
        }),
      }),
    });

    // 2. select dayEntries
    selectMock.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          {
            startedAt: new Date("2026-09-11T01:00:00Z"),
            endedAt: new Date("2026-09-11T10:05:00Z"),
          },
        ]),
      }),
    });

    // 3. select dayBreaks
    selectMock.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    // 4. update breakEntries (close open breaks)
    updateMock.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    // 5. update timeEntries (complete active tasks)
    updateMock.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    // 6. update dailyAttendance
    const updateCaptured: { set?: unknown } = {};
    updateMock.mockReturnValueOnce({
      set: vi.fn().mockImplementation((val) => {
        updateCaptured.set = val;
        return {
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                ...existing,
                clockOutAt: new Date("2026-09-11T10:05:00Z"),
                status: "closed",
                reviewState: "ready",
              },
            ]),
          }),
        };
      }),
    });

    // 7. loadBreaks in refreshDTO
    selectMock.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    const result = await updateAttendanceTimes("user-1", "2026-09-11", "Asia/Jakarta", {
      action: "clock_out",
    });

    expect(result.status).toBe("closed");
    expect(updateCaptured.set).toMatchObject({
      status: "closed",
      reviewState: "ready",
      clockOutAt: new Date("2026-09-11T10:05:00Z"),
    });
  });
});
