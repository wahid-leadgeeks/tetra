import { describe, expect, it } from "vitest";
import {
  computeCategorySlices,
  getSlicePath,
} from "./category-pie-chart";

describe("CategoryPieChart slice calculation and SVG geometry", () => {
  describe("computeCategorySlices", () => {
    it("returns empty array if categories list is empty", () => {
      const slices = computeCategorySlices([], 120, 56, 88);
      expect(slices).toEqual([]);
    });

    it("returns empty array if totalMinutes is zero or negative", () => {
      const categories = [{ key: "client_work", name: "Client Work", minutes: 60 }];
      expect(computeCategorySlices(categories, 0, 56, 88)).toEqual([]);
      expect(computeCategorySlices(categories, -10, 56, 88)).toEqual([]);
    });

    it("filters out categories with 0 minutes", () => {
      const categories = [
        { key: "website_management", name: "Website Management", minutes: 60 },
        { key: "cyber_security", name: "Cyber Security", minutes: 0 },
        { key: "infrastructure", name: "Infrastructure", minutes: 0 },
      ];

      const slices = computeCategorySlices(categories, 60, 56, 88);
      expect(slices).toHaveLength(1);
      expect(slices[0].key).toBe("website_management");
      expect(slices[0].pct).toBe(100);
      expect(slices[0].colorHex).toBe("#10b981"); // emerald
    });

    it("computes slice percentages and colors for multi-category distribution", () => {
      const categories = [
        { key: "website_management", name: "Website Management", minutes: 240 },
        { key: "cyber_security", name: "Cyber Security", minutes: 120 },
        { key: "technology_innovation", name: "Technology Optimization & Innovation", minutes: 120 },
      ];

      const slices = computeCategorySlices(categories, 480, 56, 88);
      expect(slices).toHaveLength(3);

      expect(slices[0].key).toBe("website_management");
      expect(slices[0].pct).toBe(50);
      expect(slices[0].colorHex).toBe("#10b981");

      expect(slices[1].key).toBe("cyber_security");
      expect(slices[1].pct).toBe(25);
      expect(slices[1].colorHex).toBe("#f43f5e");

      expect(slices[2].key).toBe("technology_innovation");
      expect(slices[2].pct).toBe(25);
      expect(slices[2].colorHex).toBe("#8b5cf6");
    });

    it("handles custom or unknown categories by falling back to theme default", () => {
      const categories = [{ key: "custom_task", name: "Custom Task", minutes: 60 }];
      const slices = computeCategorySlices(categories, 60, 56, 88);
      expect(slices).toHaveLength(1);
      expect(slices[0].colorHex).toBe("#6366f1"); // indigo default
    });
  });

  describe("getSlicePath", () => {
    const cx = 100;
    const cy = 100;
    const rInner = 50;
    const rOuter = 80;

    it("generates a dual-arc donut path for 100% (full 2*PI circle) slice", () => {
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + Math.PI * 2;

      const path = getSlicePath(cx, cy, rInner, rOuter, startAngle, endAngle);

      expect(path).toContain("M 100 20");
      expect(path).toContain("A 80 80 0 1 1 100 180");
      expect(path).toContain("A 80 80 0 1 1 100 20");
      expect(path).toContain("M 100 50");
      expect(path).toContain("A 50 50 0 1 0 100 150");
      expect(path).toContain("A 50 50 0 1 0 100 50");
      expect(path.endsWith("Z")).toBe(true);
    });

    it("generates single arc donut sector with large-arc flag 0 for slice <= 180 degrees", () => {
      const startAngle = 0;
      const endAngle = Math.PI / 2; // 90 degrees

      const path = getSlicePath(cx, cy, rInner, rOuter, startAngle, endAngle);

      expect(path.startsWith("M ")).toBe(true);
      expect(path).toContain("A 80 80 0 0 1");
      expect(path).toContain("A 50 50 0 0 0");
      expect(path.endsWith("Z")).toBe(true);
    });

    it("generates single arc donut sector with large-arc flag 1 for slice > 180 degrees", () => {
      const startAngle = 0;
      const endAngle = Math.PI * 1.5; // 270 degrees

      const path = getSlicePath(cx, cy, rInner, rOuter, startAngle, endAngle);

      expect(path).toContain("A 80 80 0 1 1");
      expect(path).toContain("A 50 50 0 1 0");
      expect(path.endsWith("Z")).toBe(true);
    });
  });
});
