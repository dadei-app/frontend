import {
  formatActionTimeRange,
  formatActionWhen,
  truncatePreview,
} from '@dadei/ui/utils/actionDisplay';
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

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-white/8 bg-black/25">
      <div className="border-b border-white/6 px-3 py-1.5">
        <div className="flex min-w-0 items-baseline gap-2 text-[11px] font-secondary">
          <span className="shrink-0 text-zinc-500">To</span>
          <span className="min-w-0 truncate text-zinc-200">{to ?? '—'}</span>
        </div>
        {cc ? (
          <div className="mt-0.5 flex min-w-0 items-baseline gap-2 text-[11px] font-secondary">
            <span className="shrink-0 text-zinc-500">Cc</span>
            <span className="min-w-0 truncate text-zinc-300">{cc}</span>
          </div>
        ) : null}
        <div className="mt-0.5 flex min-w-0 items-baseline gap-2 text-[11px] font-secondary">
          <span className="shrink-0 text-zinc-500">Subject</span>
          <span className="min-w-0 truncate font-medium text-zinc-100">{subject}</span>
        </div>
      </div>
      {body ? (
        <p className="max-h-24 overflow-hidden px-3 py-2 text-[11px] leading-relaxed whitespace-pre-wrap text-zinc-400 font-secondary">
          {truncatePreview(body, 280)}
        </p>
      ) : (
        <p className="px-3 py-2 text-[11px] italic text-zinc-500 font-secondary">No body</p>
      )}
    </div>
  );
}

function TaskBannerBody({
  title,
  toolArgs,
}: {
  title: string;
  toolArgs?: Record<string, unknown>;
}) {
  const notes = strArg(toolArgs, 'notes');
  const dueLabel = formatActionWhen(strArg(toolArgs, 'due_iso'));

  return (
    <div className="mt-1.5">
      <p className="text-sm font-semibold leading-snug text-zinc-100">{title}</p>
      {dueLabel || notes ? (
        <div className="mt-1 space-y-0.5">
          {dueLabel ? (
            <p className="text-xs text-zinc-400 font-secondary">Due {dueLabel}</p>
          ) : null}
          {notes ? (
            <p className="text-xs leading-relaxed text-zinc-400 font-secondary">
              {truncatePreview(notes, 120)}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CalendarBannerBody({
  title,
  body,
  toolArgs,
  startTime,
  endTime,
}: {
  title: string;
  body?: string;
  toolArgs?: Record<string, unknown>;
  startTime?: string | null;
  endTime?: string | null;
}) {
  const when =
    body ?? formatActionTimeRange(startTime, endTime);
  const location = strArg(toolArgs, 'location');
  const attendees = toolArgs?.attendee_emails;
  const attendeeList = Array.isArray(attendees)
    ? attendees.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

  return (
    <div className="mt-1.5">
      <p className="text-sm font-semibold leading-snug text-zinc-100">{title}</p>
      {when ? (
        <p className="mt-0.5 text-xs text-zinc-400 font-secondary">{when}</p>
      ) : null}
      {location ? (
        <p className="mt-0.5 text-xs text-zinc-500 font-secondary">{location}</p>
      ) : null}
      {attendeeList.length > 0 ? (
        <p className="mt-0.5 text-xs text-zinc-500 font-secondary">
          {truncatePreview(attendeeList.join(', '), 100)}
        </p>
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
  title,
  body,
  toolArgs,
  startTime,
  endTime,
}: BannerBodyProps) {
  const kind = actionType.toLowerCase();

  if (kind === 'email' || kind === 'message') {
    return <EmailComposerBody toolArgs={toolArgs} title={title} />;
  }

  if (kind === 'task' || kind === 'todo') {
    return <TaskBannerBody title={title} toolArgs={toolArgs} />;
  }

  if (kind === 'calendar_event' || kind === 'calendar') {
    return (
      <CalendarBannerBody
        title={title}
        body={body}
        toolArgs={toolArgs}
        startTime={startTime}
        endTime={endTime}
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
