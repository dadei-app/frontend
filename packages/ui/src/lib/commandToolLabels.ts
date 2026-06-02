const TOOL_LABELS: Record<string, string> = {
  create_calendar_event: 'Creating Calendar Event',
  create_task: 'Creating Task',
  store_memory: 'Saving Memory',
  search_memory: 'Searching Memory',
  get_current_time: 'Getting The Time',
  send_email: 'Sending Email',
  web_search: 'Searching The Web',
  update_memory: 'Updating Memory',
  update_action: 'Updating Action',
  list_calendar_events: 'Checking Your Calendar',
  calendar_list_events: 'Checking Your Calendar',
  update_calendar_event: 'Updating Calendar Event',
  delete_calendar_event: 'Deleting Calendar Event',
  list_tasks: 'Checking Tasks',
  update_task: 'Updating Task',
  delete_task: 'Deleting Task',
  search_contacts: 'Finding A Contact',
  read_email: 'Reading Email',
  search_email: 'Searching Email',
  search_interactions: 'Searching Past Conversations',
  query_person_memory: 'Recalling What I Know',
  assign_person_name: 'Saving A Name',
  get_weather: 'Checking The Weather',
  get_weather_forecast: 'Checking The Forecast',
  get_current_location: 'Getting Your Location',
  get_client_context: 'Getting Client Context',
  maps_search_places: 'Searching For A Location',
  maps_directions: 'Getting Directions',
  maps_distance_matrix: 'Checking Travel Time',
  load_tool_groups: 'Summoning Specialist Tools',
  end_assistant_session: 'Ending Session',
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

/** Human label for a backend tool name (voice command SSE). */
export function commandToolLabel(tool: string): string {
  if (!tool || tool.startsWith('_')) return '';
  const mapped = TOOL_LABELS[tool];
  if (mapped) return mapped;
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
