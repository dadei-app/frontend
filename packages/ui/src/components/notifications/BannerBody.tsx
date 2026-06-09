import {
  formatActionTimeRange,
  formatActionWhen,
  truncatePreview,
} from '@dadei/ui/utils/actionDisplay';
import { formatForUser } from '@dadei/ui/utils/time';
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

  const headerRows: Array<[string, string]> = [];
  if (to) headerRows.push(['To', to]);
  if (cc) headerRows.push(['Cc', cc]);
  if (bcc) headerRows.push(['Bcc', bcc]);
  headerRows.push(['Subject', subject]);

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-sky-500/15 bg-gradient-to-br from-sky-950/50 via-black/30 to-black/40 shadow-[inset_0_1px_0_rgba(125,211,252,0.08)]">
      <div className="flex items-center gap-2 border-b border-sky-500/10 bg-sky-500/5 px-3 py-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sky-500/15 text-[11px] text-sky-200">
          ✉
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-300/80 font-secondary">
          Email draft
        </span>
      </div>
      <div className="space-y-1 border-b border-white/6 px-3 py-2">
        {headerRows.map(([label, value]) => (
          <div key={label} className="flex min-w-0 items-baseline gap-2 text-[11px] font-secondary">
            <span className="w-12 shrink-0 text-zinc-500">{label}</span>
            <span
              className={
                label === 'Subject'
                  ? 'min-w-0 truncate font-medium text-zinc-50'
                  : 'min-w-0 truncate text-zinc-200'
              }
            >
              {value}
            </span>
          </div>
        ))}
      </div>
      <div className="bg-black/20 px-3 py-2.5">
        {body ? (
          <p className="max-h-28 overflow-hidden text-[11px] leading-relaxed whitespace-pre-wrap text-zinc-300/90 font-secondary">
            {truncatePreview(body, 320)}
          </p>
        ) : (
          <p className="text-[11px] italic text-zinc-500 font-secondary">No message body</p>
        )}
      </div>
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
    <div className="mt-2 overflow-hidden rounded-xl border border-emerald-500/15 bg-gradient-to-br from-emerald-950/45 via-black/30 to-black/40 shadow-[inset_0_1px_0_rgba(110,231,183,0.08)]">
      <div className="flex gap-3 p-3">
        {dateParts ? (
          <div className="flex h-[52px] w-[52px] shrink-0 flex-col items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald-300/90 font-secondary">
              {dateParts.month}
            </span>
            <span className="text-lg font-semibold leading-none text-emerald-50">{dateParts.day}</span>
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-zinc-50">{title}</p>
          {operation === 'delete' ? (
            <p className="mt-0.5 text-[11px] text-rose-300/80 font-secondary">This event will be removed</p>
          ) : null}
          {when ? (
            <p className="mt-1 text-xs text-emerald-200/75 font-secondary">{when}</p>
          ) : null}
          {location ? (
            <p className="mt-1 text-[11px] text-zinc-400 font-secondary">📍 {location}</p>
          ) : null}
        </div>
      </div>
      {description ? (
        <p className="border-t border-white/6 px-3 py-2 text-[11px] leading-relaxed text-zinc-400 font-secondary">
          {truncatePreview(description, 140)}
        </p>
      ) : null}
      {attendeeList.length > 0 ? (
        <div className="flex flex-wrap gap-1 border-t border-white/6 px-3 py-2">
          {attendeeList.slice(0, 4).map((email) => (
            <span
              key={email}
              className="rounded-full border border-white/8 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-300 font-secondary"
            >
              {email}
            </span>
          ))}
          {attendeeList.length > 4 ? (
            <span className="px-1 text-[10px] text-zinc-500 font-secondary">
              +{attendeeList.length - 4} more
            </span>
          ) : null}
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
    toolArgs: action.tool_args,
    startTime: action.start_time,
    endTime: action.end_time,
  };
}
