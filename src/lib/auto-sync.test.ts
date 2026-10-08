import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from "sonner";
import { __resetForTests, syncDayToSheet } from "./auto-sync";

const fetchMock = vi.fn();
const ID = "sheet-sync-2026-01-05";
const DAY = "2026-01-05";

const ok = (cells = 2, idempotent = false) =>
  new Response(
    JSON.stringify({
      status: "ok",
      changedCells: Array.from({ length: cells }, (_, i) => ({
        a1: `A${i}`,
        value: "x",
      })),
      idempotent,
    }),
    { status: 200 },
  );
const fail = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
  __resetForTests();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function settle<T>(p: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(10_000);
  return p;
}

describe("syncDayToSheet", () => {
  it("retries network errors twice then succeeds with caller message", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("net"))
      .mockRejectedValueOnce(new TypeError("net"))
      .mockResolvedValueOnce(ok(3));
    const res = await settle(
      syncDayToSheet(DAY, { successMessage: (n) => `custom ${n}` }),
    );
    expect(res?.changedCells).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(toast.error).not.toHaveBeenCalled();
    const [msg, opts] = vi.mocked(toast.success).mock.calls[0];
    expect(msg).toBe("custom 3");
    expect(opts).toMatchObject({ id: ID });
    expect(opts).toHaveProperty("action", undefined);
  });

  it("shows connection toast with Retry after three network errors", async () => {
    fetchMock.mockRejectedValue(new TypeError("net"));
    const res = await settle(syncDayToSheet(DAY));
    expect(res).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [msg, opts] = vi.mocked(toast.error).mock.calls[0];
    expect(msg).toBe("Couldn't sync to Google Sheet — check your connection");
    expect(opts).toMatchObject({ id: ID, action: { label: "Retry" } });
  });

  it("does not retry not_configured; toasts without auto", async () => {
    fetchMock.mockImplementation(async () =>
      fail(400, { error: "No spreadsheet configured", code: "not_configured" }),
    );
    const res = await settle(syncDayToSheet(DAY));
    expect(res).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [msg, opts] = vi.mocked(toast.error).mock.calls[0];
    expect(msg).toBe("No spreadsheet configured");
    expect(opts).toHaveProperty("id", ID);
    expect(opts).toHaveProperty("action", undefined);
  });

  it("silences not_configured with auto", async () => {
    fetchMock.mockImplementation(async () =>
      fail(400, { error: "No spreadsheet configured", code: "not_configured" }),
    );
    const res = await settle(syncDayToSheet(DAY, { auto: true }));
    expect(res).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("does not silence other 400s with auto", async () => {
    fetchMock.mockImplementation(async () =>
      fail(400, { error: "Date row not found" }),
    );
    await settle(syncDayToSheet(DAY, { auto: true }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [msg, opts] = vi.mocked(toast.error).mock.calls[0];
    expect(msg).toBe("Date row not found");
    expect(opts).toHaveProperty("action", undefined);
  });

  it("retries a 502 once then succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(fail(502, { error: "Bad gateway" }))
      .mockResolvedValueOnce(ok());
    const res = await settle(syncDayToSheet(DAY));
    expect(res).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(toast.error).not.toHaveBeenCalled();
    expect(vi.mocked(toast.success).mock.calls[0][1]).toHaveProperty(
      "action",
      undefined,
    );
  });

  it("shows error with Retry after two 502s", async () => {
    fetchMock.mockImplementation(async () => fail(502, { error: "Bad gateway" }));
    const res = await settle(syncDayToSheet(DAY));
    expect(res).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [msg, opts] = vi.mocked(toast.error).mock.calls[0];
    expect(msg).toBe("Bad gateway");
    expect(opts).toMatchObject({ id: ID, action: { label: "Retry" } });
  });

  it("stays silent on 401 without retrying", async () => {
    fetchMock.mockImplementation(async () => fail(401, { error: "nope" }));
    const res = await settle(syncDayToSheet(DAY));
    expect(res).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("treats per-attempt timeout as a network error", async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason),
          );
        }),
    );
    const p = syncDayToSheet(DAY);
    await vi.advanceTimersByTimeAsync(45_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000 + 45_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(3000 + 45_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(await p).toBeNull();
    const [msg, opts] = vi.mocked(toast.error).mock.calls[0];
    expect(msg).toBe("Couldn't sync to Google Sheet — check your connection");
    expect(opts).toMatchObject({ action: { label: "Retry" } });
  });

  it("toasts already up to date only with notifyIdempotent", async () => {
    fetchMock.mockImplementation(async () => ok(0, true));
    await settle(syncDayToSheet(DAY));
    expect(toast.success).not.toHaveBeenCalled();
    await settle(syncDayToSheet(DAY, { notifyIdempotent: true }));
    const [msg, opts] = vi.mocked(toast.success).mock.calls[0];
    expect(msg).toBe("Google Sheet already up to date");
    expect(opts).toMatchObject({ id: ID });
    expect(opts).toHaveProperty("action", undefined);
  });

  it("coalesces concurrent calls into running + one follow-up", async () => {
    fetchMock.mockImplementation(async () => ok(1));
    const p1 = syncDayToSheet(DAY, { successMessage: () => "first" });
    const p2 = syncDayToSheet(DAY, { successMessage: () => "second" });
    const p3 = syncDayToSheet(DAY, { successMessage: () => "third" });
    const [r1, r2, r3] = await settle(Promise.all([p1, p2, p3]));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(r2).toBe(r3);
    expect(r2).not.toBeNull();
    expect(r1).not.toBeNull();
    const msgs = vi.mocked(toast.success).mock.calls.map((c) => c[0]);
    expect(msgs).toEqual(["first", "third"]);

    // map cleaned up: a fresh call starts a new run immediately
    await settle(syncDayToSheet(DAY));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
