export type CommandState =
  | 'idle'
  | 'listening'
  /** User finished speaking; mic spinner only until transcript arrives. */
  | 'transcribing'
  | 'thinking'
  | 'responding'
  | 'follow_up'
  | 'locked';

/** pending/status = tool labels; streaming = buffering tokens; revealing = typewriter after done. */
export type AssistantBubbleStatus = 'pending' | 'streaming' | 'revealing' | 'done';
