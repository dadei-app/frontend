import { formatForUser } from '@dadei/ui/lib/platform/shared/time';

const MAX_QUERY_CHARS = 36;

const TOOL_LABELS: Record<string, string> = {
  // Session & meta
  load_tool_groups: 'Preparing tools',
  end_assistant_session: 'Wrapping up',

  // Time, location, weather
  get_current_time: 'Checking the time',
  get_current_location: 'Pinpointing your location',
  get_weather: 'Checking the weather',
  get_weather_forecast: 'Looking at the forecast',
  get_client_context: 'Talking to your device',

  // Memory & context
  store_memory: 'Making a mental note',
  search_memory: 'Digging through memory',
  query_person_memory: 'Recalling someone\'s information',
  assign_person_name: 'Saving someone\'s name',
  search_interactions: 'Searching conversations',

  // Web & maps
  web_search: 'Checking Google',
  maps_search_places: 'Checking the map',
  maps_directions: 'Plotting the route',
  maps_distance_matrix: 'Simulating a trip',

  // Calendar
  calendar_create: 'Adding a calendar event',
  calendar_list: 'Flipping through the calendar',
  calendar_get: 'Loading a calendar event',
  calendar_update: 'Updating a calendar event',
  calendar_delete: 'Deleting a calendar event',

  // Gmail
  gmail_send: 'Sending an email',
  gmail_read: 'Opening an email',
  gmail_search: 'Searching the inbox',
  gmail_list: 'Scanning the inbox',
  gmail_delete: 'Trashing an email',
  gmail_modify_labels: 'Updating email labels',

  // Tasks
  tasks_create: 'Adding a task',
  tasks_list: 'Checking tasks',
  tasks_get: 'Getting a task',
  tasks_update: 'Updating a task',
  tasks_delete: 'Deleting a task',
  tasklist_create: 'Creating a task list',
  tasklist_list: 'Checking task lists',
  tasklist_delete: 'Deleting a task list',

  // Contacts
  contacts_create: 'Adding a contact',
  contacts_list: 'Flipping through contacts',
  contacts_search: 'Searching contacts',
  contacts_get: 'Reading someone\'s contact',
  contacts_update: 'Updating a contact',
  contacts_delete: 'Removing a contact',

  // Files & documents
  files_list: 'Listing your files',
  files_search: 'Searching your files',
  files_get: 'Opening file details',
  files_download: 'Downloading a file',
  files_upload: 'Uploading a file',
  files_create_folder: 'Creating a folder',
  files_delete: 'Deleting a file',
  files_move: 'Moving a file',
  document_read: 'Reading a document',
  document_append: 'Adding to a document',
  document_replace: 'Updating a document',

  // Sheets
  sheets_create: 'Creating a spreadsheet',
  sheets_list: 'Flipping through spreadsheets',
  sheets_read: 'Reading a spreadsheet',
  sheets_append_row: 'Adding a row',
  sheets_update_range: 'Updating a spreadsheet',
  sheets_delete: 'Deleting a spreadsheet',

  // Device & media controls
  set_device_volume: 'Adjusting the volume',
  device_volume_up: 'Turning it up',
  device_volume_down: 'Turning it down',
  device_volume_mute: 'Muting the volume',
  media_play_pause: 'Toggling playback',
  media_next_track: 'Skipping to the next track',
  media_previous_track: 'Going back a track',
  media_stop: 'Stopping playback',
  toggle_dark_mode: 'Toggling dark mode',
  lock_device: 'Locking the device',
  sleep_device: 'Putting the device to sleep',
  open_app: 'Opening an app',
  close_focused_app: 'Closing that app',
  minimize_focused_window: 'Minimizing the window',
  toggle_fullscreen: 'Toggling fullscreen',
  dismiss_notifications: 'Clearing notifications',
  get_now_playing: 'Checking what is playing',
  get_device_battery: 'Checking the battery',
  take_device_screenshot: 'Taking a screenshot',
  toggle_do_not_disturb: 'Toggling do not disturb',
};

/** Prefix + action suffix fallbacks when a tool is not in TOOL_LABELS. */
const PREFIX_ACTION_LABELS: Record<string, Record<string, string>> = {
  gmail_: {
    list: 'Scanning the inbox',
    read: 'Opening that email',
    search: 'Searching the inbox',
    send: 'Sending an email',
    delete: 'Moving that to trash',
    modify_labels: 'Updating email labels',
  },
  calendar_: {
    list: 'Flipping through the calendar',
    create: 'Adding a calendar event',
    get: 'Looking at that calendar event',
    update: 'Updating a calendar event',
    delete: 'Removing a calendar event',
  },
  tasks_: {
    list: 'Checking tasks',
    create: 'Adding a task',
    get: 'Looking at that task',
    update: 'Updating that task',
    delete: 'Removing that task',
  },
  tasklist_: {
    list: 'Checking task lists',
    create: 'Creating a task list',
    delete: 'Deleting that task list',
  },
  contacts_: {
    list: 'Flipping through contacts',
    search: 'Finding someone\'s contact',
    create: 'Adding a contact',
    get: 'Opening a contact',
    update: 'Updating a contact',
    delete: 'Removing a contact',
  },
  files_: {
    list: 'Listing your files',
    search: 'Searching your files',
    get: 'Opening file details',
    download: 'Downloading a file',
    upload: 'Uploading a file',
    create_folder: 'Creating a folder',
    delete: 'Deleting a file',
    move: 'Moving a file',
  },
  document_: {
    read: 'Reading a document',
    append: 'Adding to a document',
    replace: 'Updating a document',
  },
  sheets_: {
    list: 'Flipping through spreadsheets',
    read: 'Opening that spreadsheet',
    create: 'Starting a new spreadsheet',
    append_row: 'Adding a row',
    update_range: 'Updating a spreadsheet',
    delete: 'Deleting that spreadsheet',
  },
  device_: {
    volume_up: 'Turning it up',
    volume_down: 'Turning it down',
    volume_mute: 'Muting the volume',
  },
  media_: {
    play_pause: 'Toggling playback',
    next_track: 'Skipping to the next track',
    previous_track: 'Going back a track',
    stop: 'Stopping playback',
  },
};

