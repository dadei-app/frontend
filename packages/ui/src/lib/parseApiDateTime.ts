/**
 * Parse API datetimes for display, sorting, and countdowns.
 * Strings without a timezone are treated as UTC (SQLAlchemy/FastAPI naive UTC).
 */
export function parseApiDateTime(iso: string | undefined | null): Date {
  if (iso == null || String(iso).trim() === '') {
    return new Date(NaN);
  }
  const s = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?$/.test(s)) {
    return new Date(`${s}Z`);
  }
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,9})?$/.test(s)) {
    return new Date(`${s.replace(' ', 'T')}Z`);
  }
  return new Date(s);
}

export function parseApiDateTimeMs(iso: string | undefined | null): number {
  return parseApiDateTime(iso).getTime();
}
