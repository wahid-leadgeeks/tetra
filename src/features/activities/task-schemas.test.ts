import { describe, expect, it } from "vitest";

import { updateTaskSchema } from "./task-schemas";

describe("updateTaskSchema", () => {
  it("leaves absent date fields undefined", () => {
    const parsed = updateTaskSchema.parse({});
    expect(parsed.startedAt).toBeUndefined();
    expect(parsed.dueAt).toBeUndefined();
    expect(parsed.completedAt).toBeUndefined();
  });

  it("treats explicit null as a clear", () => {
    expect(updateTaskSchema.parse({ startedAt: null }).startedAt).toBeNull();
  });

  it("parses ISO strings to Date", () => {
    const parsed = updateTaskSchema.parse({ startedAt: "2026-10-07T01:00:00Z" });
    expect(parsed.startedAt).toBeInstanceOf(Date);
  });
});
