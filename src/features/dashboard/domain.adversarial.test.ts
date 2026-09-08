import { describe, expect, it } from "vitest";
import {
  calculateProgressPct,
  formatDiffMinutes,
  partitionMonthIntoWeekSlices,
} from "./domain";
import { monthRange } from "@/features/monthly-summary/domain";
import { addDaysISO, isWeekend } from "@/lib/time";

/* ========================================================================== */
/* Challenge 1: partitionMonthIntoWeekSlices Across 2026, 2027, 2028          */
/* ========================================================================== */
describe("Challenge 1: partitionMonthIntoWeekSlices Exhaustive Verification (2026, 2027, 2028)", () => {
  const years = [2026, 2027, 2028];

  for (const year of years) {
    describe(`Year ${year}${year === 2028 ? " (Leap Year)" : ""}`, () => {
      for (let month = 1; month <= 12; month++) {
        const monthKey = `${year}-${String(month).padStart(2, "0")}`;

        it(`correctly partitions ${monthKey} ensuring slices cover every day, workdays sum to month workdays, and targets sum to month target`, () => {
          const range = monthRange(`${monthKey}-01`);
          const slices = partitionMonthIntoWeekSlices(monthKey);

          expect(slices.length).toBeGreaterThanOrEqual(4);
          expect(slices.length).toBeLessThanOrEqual(6);

          // Independent ground truth calculation
          let expectedWorkdays = 0;
          const monthDays: string[] = [];
          for (let d = range.from; d <= range.to; d = addDaysISO(d, 1)) {
            monthDays.push(d);
            if (!isWeekend(d)) {
              expectedWorkdays++;
            }
          }
          const expectedTarget = expectedWorkdays * 480;

          // 1. Boundary bounds
          expect(slices[0]?.from).toBe(range.from);
          expect(slices[slices.length - 1]?.to).toBe(range.to);

          // 2. Sum of workdays and targets
          const sumWorkdays = slices.reduce((acc, s) => acc + s.workdaysCount, 0);
          const sumTargets = slices.reduce((acc, s) => acc + s.targetMinutes, 0);

          expect(sumWorkdays).toBe(expectedWorkdays);
          expect(sumTargets).toBe(expectedTarget);

          // 3. Continuity and integrity of each slice
          const coveredDays: string[] = [];
          slices.forEach((slice, idx) => {
            expect(slice.weekIndex).toBe(idx + 1);
            expect(slice.label).toBe(`WEEK ${idx + 1}`);
            expect(slice.targetMinutes).toBe(slice.workdaysCount * 480);

            // Verify slice date bounds
            expect(slice.from <= slice.to).toBe(true);

            // First slice starts on month start; subsequent slices start on Monday
            if (idx > 0) {
              const prevSlice = slices[idx - 1]!;
              expect(slice.from).toBe(addDaysISO(prevSlice.to, 1));
              const startDay = new Date(`${slice.from}T12:00:00Z`).getUTCDay();
              expect(startDay).toBe(1); // Monday
            }

            // Last slice ends on month end; prior slices end on Sunday
            if (idx < slices.length - 1) {
              const endDay = new Date(`${slice.to}T12:00:00Z`).getUTCDay();
              expect(endDay).toBe(0); // Sunday
            }

            // Count workdays in slice
            let sliceWorkdays = 0;
            for (let d = slice.from; d <= slice.to; d = addDaysISO(d, 1)) {
              coveredDays.push(d);
              if (!isWeekend(d)) {
                sliceWorkdays++;
              }
            }
            expect(slice.workdaysCount).toBe(sliceWorkdays);
          });

          // 4. Exact coverage of calendar days
          expect(coveredDays).toEqual(monthDays);
        });
      }
    });
  }

  it("handles object input { from, to } identically to string monthKey", () => {
    const fromStr = partitionMonthIntoWeekSlices("2026-09");
    const fromObj = partitionMonthIntoWeekSlices({ from: "2026-09-01", to: "2026-09-30" });
    expect(fromObj).toEqual(fromStr);
  });
});

