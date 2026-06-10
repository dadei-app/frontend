import type { CSSProperties } from 'react';
import { formatForUser } from '@dadei/ui/utils/time';
import type { ActionOperation, NetworkAction } from '@dadei/ui/types/models.types';

/** Domains that surface approval notification banners. */
export const NOTIFICATION_ACTION_TYPES = new Set(['calendar', 'email']);

const DOMAIN_LABELS: Record<string, string> = {
  calendar: 'Calendar',
  email: 'Email',
};

const OPERATION_LABELS: Record<ActionOperation, string> = {
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
};

const SEND_TOOLS = new Set(['send_email', 'send_draft', 'gmail_send', 'gmail_send_draft']);
const UPDATE_TOOLS = new Set(['modify_email_labels', 'gmail_modify_labels']);

function matchesOp(name: string, op: string): boolean {
  return name.startsWith(`${op}_`) || name.includes(`_${op}_`) || name.endsWith(`_${op}`);
}

/** Client fallback when API payload omits operation (mirrors backend action_metadata). */
export function operationForToolName(toolName: string | null | undefined): ActionOperation | undefined {
  const name = (toolName ?? '').trim().toLowerCase();
  if (!name) return undefined;
  if (SEND_TOOLS.has(name) || matchesOp(name, 'create')) return 'create';
  if (UPDATE_TOOLS.has(name) || matchesOp(name, 'update')) return 'update';
  if (matchesOp(name, 'delete')) return 'delete';
  return undefined;
}

export function resolveActionOperation(
  action: Pick<NetworkAction, 'operation' | 'tool_name'>,
): ActionOperation | undefined {
  if (action.operation) return action.operation;
  return operationForToolName(action.tool_name);
}

export type OperationBannerTheme = {
  shell: CSSProperties;
  tint: string;
  operationTextClass: string;
  countdownBarClass: string;
};

/** Translucent glass shells — dark green / blue / red (aligned with command bubbles). */
export const OPERATION_BANNER_THEME: Record<ActionOperation, OperationBannerTheme> = {
  create: {
    shell: {
      backdropFilter: 'blur(6px) saturate(104%)',
      WebkitBackdropFilter: 'blur(6px) saturate(104%)',
      background: 'rgba(10, 28, 22, 0.8)',
      border: '1px solid rgba(52, 211, 153, 0.2)',
      boxShadow:
        'inset 0 1px 0 rgba(110, 231, 183, 0.07), inset 0 -1px 0 rgba(0, 0, 0, 0.12), 0 8px 22px -14px rgba(0, 0, 0, 0.36)',
    },
    tint: 'radial-gradient(circle at 50% 0%, rgba(16, 185, 129, 0.16), transparent 72%)',
    operationTextClass: 'text-emerald-300/95',
    countdownBarClass: 'bg-emerald-200/85',
  },
  update: {
    shell: {
      backdropFilter: 'blur(6px) saturate(104%)',
      WebkitBackdropFilter: 'blur(6px) saturate(104%)',
      background: 'rgba(12, 22, 38, 0.8)',
      border: '1px solid rgba(56, 189, 248, 0.2)',
      boxShadow:
        'inset 0 1px 0 rgba(125, 211, 252, 0.07), inset 0 -1px 0 rgba(0, 0, 0, 0.12), 0 8px 22px -14px rgba(0, 0, 0, 0.36)',
    },
    tint: 'radial-gradient(circle at 50% 0%, rgba(56, 189, 248, 0.16), transparent 72%)',
    operationTextClass: 'text-sky-300/95',
    countdownBarClass: 'bg-sky-200/85',
  },
  delete: {
    shell: {
      backdropFilter: 'blur(6px) saturate(104%)',
      WebkitBackdropFilter: 'blur(6px) saturate(104%)',
      background: 'rgba(36, 14, 18, 0.8)',
      border: '1px solid rgba(251, 113, 133, 0.22)',
      boxShadow:
        'inset 0 1px 0 rgba(253, 164, 175, 0.07), inset 0 -1px 0 rgba(0, 0, 0, 0.12), 0 8px 22px -14px rgba(0, 0, 0, 0.36)',
    },
    tint: 'radial-gradient(circle at 50% 0%, rgba(244, 63, 94, 0.16), transparent 72%)',
    operationTextClass: 'text-rose-300/95',
    countdownBarClass: 'bg-rose-200/85',
  },
};

