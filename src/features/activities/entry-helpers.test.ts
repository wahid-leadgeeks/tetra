import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ db: {} }));

import { entryDayKeys } from "./entry-helpers";

describe("entryDayKeys", () => {
  const NY = "America/New_York";

  it("returns one key for a same-day entry", () => {
    expect(
      entryDayKeys(new Date("2026-01-05T15:00:00Z"), new Date("2026-01-05T16:00:00Z"), NY),
    ).toEqual(["2026-01-05"]);
  });

  it("returns two keys for an entry crossing local midnight in America/New_York", () => {
    // 23:00 Jan 5 → 01:00 Jan 6 EST
    expect(
      entryDayKeys(new Date("2026-01-06T04:00:00Z"), new Date("2026-01-06T06:00:00Z"), NY),
    ).toEqual(["2026-01-05", "2026-01-06"]);
  });

  it("an entry ending exactly at local midnight stays on its start day", () => {
    expect(
      entryDayKeys(new Date("2026-01-06T03:00:00Z"), new Date("2026-01-06T05:00:00Z"), NY),
    ).toEqual(["2026-01-05"]);
  });

  it("an open entry (end === null) extends to now", () => {
    const now = new Date("2026-01-07T15:00:00Z");
    expect(entryDayKeys(new Date("2026-01-05T15:00:00Z"), null, NY, now)).toEqual([
      "2026-01-05",
      "2026-01-06",
      "2026-01-07",
    ]);
    // Open and started after `now` (clock skew) → only the start day.
    expect(entryDayKeys(new Date("2026-01-08T15:00:00Z"), null, NY, now)).toEqual(["2026-01-08"]);
  });

  it("a multi-day range returns every key, across a DST change", () => {
    // 2026-03-08 is the US spring-forward day.
    expect(
      entryDayKeys(new Date("2026-03-06T17:00:00Z"), new Date("2026-03-10T17:00:00Z"), NY),
    ).toEqual(["2026-03-06", "2026-03-07", "2026-03-08", "2026-03-09", "2026-03-10"]);
  });
});
