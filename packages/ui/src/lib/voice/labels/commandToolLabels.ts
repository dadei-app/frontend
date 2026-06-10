const TOOL_LABELS: Record<string, string> = {
  // Session & meta
  load_tool_groups: 'Preparing my tools',
  end_assistant_session: 'Wrapping up',

  // Time, location, weather
  get_current_time: 'Checking the time',
  get_current_location: 'Pinpointing your location',
  get_weather: 'Checking the weather',
  get_weather_forecast: 'Looking at the forecast',
  get_client_context: "Talking to your device",

  // Memory & context
  store_memory: 'Making a mental note',
  search_memory: 'Digging through my memory',
  query_person_memory: 'Recalling someone\'s information',
  assign_person_name: 'Saving someone\'s name',
  search_interactions: 'Searching conversations',

  // Web & maps
  web_search: 'Checking Google',
  maps_search_places: 'Checking the map',
  maps_directions: 'Plotting the route',
  maps_distance_matrix: 'Simulating a trip',

  // Calendar
  calendar_create: 'Creating a calendar event',
  calendar_list: 'Checking the calendar',
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

  // Docs
  docs_create: 'Creating a doc',
  docs_list: 'Flipping through docs',
  docs_read: 'Reading a doc',
  docs_append: 'Adding to a doc',
  docs_update: 'Updating a doc',
  docs_delete: 'Deleting a doc',

  // Drive
  drive_list_files: 'Sorting through drive files',
  drive_search_files: 'Searching drive files',
  drive_get_file: 'Opening a drive file',
  drive_create_file: 'Creating a drive file',
  drive_update_file_metadata: 'Updating a drive file',
  drive_delete_file: 'Deleting a drive file',

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
    list: 'Scanning my inbox',
    read: 'Opening that email',
    search: 'Searching my inbox',
    send: 'Sending an email',
    delete: 'Moving that to trash',
    modify_labels: 'Updating email labels',
  },
  calendar_: {
    list: 'Checking my calendar',
    create: 'Adding a calendar event',
    get: 'Looking at that calendar event',
    update: 'Updating a calendar event',
    delete: 'Removing a calendar event',
  },
  tasks_: {
    list: 'Checking my tasks',
    create: 'Adding a task',
    get: 'Looking at that task',
    update: 'Updating my task',
    delete: 'Removing that task',
  },
  tasklist_: {
    list: 'Checking my task lists',
    create: 'Creating a task list',
    delete: 'Deleting that task list',
  },
  contacts_: {
    list: 'Looking through my contacts',
    search: 'Finding someone\'s contact',
    create: 'Adding a contact',
    get: 'Opening a contact',
    update: 'Updating a contact',
    delete: 'Removing a contact',
  },
  docs_: {
    list: 'Looking through my docs',
    read: 'Opening that doc',
    create: 'Starting a new doc',
    append: 'Adding to my doc',
    update: 'Updating my doc',
    delete: 'Deleting that doc',
  },
  drive_: {
    list_files: 'Sorting through my drive',
    search_files: 'Searching my drive',
    get_file: 'Opening that file',
    create_file: 'Creating a file',
    update_file_metadata: 'Updating file details',
    delete_file: 'Removing from my drive',
  },
  sheets_: {
    list: 'Looking through my spreadsheets',
    read: 'Opening that spreadsheet',
    create: 'Starting a new spreadsheet',
    append_row: 'Adding a row',
    update_range: 'Updating my spreadsheet',
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
  gmail_: 'Checking my email',
  calendar_: 'Checking my calendar',
  tasks_: 'Checking my tasks',
  tasklist_: 'Checking my task lists',
  contacts_: 'Looking through my contacts',
  docs_: 'Working in my docs',
  drive_: 'Sorting through my drive',
  sheets_: 'Working in my spreadsheets',
  device_: 'Adjusting the device',
  media_: 'Controlling playback',
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
export function commandToolStatusLabel(tool: string): string {
  const label = commandToolLabel(tool);
  return label ? normalizeAssistantStatusBase(label) : '';
}

/** Title-case status copy from the server or defaults (e.g. Thinking). */
export function formatAssistantStatusLine(line: string): string {
  return titleCaseWords(normalizeAssistantStatusBase(line));
}