export const NEUTRAL_BANNER_THEME: OperationBannerTheme = {
  shell: {
    backdropFilter: 'blur(6px) saturate(104%)',
    WebkitBackdropFilter: 'blur(6px) saturate(104%)',
    background: 'rgba(24, 24, 27, 0.8)',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    boxShadow:
      'inset 0 1px 0 rgba(255, 255, 255, 0.04), inset 0 -1px 0 rgba(0, 0, 0, 0.08), 0 8px 22px -14px rgba(0, 0, 0, 0.32)',
  },
  tint: 'radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.04), transparent 70%)',
  operationTextClass: 'text-zinc-300/90',
  countdownBarClass: 'bg-zinc-100',
};

export function isNotificationAction(action: Pick<NetworkAction, 'action_type'>): boolean {
  return NOTIFICATION_ACTION_TYPES.has(action.action_type);
}

type ProposedToolPayload = {
  proposed?: boolean;
  kind?: string;
  operation?: string;
  title?: string;
};

/** True when a command tool_result summary is the structured proposed-action payload. */
export function isProposedToolSummary(parsed: Record<string, unknown>): boolean {
  if (parsed.proposed === true) return true;
  const message = parsed.message;
  if (typeof message !== 'string' || !message.trim().startsWith('{')) return false;
  try {
    const inner = JSON.parse(message) as Record<string, unknown>;
    return inner.proposed === true;
  } catch {
    return false;
  }
}

/** Human line for a proposed-action payload (mirrors backend action_metadata). */
export function proposedActionHumanLine(payload: ProposedToolPayload): string | null {
  if (payload.proposed !== true) return null;
  const kind = (payload.kind ?? 'action').trim().toLowerCase();
  const title = (payload.title ?? '').trim();
  const operation = (payload.operation ?? 'create').trim().toLowerCase();
  if (kind === 'email') {
    if (operation === 'delete') return 'Prepared to delete an email.';
    if (title) return `Drafted an email: ${title}.`;
    return 'Drafted an email.';
  }
  if (kind === 'calendar') {
    if (operation === 'delete') {
      return title ? `Prepared to cancel ${title}.` : 'Prepared to cancel a calendar event.';
    }
    if (title) return `Scheduled ${title}.`;
    return 'Scheduled a calendar event.';
  }
  if (title) return `Prepared ${title}.`;
  return null;
}

export function actionDomainLabel(actionType: string): string {
  return DOMAIN_LABELS[actionType] ?? actionType.replace(/_/g, ' ');
}

export function actionOperationLabel(operation: ActionOperation): string {
  return OPERATION_LABELS[operation];
}

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

export function actionDisplayTitle(action: NetworkAction): string {
  const title = action.title?.trim();
  if (title) return title;
  return actionDomainLabel(action.action_type);
}

export function actionBannerMeta(action: NetworkAction): string | undefined {
  const timeRange = formatActionTimeRange(action.start_time, action.end_time);
  return timeRange ?? undefined;
}

function normalizeConfidenceValue(raw: number): number | null {
  if (Number.isNaN(raw)) return null;
  let value = raw;
  if (value > 1) {
    if (value <= 100 && Number.isInteger(value)) {
      value = value / 100;
    } else {
      value = Math.min(1, value);
    }
  }
  if (value < 0 || value > 1 || Number.isNaN(value)) return null;
  return value;
}

/** Resolve stored confidence from API fields (0–1 scale). */
export function resolveMemoryConfidence(memory: {
  confidence?: number | string | null;
  details?: Record<string, unknown> | null;
}): number | null {
  const candidates: Array<number | string | null | undefined> = [memory.confidence];
  const detailsConfidence = memory.details?.confidence;
  if (typeof detailsConfidence === 'number' || typeof detailsConfidence === 'string') {
    candidates.push(detailsConfidence);
  }

  for (const candidate of candidates) {
    if (candidate == null || candidate === '') continue;
    const parsed = typeof candidate === 'number' ? candidate : Number(candidate);
    const normalized = normalizeConfidenceValue(parsed);
    if (normalized != null) return normalized;
  }
  return null;
}

export function formatConfidence(confidence: number | null | undefined): string | null {
  if (confidence == null) return null;
  const normalized = normalizeConfidenceValue(confidence);
  if (normalized == null) return null;
  return `${Math.round(normalized * 100)}% confidence`;
}

export function firstEvidenceQuote(
  provenance: { evidence_quotes?: string[] } | null | undefined,
): string | null {
  const quote = provenance?.evidence_quotes?.find((item) => item.trim().length > 0);
  return quote ? truncatePreview(quote, 100) : null;
}
