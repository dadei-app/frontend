const DEFAULT_FORMAT: Intl.DateTimeFormatOptions = {
  dateStyle: "medium",
  timeStyle: "short",
};

function parseUtcDate(utcIso: string): Date | null {
  const dt = new Date(utcIso);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function parseLocalInput(localString: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} | null {
  const raw = String(localString || "").trim();
  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] ?? "0"),
    minute: Number(match[5] ?? "0"),
    second: Number(match[6] ?? "0"),
  };
}

function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(instant);
  const get = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asUtcMs = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  return asUtcMs - instant.getTime();
}

export function formatForUser(
  utcIso: string,
  userTz: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const dt = parseUtcDate(utcIso);
  if (!dt) return utcIso;
  const resolvedOptions = options ?? DEFAULT_FORMAT;
  return new Intl.DateTimeFormat("en-US", {
    ...resolvedOptions,
    timeZone: userTz,
  }).format(dt);
}

export function parseUserInputToUtc(localString: string, userTz: string): string {
  const parsed = parseLocalInput(localString);
  if (!parsed) {
    throw new Error("Invalid local time input; expected YYYY-MM-DDTHH:mm[:ss].");
  }
  const wallClockMs = Date.UTC(
    parsed.year,
    parsed.month - 1,
    parsed.day,
    parsed.hour,
    parsed.minute,
    parsed.second
  );
  let utcMs = wallClockMs;
  for (let i = 0; i < 2; i += 1) {
    const offset = timeZoneOffsetMs(new Date(utcMs), userTz);
    utcMs = wallClockMs - offset;
  }
  return new Date(utcMs).toISOString();
}
