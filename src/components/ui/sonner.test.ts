import { describe, expect, it } from "vitest";
import React from "react";
import { Toaster } from "./sonner";

describe("Sonner Toaster configuration", () => {
  it("exports a valid React component", () => {
    expect(typeof Toaster).toBe("function");
  });

  it("can be instantiated without crashing", () => {
    const element = React.createElement(Toaster);
    expect(element).toBeDefined();
    expect(element.type).toBe(Toaster);
  });
});
