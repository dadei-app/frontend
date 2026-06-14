import { formatActionTimeRange } from '@dadei/ui/lib/workspace/display/actionDisplay';
import type { CalendarEventBodyProps } from './types';
import { eventDateParts, eventTimeLabel, strArg } from './shared';

export default function CalendarEventBody({
  title,
  body,
  toolArgs,
  startTime,
  endTime,
  operation,
}: CalendarEventBodyProps) {
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
