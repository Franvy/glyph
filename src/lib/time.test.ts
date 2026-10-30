import { describe, expect, it } from "vitest";
import { describeOffset, formatClock, zoneOffsetMinutes } from "./time";

const noonUtc = new Date("2026-10-20T13:34:00Z");

describe("formatClock", () => {
  it("formats 24-hour time in the host zone", () => {
    expect(formatClock(noonUtc, "Asia/Shanghai")).toBe("21:34");
    expect(formatClock(new Date("2026-10-20T16:05:00Z"), "Asia/Shanghai")).toBe("00:05");
  });
});

describe("zoneOffsetMinutes", () => {
  it("reads fixed and half-hour zones", () => {
    expect(zoneOffsetMinutes("Asia/Shanghai", noonUtc)).toBe(480);
    expect(zoneOffsetMinutes("Asia/Kolkata", noonUtc)).toBe(330);
    expect(zoneOffsetMinutes("UTC", noonUtc)).toBe(0);
  });

  it("follows daylight saving", () => {
    expect(zoneOffsetMinutes("America/New_York", new Date("2026-07-01T12:00:00Z"))).toBe(-240);
    expect(zoneOffsetMinutes("America/New_York", new Date("2026-12-01T12:00:00Z"))).toBe(-300);
  });
});

describe("describeOffset", () => {
  it("says so when the visitor shares the host clock", () => {
    expect(describeOffset("Asia/Shanghai", noonUtc, 480)).toBe("same time as you");
  });

  it("is ahead of visitors to the west and behind those to the east", () => {
    expect(describeOffset("Asia/Shanghai", noonUtc, 120)).toBe("6h ahead");
    expect(describeOffset("Asia/Shanghai", noonUtc, 540)).toBe("1h behind");
  });

  it("keeps half hours", () => {
    expect(describeOffset("Asia/Shanghai", noonUtc, 150)).toBe("5.5h ahead");
  });
});
