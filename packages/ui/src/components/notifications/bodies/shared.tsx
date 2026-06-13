import { formatActionWhen } from '@dadei/ui/lib/workspace/display/actionDisplay';
import { formatForUser } from '@dadei/ui/lib/platform/shared/time';

export function strArg(args: Record<string, unknown> | undefined, key: string): string | null {
  const value = args?.[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function numArg(args: Record<string, unknown> | undefined, key: string): number | null {
  const value = args?.[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

export function userTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function eventTimeLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return formatForUser(iso, userTimezone(), {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return formatActionWhen(iso);
  }
}

export function eventDateParts(iso: string | null | undefined): { month: string; day: string } | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const tz = userTimezone();
    const month = formatForUser(iso, tz, { month: 'short' }).replace('.', '');
    const day = formatForUser(iso, tz, { day: 'numeric' });
    return { month, day };
  } catch {
    return null;
  }
}

export function CompactTitle({ title }: { title: string }) {
  return (
    <p className="mt-0.5 truncate text-sm font-semibold leading-snug text-zinc-100">{title}</p>
  );
}