const PREFIX_DEFAULT_LABELS: Record<string, string> = {
  gmail_: 'Checking email',
  calendar_: 'Checking the calendar',
  tasks_: 'Checking tasks',
  tasklist_: 'Checking task lists',
  contacts_: 'Flipping through contacts',
  files_: 'Working with your files',
  document_: 'Editing a document',
  sheets_: 'Working in spreadsheets',
  device_: 'Adjusting the device',
  media_: 'Controlling playback',
};

const TOOL_GROUP_LABELS: Record<string, string> = {
  calendar: 'calendar',
  email: 'email',
  tasks: 'tasks',
  contacts: 'contacts',
  files: 'files',
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

/** Strip trailing ASCII or unicode ellipses from status copy. */
export function normalizeAssistantStatusBase(line: string): string {
  return line.replace(/\u2026+$/u, '').replace(/\.{1,3}$/, '').trimEnd();
}

function titleCaseWords(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function titleCaseFromSnake(tool: string): string {
  return titleCaseWords(tool.replace(/_/g, ' '));
}

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
  if (labels.length === 1) return `Preparing ${labels[0]} tools`;
  if (labels.length === 2) return `Preparing ${labels[0]} and ${labels[1]} tools`;
  return `Preparing ${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]} tools`;
}

function hintForCalendarList(args: Record<string, unknown>, timeZone: string): string | null {
  const query = stringArg(args, 'q');
  if (query) return `Searching the calendar for "${truncateQuery(query)}"`;

  const timeMin = stringArg(args, 'time_min_iso', 'time_min');
  const timeMax = stringArg(args, 'time_max_iso', 'time_max');

  if (timeMin && timeMax) {
    const range = describeCalendarRange(timeMin, timeMax, timeZone);
    if (range) return `Flipping through the calendar for ${range}`;
  }

  if (timeMin) {
    const min = parseIso(timeMin);
    if (min) return `Flipping through the calendar for ${relativeDayLabel(min, timeZone)}`;
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
  if (labels.length === 1) return `Checking ${labels[0]}`;
  if (labels.length === 2) return `Checking ${labels[0]} and ${labels[1]}`;
  return `Checking ${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
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

function statusHintForTool(
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
      return hintForSearchTool('Searching the inbox', args);
    case 'gmail_list':
      return hintForSearchTool('Scanning the inbox', args);
    case 'search_memory':
      return hintForSearchTool('Digging through memory', args);
    case 'search_interactions':
      return hintForSearchTool('Searching conversations', args);
    case 'web_search':
      return hintForSearchTool('Checking Google', args);
    case 'contacts_search':
      return hintForSearchTool('Searching contacts', args);
    case 'files_search':
      return hintForSearchTool('Searching your files', args);
    case 'maps_search_places':
      return hintForSearchTool('Checking the map', args);
    case 'get_client_context':
      return hintForGetClientContext(args);
    case 'gmail_send':
      return hintForGmailSend(args);
    case 'get_current_time':
      return stringArg(args, 'timezone')
        ? `Checking time in ${stringArg(args, 'timezone')}`
        : null;
    default:
      return null;
  }
}

function labelFromPrefix(tool: string): string | null {
  for (const [prefix, actions] of Object.entries(PREFIX_ACTION_LABELS)) {
    if (!tool.startsWith(prefix)) continue;
    const suffix = tool.slice(prefix.length);
    const actionLabel = actions[suffix];
    if (actionLabel) return actionLabel;
    return PREFIX_DEFAULT_LABELS[prefix] ?? null;
  }
  return null;
}

/** Human label for a backend tool name (voice command SSE). */
export function commandToolLabel(tool: string): string {
  if (!tool || tool.startsWith('_')) return '';
  const mapped = TOOL_LABELS[tool];
  if (mapped) return mapped;
  const prefixed = labelFromPrefix(tool);
  if (prefixed) return prefixed;
  return titleCaseFromSnake(tool);
}

/** Status line body for a tool (no ellipses — UI animates those). */
export function commandToolStatusLabel(
  tool: string,
  args?: Record<string, unknown> | null,
  options?: { timeZone?: string },
): string {
  const hint = statusHintForTool(tool, args, options?.timeZone);
  if (hint) return normalizeAssistantStatusBase(hint);
  const label = commandToolLabel(tool);
  return label ? normalizeAssistantStatusBase(label) : '';
}

/** Title-case status copy from the server or defaults (e.g. Thinking). */
export function formatAssistantStatusLine(line: string): string {
  return titleCaseWords(normalizeAssistantStatusBase(line));
}
