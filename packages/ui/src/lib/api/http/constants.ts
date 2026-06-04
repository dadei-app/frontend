export const API_CONFIG = {
  TIMEOUTS: {
    DEFAULT: 10000,
    INTERACTION: 30000,
    SERVICE_STOP: 10000,
    /** Wake-word claim can queue behind Whisper / passive ingest on a single API worker. */
    ASSISTANT_MODE: 30000,
  },

  RETRY: {
    MAX_ATTEMPTS: 2,
    BACKOFF_MS: 1000,
  },
} as const;

export const ENDPOINTS = {
  STATUS: '/',

  // Auth
  AUTH_LOGIN: '/auth/login',
  AUTH_REGISTER: '/auth/register',
  AUTH_REFRESH: '/auth/refresh',
  AUTH_GOOGLE_URL: '/auth/google/url',
  AUTH_GOOGLE_CALLBACK: '/auth/google/callback',
  /** Browser redirect flow (backend must implement). */
  AUTH_GOOGLE_WEB_LOGIN: '/auth/google/web/login',
  AUTH_ME: '/auth/me',
  TUTORIAL_COMPLETE: '/tutorial/complete',

  // Service
  SERVICE_CLIENTS: '/service/clients',
  SERVICE_INTEGRATIONS_STATUS: '/service/integrations/status',
  SERVICE_CLIENT_BY_ID: '/service/clients/:clientId',
  SERVICE_NETWORK_ENABLE: '/service/network/enable',
  SERVICE_NETWORK_DISABLE: '/service/network/disable',
  SERVICE_ASSISTANT_MODE_CLAIM: '/service/network/assistant-mode/claim',
  SERVICE_ASSISTANT_MODE_RELEASE: '/service/network/assistant-mode/release',

  // Interactions
  INTERACTIONS: '/interactions',
  INTERACTIONS_REGISTER: '/interactions/register',
  INTERACTION_BY_ID: '/interactions/:interactionId',

  // Persons
  PERSONS: '/persons',
  PERSON_BY_ID: '/persons/:personId',
  PERSON_RETRAIN_VOICE: '/persons/user/retrain-voice',

  // Conversations
  CONVERSATIONS: '/conversations',
  CONVERSATION_BY_ID: '/conversations/:conversationId',

  // Network memory API (same API prefix as client; v2 when BETA=true): episodic facts + structured actions
  MEMORIES: '/memories',
  MEMORY_BY_ID: '/memories/:memoryId',
  ACTIONS: '/actions',
  ACTION_BY_ID: '/actions/:actionId',
  COMMAND: '/service/command',
  COMMAND_TEXT: '/service/command/text',
} as const;