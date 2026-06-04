const POPULAR_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const;

function tzLabel(tz: string): string {
  return tz.replace(/_/g, ' ');
}

/** Popular zones plus system + current selection (deduped). */
export function buildPopularTimezoneOptions(
  systemTz: string,
  selectedTz: string,
): Array<{ value: string; label: string }> {
  const ordered = new Set<string>([systemTz, selectedTz, ...POPULAR_TIMEZONES]);
  return [...ordered].map(value => ({
    value,
    label:
      value === systemTz
        ? `System — ${tzLabel(value)}`
        : value === selectedTz && value !== systemTz
          ? `${tzLabel(value)} (current)`
          : tzLabel(value),
  }));
}
