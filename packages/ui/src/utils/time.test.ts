import { describe, expect, it } from "vitest";

import { formatForUser, parseUserInputToUtc } from "./time";

describe("time utils", () => {
  it("formats UTC timestamp for user timezone", () => {
    const result = formatForUser("2025-11-15T14:00:00Z", "America/Detroit", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    expect(result).toBe("09:00");
  });

  it("formats UTC timestamp in UTC timezone", () => {
    const result = formatForUser("2025-11-15T14:00:00Z", "UTC", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    expect(result).toBe("14:00");
  });

  it("formats timestamp for timezone different from system timezone", () => {
    const result = formatForUser("2025-11-15T14:00:00Z", "Asia/Tokyo", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    expect(result).toBe("23:00");
  });

  it("formats DST boundary correctly", () => {
    const result = formatForUser("2025-11-02T06:30:00Z", "America/New_York", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    expect(result).toBe("01:30");
  });

  it("parses user local input to UTC ISO", () => {
    const result = parseUserInputToUtc("2025-11-15T14:00", "America/Detroit");
    expect(result).toBe("2025-11-15T19:00:00.000Z");
  });

  it("parses DST local input to UTC ISO", () => {
    const result = parseUserInputToUtc("2025-03-09T03:30", "America/New_York");
    expect(result).toBe("2025-03-09T07:30:00.000Z");
  });
});
