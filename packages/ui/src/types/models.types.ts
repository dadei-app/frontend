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

/** Persisted Action row from GET /actions or realtime `action` events. */
export interface NetworkAction {
  id: string;
  action_type: string;
  details: string | null;
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

/** Episodic memory from GET /memories or realtime `episodic_memory` events. */
export interface EpisodicMemory {
  id: string;
  network_id: string;
  source_conversation_id: string;
  memory_type: string;
  status: string;
  canonical_text: string;
  action_kind: string | null;
  participant_person_ids: unknown;
  proposed_start_at: string | null;
  proposed_end_at: string | null;
  expires_at: string | null;
  confidence: number | null;
  provenance: unknown;
  transition_history: unknown;
  created_at: string;
  updated_at: string;
}

// Toast notifications
export type ToastType = 'success' | 'error' | 'warning' | 'info';