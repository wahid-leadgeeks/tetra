import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("Web App Manifest", () => {
  it("provides valid Progressive Web App manifest configuration", () => {
    const data = manifest();

    expect(data.name).toBe("TETRA — Employee Task & Time Tracking Companion");
    expect(data.short_name).toBe("TETRA");
    expect(data.display).toBe("standalone");
    expect(data.start_url).toBe("/");
    expect(data.background_color).toBe("#09090b");
    expect(data.theme_color).toBe("#18181b");
    expect(data.icons).toBeDefined();
    expect(Array.isArray(data.icons)).toBe(true);

    const iconSizes = data.icons?.map((icon) => icon.sizes);
    expect(iconSizes).toContain("192x192");
    expect(iconSizes).toContain("512x512");
  });

  it("contains navigation shortcuts for fast task tracking", () => {
    const data = manifest();

    expect(data.shortcuts).toBeDefined();
    expect(data.shortcuts?.length).toBeGreaterThanOrEqual(2);
    const urls = data.shortcuts?.map((s) => s.url);
    expect(urls).toContain("/timer");
    expect(urls).toContain("/timeline");
  });
});
