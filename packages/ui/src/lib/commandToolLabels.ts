const TOOL_LABELS: Record<string, string> = {
  create_calendar_event: 'Creating calendar event',
  create_task: 'Creating task',
  store_memory: 'Saving memory',
  search_memory: 'Searching memory',
  get_current_time: 'Getting the time',
  send_email: 'Sending email',
  web_search: 'Searching the web',
  update_memory: 'Updating memory',
  update_action: 'Updating action',
  list_calendar_events: 'Checking your calendar',
  update_calendar_event: 'Updating event',
  delete_calendar_event: 'Deleting event',
  list_tasks: 'Checking tasks',
  update_task: 'Updating task',
  delete_task: 'Deleting task',
  search_contacts: 'Finding a contact',
  read_email: 'Reading email',
  search_email: 'Searching email',
  search_interactions: 'Searching past conversations',
  query_person_memory: 'Recalling what I know',
  assign_person_name: 'Saving a name',
  get_weather: 'Checking the weather',
  get_weather_forecast: 'Checking the forecast',
  maps_search_places: 'Finding your location',
  maps_directions: 'Getting directions',
  maps_distance_matrix: 'Checking travel time',
  end_assistant_session: 'Ending session',
};

/** Human label for a backend tool name (voice command SSE). */
export function commandToolLabel(tool: string): string {
  if (!tool || tool.startsWith('_')) return '';
  const mapped = TOOL_LABELS[tool];
  if (mapped) return mapped;
  return tool.replace(/_/g, ' ');
}
