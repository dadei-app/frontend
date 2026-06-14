const NAIVE_ISO_T = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?$/;
const NAIVE_ISO_SPACE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,9})?$/;

/**
 * Parse API datetimes for display, sorting, and countdowns.
 * Strings without a timezone are treated as UTC (SQLAlchemy/FastAPI naive UTC).
 * ISO strings with ``Z`` or a numeric offset use the built-in parser.
 */
export function parseApiDateTime(iso: string | undefined | null): Date {
  if (iso == null || String(iso).trim() === '') {
    return new Date(NaN);
  }
  const s = String(iso).trim();
  if (NAIVE_ISO_T.test(s)) {
    return new Date(`${s}Z`);
  }
  if (NAIVE_ISO_SPACE.test(s)) {
    return new Date(`${s.replace(' ', 'T')}Z`);
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }
  return new Date(NaN);
}

export function parseApiDateTimeMs(iso: string | undefined | null): number {
  return parseApiDateTime(iso).getTime();
}
