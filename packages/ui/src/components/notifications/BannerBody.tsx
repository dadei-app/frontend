import {
  formatActionTimeRange,
  formatActionWhen,
} from '@dadei/ui/lib/workspace/display/actionDisplay';
import { formatForUser } from '@dadei/ui/lib/platform/shared/time';
import type { ActionOperation, NetworkAction } from '@dadei/ui/types/models.types';

export type BannerBodyProps = {
  actionType: string;
  operation?: ActionOperation;
  title: string;
  body?: string;
  toolArgs?: Record<string, unknown>;
  startTime?: string | null;
  endTime?: string | null;
};

function strArg(args: Record<string, unknown> | undefined, key: string): string | null {
  const value = args?.[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function userTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function eventTimeLabel(iso: string | null | undefined): string | null {
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

function eventDateParts(iso: string | null | undefined): { month: string; day: string } | null {
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

function EmailComposerBody({
  toolArgs,
  title,
}: {
  toolArgs?: Record<string, unknown>;
  title: string;
}) {
  const to = strArg(toolArgs, 'to');
  const subject = strArg(toolArgs, 'subject') ?? title;
  const body = strArg(toolArgs, 'body');
  const cc = strArg(toolArgs, 'cc');
  const bcc = strArg(toolArgs, 'bcc');

  const recipientRows: Array<[string, string]> = [];
  if (to) recipientRows.push(['To', to]);
  if (cc) recipientRows.push(['Cc', cc]);
  if (bcc) recipientRows.push(['Bcc', bcc]);

  return (
    <div className="mt-1 min-w-0">
      <p className="text-sm font-semibold leading-snug text-zinc-100">{subject}</p>
      {recipientRows.length > 0 ? (
        <div className="mt-1 space-y-0.5">
          {recipientRows.map(([label, value]) => (
            <p key={label} className="min-w-0 truncate text-xs text-zinc-400 font-secondary">
              <span className="text-zinc-500">{label}</span>{' '}
              <span className="text-zinc-300">{value}</span>
            </p>
          ))}
        </div>
      ) : null}
      {body ? (
        <p className="mt-2 border-t border-white/6 pt-2 text-xs leading-relaxed whitespace-pre-wrap text-zinc-400 font-secondary">
          {body}
        </p>
      ) : (
        <p className="mt-2 border-t border-white/6 pt-2 text-xs italic text-zinc-500 font-secondary">
          No message body
        </p>
      )}
    </div>
  );
}

function EventBannerBody({
  title,
  body,
  toolArgs,
  startTime,
  endTime,
  operation,
}: {
  title: string;
  body?: string;
  toolArgs?: Record<string, unknown>;
  startTime?: string | null;
  endTime?: string | null;
  operation?: ActionOperation;
}) {
  const startIso = startTime ?? strArg(toolArgs, 'start_iso');
  const endIso = endTime ?? strArg(toolArgs, 'end_iso');
  const when =
    body ??
    (startIso && endIso
      ? formatActionTimeRange(startIso, endIso)
      : eventTimeLabel(startIso));
  const dateParts = eventDateParts(startIso);
  const location = strArg(toolArgs, 'location');
  const description = strArg(toolArgs, 'description');
  const attendees = toolArgs?.attendee_emails;
  const attendeeList = Array.isArray(attendees)
    ? attendees.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

  return (
    <div className="mt-1 min-w-0">
      <div className="flex gap-2.5">
        {dateParts ? (
          <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-md border border-white/8 bg-white/4">
            <span className="text-[8px] font-semibold uppercase tracking-wider text-zinc-400 font-secondary">
              {dateParts.month}
            </span>
            <span className="text-sm font-semibold leading-none text-zinc-100">{dateParts.day}</span>
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-zinc-100">{title}</p>
          {operation === 'delete' ? (
            <p className="mt-0.5 text-xs text-rose-300/80 font-secondary">This event will be removed</p>
          ) : null}
          {when ? (
            <p className="mt-0.5 text-xs text-zinc-400 font-secondary">{when}</p>
          ) : null}
          {location ? (
            <p className="mt-0.5 text-xs text-zinc-400 font-secondary">📍 {location}</p>
          ) : null}
        </div>
      </div>
      {description ? (
        <p className="mt-2 border-t border-white/6 pt-2 text-xs leading-relaxed whitespace-pre-wrap text-zinc-400 font-secondary">
          {description}
        </p>
      ) : null}
      {attendeeList.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1 border-t border-white/6 pt-2">
          {attendeeList.map((email) => (
            <span
              key={email}
              className="rounded-full border border-white/8 bg-white/4 px-2 py-0.5 text-[10px] text-zinc-300 font-secondary"
            >
              {email}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DefaultBannerBody({ title, body }: { title: string; body?: string }) {
  return (
    <>
      <p className="mt-1 text-sm font-semibold leading-snug text-zinc-100">{title}</p>
      {body ? (
        <p className="mt-0.5 text-xs leading-relaxed text-zinc-400 font-secondary">{body}</p>
      ) : null}
    </>
  );
}

export default function BannerBody({
  actionType,
  operation,
  title,
  body,
  toolArgs,
  startTime,
  endTime,
}: BannerBodyProps) {
  const kind = actionType.toLowerCase();

  if (kind === 'email') {
    return <EmailComposerBody toolArgs={toolArgs} title={title} />;
  }

  if (kind === 'calendar') {
    return (
      <EventBannerBody
        title={title}
        body={body}
        toolArgs={toolArgs}
        startTime={startTime}
        endTime={endTime}
        operation={operation}
      />
    );
  }

  return <DefaultBannerBody title={title} body={body} />;
}

export function bannerBodyFromAction(action: NetworkAction): BannerBodyProps {
  return {
    actionType: action.action_type,
    operation: action.operation ?? undefined,
    title: action.title?.trim() || action.action_type,
    body: undefined,
    toolArgs: action.tool_args ?? undefined,
    startTime: action.start_time,
    endTime: action.end_time,
  };
}
