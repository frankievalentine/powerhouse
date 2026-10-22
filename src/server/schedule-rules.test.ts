import { describe, expect, test } from "bun:test";
import { isTimeZone, nextRunAt, parseTime } from "./schedule-rules";

const at = (iso: string) => Date.parse(iso);
const iso = (ms: number) => new Date(ms).toISOString();

describe("daily", () => {
  test("later today", () => {
    const next = nextRunAt({ kind: "daily", time: "09:00" }, "Europe/Berlin", at("2026-10-21T05:00:00Z"), 0);
    expect(iso(next)).toBe("2026-10-21T07:00:00.000Z");
  });

  test("tomorrow once today's time has passed, never the same instant", () => {
    const now = at("2026-10-21T07:00:00Z"); // exactly 09:00 in Berlin
    expect(iso(nextRunAt({ kind: "daily", time: "09:00" }, "Europe/Berlin", now, 0))).toBe("2026-10-22T07:00:00.000Z");
  });

  test("keeps 09:00 local across the autumn change (Berlin goes to UTC+1)", () => {
    const before = nextRunAt({ kind: "daily", time: "09:00" }, "Europe/Berlin", at("2026-10-24T12:00:00Z"), 0);
    const after = nextRunAt({ kind: "daily", time: "09:00" }, "Europe/Berlin", before, 0);
    expect(iso(before)).toBe("2026-10-25T08:00:00.000Z");
    expect(iso(after)).toBe("2026-10-26T08:00:00.000Z");
  });

  test("keeps 09:00 local across the spring change in New York", () => {
    const next = nextRunAt({ kind: "daily", time: "09:00" }, "America/New_York", at("2026-03-07T20:00:00Z"), 0);
    expect(iso(next)).toBe("2026-03-08T13:00:00.000Z");
    expect(iso(nextRunAt({ kind: "daily", time: "09:00" }, "America/New_York", next, 0))).toBe("2026-03-09T13:00:00.000Z");
  });

  test("a time skipped when clocks go forward runs an hour later", () => {
    // 02:30 does not exist in New York on 2026-03-08; 03:30 EDT is 07:30Z.
    const next = nextRunAt({ kind: "daily", time: "02:30" }, "America/New_York", at("2026-03-08T05:00:00Z"), 0);
    expect(iso(next)).toBe("2026-03-08T07:30:00.000Z");
  });

  test("a time repeated when clocks go back runs once", () => {
    const first = nextRunAt({ kind: "daily", time: "01:30" }, "America/New_York", at("2026-11-01T04:00:00Z"), 0);
    const following = nextRunAt({ kind: "daily", time: "01:30" }, "America/New_York", first, 0);
    expect(new Date(following).getUTCDate()).toBe(2);
    expect(following - first).toBeGreaterThan(20 * 3_600_000);
  });

  test("zones ahead of UTC roll the local date correctly", () => {
    // 23:00Z on the 21st is already the 22nd in Tokyo.
    const next = nextRunAt({ kind: "daily", time: "08:00" }, "Asia/Tokyo", at("2026-10-21T23:00:00Z"), 0);
    expect(iso(next)).toBe("2026-10-22T23:00:00.000Z");
  });
});

describe("weekdays and weekly", () => {
  test("Friday evening skips to Monday", () => {
    // 2026-10-23 is a Friday.
    const next = nextRunAt({ kind: "weekdays", time: "09:00" }, "UTC", at("2026-10-23T18:00:00Z"), 0);
    expect(iso(next)).toBe("2026-10-26T09:00:00.000Z");
  });

  test("weekly on chosen days", () => {
    const rule = { days: [1, 4], kind: "weekly", time: "10:15" } as const; // Monday, Thursday
    const first = nextRunAt({ ...rule, days: [...rule.days] }, "UTC", at("2026-10-21T12:00:00Z"), 0); // Wednesday
    expect(iso(first)).toBe("2026-10-22T10:15:00.000Z");
    expect(iso(nextRunAt({ ...rule, days: [...rule.days] }, "UTC", first, 0))).toBe("2026-10-26T10:15:00.000Z");
  });

  test("weekly a full week ahead when the only day is today and has passed", () => {
    const next = nextRunAt({ days: [3], kind: "weekly", time: "09:00" }, "UTC", at("2026-10-21T10:00:00Z"), 0);
    expect(iso(next)).toBe("2026-10-28T09:00:00.000Z");
  });
});

describe("hourly", () => {
  test("counts from the anchor, not from now", () => {
    const anchor = at("2026-10-21T10:20:00Z");
    expect(iso(nextRunAt({ every: 6, kind: "hourly" }, "UTC", at("2026-10-21T17:00:00Z"), anchor))).toBe(
      "2026-10-21T22:20:00.000Z",
    );
  });

  test("the first run is one period after the anchor", () => {
    const anchor = at("2026-10-21T10:20:00Z");
    expect(iso(nextRunAt({ every: 1, kind: "hourly" }, "UTC", anchor, anchor))).toBe("2026-10-21T11:20:00.000Z");
  });
});

describe("helpers", () => {
  test("parseTime", () => {
    expect(parseTime("00:00")).toEqual([0, 0]);
    expect(parseTime("23:59")).toEqual([23, 59]);
    expect(() => parseTime("24:00")).toThrow();
    expect(() => parseTime("9:00")).toThrow();
  });

  test("isTimeZone", () => {
    expect(isTimeZone("Europe/Berlin")).toBe(true);
    expect(isTimeZone("UTC")).toBe(true);
    expect(isTimeZone("Mars/Olympus")).toBe(false);
  });
});
