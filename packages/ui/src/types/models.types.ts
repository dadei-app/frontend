/** In-flight proposed action from realtime `action_queue` pushes. */
export type ActionOperation = 'create' | 'update' | 'delete';

export interface NetworkAction {
  id: string;
  network_id: string;
  action_type: string;
  operation?: ActionOperation | null;
  /** Present on proposed actions; used to derive operation when omitted. */
  tool_name?: string | null;
  status: string;
  title: string | null;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
  start_time: string | null;
  end_time: string | null;
  conversation_id: string | null;
  interaction_id: string | null;
  scheduled_job_id?: string | null;
  /** True when this action owns the network countdown slot. */
  is_active?: boolean;
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
