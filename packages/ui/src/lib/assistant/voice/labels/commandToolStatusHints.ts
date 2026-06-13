import { formatForUser } from '@dadei/ui/lib/platform/shared/time';

const MAX_QUERY_CHARS = 36;

const TOOL_GROUP_LABELS: Record<string, string> = {
  calendar: 'calendar',
  email: 'email',
  tasks: 'tasks',
  contacts: 'contacts',
  docs: 'docs',
  drive: 'drive',
  sheets: 'sheets',
  realtime: 'weather & maps',
  web: 'web search',
  client_actions: 'device controls',
  memory_write: 'memory',
};

const CLIENT_CONTEXT_KEY_LABELS: Record<string, string> = {
  location: 'your location',
  timezone: 'your timezone',
  client_type: 'your device',
};

function truncateQuery(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= MAX_QUERY_CHARS) return trimmed;
  return `${trimmed.slice(0, MAX_QUERY_CHARS - 1).trimEnd()}…`;
}

function stringArg(args: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = args[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function calendarDayKey(instant: Date, timeZone: string): string {
  return formatForUser(instant.toISOString(), timeZone, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function relativeDayLabel(instant: Date, timeZone: string, now = new Date()): string {
  const day = calendarDayKey(instant, timeZone);
  const today = calendarDayKey(now, timeZone);
  const tomorrow = calendarDayKey(new Date(now.getTime() + 86_400_000), timeZone);
  const yesterday = calendarDayKey(new Date(now.getTime() - 86_400_000), timeZone);

  if (day === today) return 'today';
  if (day === tomorrow) return 'tomorrow';
  if (day === yesterday) return 'yesterday';

  return formatForUser(instant.toISOString(), timeZone, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function parseIso(value: string): Date | null {
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function describeCalendarRange(
  timeMinIso: string,
  timeMaxIso: string,
  timeZone: string,
): string | null {
  const min = parseIso(timeMinIso);
  const max = parseIso(timeMaxIso);
  if (!min || !max) return null;

  const minDay = calendarDayKey(min, timeZone);
  const maxDay = calendarDayKey(max, timeZone);
  if (minDay === maxDay) return relativeDayLabel(min, timeZone);

  const minLabel = relativeDayLabel(min, timeZone);
  const maxLabel = relativeDayLabel(max, timeZone);
  return `${minLabel}–${maxLabel}`;
}

function hintForLoadToolGroups(args: Record<string, unknown>): string | null {
  const raw = args.groups;
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const labels = raw
    .map((group) => (typeof group === 'string' ? TOOL_GROUP_LABELS[group.trim()] ?? group.trim() : ''))
    .filter(Boolean);

  if (labels.length === 0) return null;
  if (labels.length === 1) return `Loading ${labels[0]} tools`;
  if (labels.length === 2) return `Loading ${labels[0]} and ${labels[1]} tools`;
  return `Loading ${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]} tools`;
}

function hintForCalendarList(args: Record<string, unknown>, timeZone: string): string | null {
  const query = stringArg(args, 'q');
  if (query) return `Searching calendar for "${truncateQuery(query)}"`;

  const timeMin = stringArg(args, 'time_min_iso', 'time_min');
  const timeMax = stringArg(args, 'time_max_iso', 'time_max');

  if (timeMin && timeMax) {
    const range = describeCalendarRange(timeMin, timeMax, timeZone);
    if (range) return `Checking calendar for ${range}`;
  }

  if (timeMin) {
    const min = parseIso(timeMin);
    if (min) return `Checking calendar for ${relativeDayLabel(min, timeZone)}`;
  }

  return null;
}

function hintForSearchTool(base: string, args: Record<string, unknown>): string | null {
  const query = stringArg(args, 'query', 'q');
  if (!query) return null;
  return `${base} for "${truncateQuery(query)}"`;
}

function hintForGetClientContext(args: Record<string, unknown>): string | null {
  const raw = args.keys;
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const labels = raw
    .map((key) => (typeof key === 'string' ? CLIENT_CONTEXT_KEY_LABELS[key] ?? key : ''))
    .filter(Boolean);

  if (labels.length === 0) return null;
  if (labels.length === 1) return `Getting ${labels[0]}`;
  if (labels.length === 2) return `Getting ${labels[0]} and ${labels[1]}`;
  return `Getting ${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

function hintForCalendarCreate(args: Record<string, unknown>, timeZone: string): string | null {
  const title = stringArg(args, 'title');
  if (title) return `Scheduling "${truncateQuery(title)}"`;

  const startIso = stringArg(args, 'start_iso');
  if (!startIso) return null;
  const start = parseIso(startIso);
  if (!start) return null;
  return `Scheduling for ${relativeDayLabel(start, timeZone)}`;
}

function hintForGmailSend(args: Record<string, unknown>): string | null {
  const subject = stringArg(args, 'subject');
  if (subject) return `Drafting "${truncateQuery(subject)}"`;

  const to = args.to;
  if (typeof to === 'string' && to.trim()) return `Drafting email to ${truncateQuery(to)}`;
  if (Array.isArray(to) && to.length > 0) {
    const first = typeof to[0] === 'string' ? to[0].trim() : '';
    if (first) return `Drafting email to ${truncateQuery(first)}`;
  }
  return null;
}

function hintForContactsSearch(args: Record<string, unknown>): string | null {
  return hintForSearchTool('Searching contacts', args);
}

function hintForMapsSearch(args: Record<string, unknown>): string | null {
  return hintForSearchTool('Looking up on the map', args);
}

function hintForGetCurrentTime(args: Record<string, unknown>): string | null {
  const timezone = stringArg(args, 'timezone');
  if (timezone) return `Checking time in ${timezone}`;
  return null;
}

/** Arg-aware status hint; returns null to fall back to the static tool label. */
export function formatCommandToolStatusHint(
  tool: string,
  args: Record<string, unknown> | null | undefined,
  timeZone?: string,
): string | null {
  if (!tool || !args || typeof args !== 'object') return null;

  const tz = timeZone?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  switch (tool) {
    case 'load_tool_groups':
      return hintForLoadToolGroups(args);
    case 'calendar_list':
      return hintForCalendarList(args, tz);
    case 'calendar_create':
      return hintForCalendarCreate(args, tz);
    case 'gmail_search':
      return hintForSearchTool('Searching inbox', args);
    case 'gmail_list':
      return hintForSearchTool('Scanning inbox', args);
    case 'search_memory':
      return hintForSearchTool('Searching memory', args);
    case 'search_interactions':
      return hintForSearchTool('Searching conversations', args);
    case 'web_search':
      return hintForSearchTool('Searching the web', args);
    case 'contacts_search':
      return hintForContactsSearch(args);
    case 'maps_search_places':
      return hintForMapsSearch(args);
    case 'get_client_context':
      return hintForGetClientContext(args);
    case 'gmail_send':
      return hintForGmailSend(args);
    case 'get_current_time':
      return hintForGetCurrentTime(args);
    default:
      return null;
  }
}