/* ========================================================================== */
/* Challenge 2: formatDiffMinutes Extreme and Boundary Values                 */
/* ========================================================================== */
describe("Challenge 2: formatDiffMinutes Extreme and Boundary Values", () => {
  it("formats exact zero", () => {
    expect(formatDiffMinutes(0)).toEqual({
      formatted: "0:00",
      isAhead: false,
      isBehind: false,
      isExact: true,
    });
  });

  it("formats -0 cleanly as exact 0:00 without negative sign", () => {
    expect(formatDiffMinutes(-0)).toEqual({
      formatted: "0:00",
      isAhead: false,
      isBehind: false,
      isExact: true,
    });
  });

  it("formats sub-hour values correctly", () => {
    // 1 minute
    expect(formatDiffMinutes(1)).toEqual({
      formatted: "+0:01",
      isAhead: true,
      isBehind: false,
      isExact: false,
    });
    expect(formatDiffMinutes(-1)).toEqual({
      formatted: "-0:01",
      isAhead: false,
      isBehind: true,
      isExact: false,
    });

    // 59 minutes
    expect(formatDiffMinutes(59)).toEqual({
      formatted: "+0:59",
      isAhead: true,
      isBehind: false,
      isExact: false,
    });
    expect(formatDiffMinutes(-59)).toEqual({
      formatted: "-0:59",
      isAhead: false,
      isBehind: true,
      isExact: false,
    });
  });

  it("formats large positive values (hundreds and thousands of hours)", () => {
    // 100 hours
    expect(formatDiffMinutes(6000)).toEqual({
      formatted: "+100:00",
      isAhead: true,
      isBehind: false,
      isExact: false,
    });

    // 1,000 hours + 45 minutes
    expect(formatDiffMinutes(60045)).toEqual({
      formatted: "+1000:45",
      isAhead: true,
      isBehind: false,
      isExact: false,
    });

    // 10,000 hours
    expect(formatDiffMinutes(600000)).toEqual({
      formatted: "+10000:00",
      isAhead: true,
      isBehind: false,
      isExact: false,
    });
  });

  it("formats large negative values", () => {
    // -100 hours
    expect(formatDiffMinutes(-6000)).toEqual({
      formatted: "-100:00",
      isAhead: false,
      isBehind: true,
      isExact: false,
    });

    // -1,000 hours - 15 minutes
    expect(formatDiffMinutes(-60015)).toEqual({
      formatted: "-1000:15",
      isAhead: false,
      isBehind: true,
      isExact: false,
    });

    // -10,000 hours
    expect(formatDiffMinutes(-600000)).toEqual({
      formatted: "-10000:00",
      isAhead: false,
      isBehind: true,
      isExact: false,
    });
  });
});

/* ========================================================================== */
/* Challenge 3: calculateProgressPct Edge Cases & Stress Values              */
/* ========================================================================== */
describe("Challenge 3: calculateProgressPct Edge Cases and Robustness", () => {
  it("returns 0 for zero or negative work", () => {
    expect(calculateProgressPct(0, 480)).toBe(0);
    expect(calculateProgressPct(-1, 480)).toBe(0);
    expect(calculateProgressPct(-1000, 480)).toBe(0);
    expect(calculateProgressPct(-Infinity, 480)).toBe(0);
  });

  it("returns 100 when target is zero or negative and work is positive", () => {
    expect(calculateProgressPct(120, 0)).toBe(100);
    expect(calculateProgressPct(1, -10)).toBe(100);
    expect(calculateProgressPct(500, -500)).toBe(100);
  });

  it("returns 0 when both work and target are 0", () => {
    expect(calculateProgressPct(0, 0)).toBe(0);
  });

  it("clamps to [0, 100] when clamp: true is set", () => {
    // Under 100
    expect(calculateProgressPct(240, 480, { clamp: true })).toBe(50);
    // Exact 100
    expect(calculateProgressPct(480, 480, { clamp: true })).toBe(100);
    // Over 100
    expect(calculateProgressPct(600, 480, { clamp: true })).toBe(100);
    expect(calculateProgressPct(10000, 480, { clamp: true })).toBe(100);
    expect(calculateProgressPct(Infinity, 480, { clamp: true })).toBe(100);
    // Negative work
    expect(calculateProgressPct(-100, 480, { clamp: true })).toBe(0);
  });

  it("allows overflow beyond 100 when unclamped", () => {
    expect(calculateProgressPct(600, 480)).toBe(125);
    expect(calculateProgressPct(960, 480)).toBe(200);
    expect(calculateProgressPct(4800, 480)).toBe(1000);
  });

  it("handles extreme large values without crashing", () => {
    expect(calculateProgressPct(1e9, 1e9)).toBe(100);
    expect(calculateProgressPct(2e9, 1e9)).toBe(200);
    expect(calculateProgressPct(2e9, 1e9, { clamp: true })).toBe(100);
  });

  describe("Adversarial inputs: NaN and Infinity behavior", () => {
    it("evaluates NaN handling", () => {
      // If NaN is passed, what does calculateProgressPct do?
      const nanWork = calculateProgressPct(NaN, 480);
      const nanTarget = calculateProgressPct(480, NaN);
      // We document actual behavior for analysis
      expect(Number.isNaN(nanWork)).toBe(true);
      expect(Number.isNaN(nanTarget)).toBe(true);
    });

    it("evaluates Infinity handling", () => {
      expect(calculateProgressPct(Infinity, 480)).toBe(Infinity);
      expect(calculateProgressPct(Infinity, 480, { clamp: true })).toBe(100);
      expect(calculateProgressPct(480, Infinity)).toBe(0);
    });
  });
});
