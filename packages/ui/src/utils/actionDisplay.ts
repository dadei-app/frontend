import { formatForUser } from '@dadei/ui/utils/time';

import type { NetworkAction } from '@dadei/ui/types/models.types';

const ACTION_TYPE_LABELS: Record<string, string> = {
  calendar: 'Calendar event',
  calendar_event: 'Calendar event',
  todo: 'Task',
  task: 'Task',
  email: 'Email',
  message: 'Message',
};

export function truncatePreview(text: string | null | undefined, maxLen = 80): string | null {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return null;
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1).trimEnd()}…`;
}

export function formatMetaLine(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => (part ?? '').trim())
    .filter((part) => part.length > 0)
    .join(' · ');
}

function userTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function formatActionWhen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return formatForUser(iso, userTimezone(), {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return null;
  }
}

export function formatActionTimeRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string | null {
  const startLabel = formatActionWhen(start);
  const endLabel = formatActionWhen(end);
  if (startLabel && endLabel) return `${startLabel} – ${endLabel}`;
  return startLabel ?? endLabel;
}

export function formatAttendeeSummary(emails: string[] | null | undefined): string | null {
  if (!emails?.length) return null;
  if (emails.length === 1) return emails[0];
  return `${emails.length} attendees`;
}

export function actionDisplayTitle(action: NetworkAction): string {
  const title = action.title?.trim();
  if (title) return title;

  const canonical = action.canonical_text?.trim();
  if (canonical) return canonical;

  return ACTION_TYPE_LABELS[action.action_type] ?? action.action_type;
}

export function calendarActionMeta(action: NetworkAction): string {
  return formatMetaLine([
    formatActionTimeRange(action.start_time, action.end_time),
    action.location?.trim(),
    formatAttendeeSummary(action.attendee_emails),
    action.description ? truncatePreview(action.description, 60) : null,
    action.status,
  ]);
}

export function taskActionMeta(action: NetworkAction): string {
  return formatMetaLine([
    action.start_time ? `Due ${formatActionWhen(action.start_time)}` : null,
    action.notes ? truncatePreview(action.notes, 60) : null,
    action.status,
  ]);
}

export function mailActionMeta(action: NetworkAction): string {
  return formatMetaLine([
    action.recipient_to?.trim() ? `To ${action.recipient_to.trim()}` : null,
    truncatePreview(action.body, 80),
    action.status,
  ]);
}

export function actionBannerMeta(action: NetworkAction): string | undefined {
  const parts: string[] = [];
  const timeRange = formatActionTimeRange(action.start_time, action.end_time);
  if (timeRange) parts.push(timeRange);

  const detail =
    action.description?.trim() ||
    action.body?.trim() ||
    action.notes?.trim() ||
    action.recipient_to?.trim();
  const preview = truncatePreview(detail, 80);
  if (preview) parts.push(preview);

  return parts.length ? parts.join(' · ') : undefined;
}

export function formatConfidence(confidence: number | null | undefined): string | null {
  if (confidence == null || Number.isNaN(confidence)) return null;
  return `${Math.round(confidence * 100)}% confidence`;
}

export function firstEvidenceQuote(
  provenance: { evidence_quotes?: string[] } | null | undefined,
): string | null {
  const quote = provenance?.evidence_quotes?.find((item) => item.trim().length > 0);
  return quote ? truncatePreview(quote, 100) : null;
}
