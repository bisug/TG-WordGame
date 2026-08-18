import { describe, expect, test } from "bun:test";
import {
  getDateStringFromDate,
  getGameDateStringForZone,
  toUtcMidnight,
} from "./game-day";

describe("getGameDateStringForZone", () => {
  test("returns same calendar day after 06:00 in zone", () => {
    // 2026-07-11 10:00 UTC == 15:45 in Asia/Kathmandu (+05:45)
    const date = new Date("2026-07-11T10:00:00Z");
    expect(getGameDateStringForZone(date, "Asia/Kathmandu")).toBe("2026-07-11");
  });

  test("rolls back to previous day before 06:00 in zone", () => {
    // 2026-07-11 00:00 UTC == 05:45 in Asia/Kathmandu -> before 06:00
    const date = new Date("2026-07-11T00:00:00Z");
    expect(getGameDateStringForZone(date, "Asia/Kathmandu")).toBe("2026-07-10");
  });

  test("exactly 06:00 belongs to the new game day", () => {
    // 06:00 in Asia/Kathmandu (+05:45) == 00:15 UTC
    const date = new Date("2026-07-11T00:15:00Z");
    expect(getGameDateStringForZone(date, "Asia/Kathmandu")).toBe("2026-07-11");
  });

  test("05:59 belongs to the previous game day", () => {
    // 05:59 in Asia/Kathmandu == 00:14 UTC
    const date = new Date("2026-07-11T00:14:00Z");
    expect(getGameDateStringForZone(date, "Asia/Kathmandu")).toBe("2026-07-10");
  });

  test("handles month boundary rollback", () => {
    // 2026-08-01 03:00 in Asia/Kathmandu -> before 06:00 -> 2026-07-31
    const date = new Date("2026-07-31T21:15:00Z");
    expect(getGameDateStringForZone(date, "Asia/Kathmandu")).toBe("2026-07-31");
  });

  test("works with UTC zone", () => {
    const date = new Date("2026-07-11T05:59:00Z");
    expect(getGameDateStringForZone(date, "UTC")).toBe("2026-07-10");
    const after = new Date("2026-07-11T06:00:00Z");
    expect(getGameDateStringForZone(after, "UTC")).toBe("2026-07-11");
  });

  test("handles year boundary rollback", () => {
    // 2027-01-01 02:00 in Asia/Kathmandu -> before 06:00 -> 2026-12-31
    const date = new Date("2026-12-31T20:15:00Z");
    expect(getGameDateStringForZone(date, "Asia/Kathmandu")).toBe("2026-12-31");
  });
});

describe("getDateStringFromDate", () => {
  test("zero-pads month and day", () => {
    expect(getDateStringFromDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("toUtcMidnight", () => {
  test("builds UTC midnight for a game-day string", () => {
    const d = toUtcMidnight("2026-07-11");
    expect(d.toISOString()).toBe("2026-07-11T00:00:00.000Z");
  });
});
