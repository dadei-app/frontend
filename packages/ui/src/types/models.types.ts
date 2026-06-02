/** Persisted Action row from GET /actions or realtime `action` events. */
export interface NetworkAction {
  id: string;
  action_type: string;
  details: string | null;
  tool_name: string | null;
  description: string | null;
  location: string | null;
  attendee_emails: string[] | null;
  calendar_id: string | null;
  notes: string | null;
  tasklist_id: string | null;
  recipient_to: string | null;
  recipient_cc: string | null;
  recipient_bcc: string | null;
  body: string | null;
  canonical_text: string | null;
  evidence_quotes: string[] | null;
  execution_context: Record<string, unknown> | null;
  status: string;
  scheduled_time: string | null;
  completed_time: string | null;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  external_id: string | null;
  external_service: string | null;
  scheduled_at: string | null;
  scheduled_job_id: string | null;
  source_memory_id: string | null;
  created_at: string;
  updated_at: string;
  interaction_id: string | null;
  conversation_id: string | null;
  network_id: string;
}

export type CalendarAction = NetworkAction & {
  action_type: 'calendar' | 'calendar_event';
};

export type TaskAction = NetworkAction & {
  action_type: 'todo' | 'task';
};

export type MailAction = NetworkAction & {
  action_type: 'email' | 'message';
};

const CALENDAR_TYPES = new Set(['calendar', 'calendar_event']);
const TASK_TYPES = new Set(['todo', 'task']);
const MAIL_TYPES = new Set(['email', 'message']);

export function isCalendarAction(action: NetworkAction): action is CalendarAction {
  return CALENDAR_TYPES.has(action.action_type);
}

export function isTaskAction(action: NetworkAction): action is TaskAction {
  return TASK_TYPES.has(action.action_type);
}

export function isMailAction(action: NetworkAction): action is MailAction {
  return MAIL_TYPES.has(action.action_type);
}

/** Episodic memory from GET /memories. */
export interface EpisodicMemory {
  id: string;
  network_id: string;
  source_conversation_id: string | null;
  memory_type: string;
  status: string;
  canonical_text: string;
  participant_person_ids: unknown;
  expires_at: string | null;
  confidence: number | null;
  provenance: EpisodicMemoryProvenance | null;
  details: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface EpisodicMemoryProvenance {
  interaction_ids?: string[];
  evidence_quotes?: string[];
  source?: string;
}

export interface Person {
  id: string;
  name: string | null;
  index: number;
  network_id: string;
  created_at: string;
  updated_at: string;
}

export interface Interaction {
  id: string;
  text: string;
  timestamp: string;
  network_id: string;
  person_id: string;
  conversation_id: string;
  sentiment: number | null;
}

export interface Conversation {
  id: string;
  started_at: string;
  topic_summary: string | null;
  context_summary: string | null;
  is_active: boolean;
}

// Toast notifications
export type ToastType = 'success' | 'error' | 'warning' | 'info';
