export const API_CONFIG = {
  TIMEOUTS: {
    DEFAULT: 10000,
    INTERACTION: 30000,
    SERVICE_STOP: 10000,
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

  // Service
  SERVICE_CLIENTS: '/service/clients',
  SERVICE_CLIENT_BY_ID: '/service/clients/:clientId',
  SERVICE_NETWORK_ENABLE: '/service/network/enable',
  SERVICE_NETWORK_DISABLE: '/service/network/disable',

  // Interactions
  INTERACTIONS: '/interactions',
  INTERACTIONS_REGISTER: '/interactions/register',
  INTERACTION_BY_ID: '/interactions/:interactionId',

  // Persons
  PERSONS: '/persons',
  PERSON_BY_ID: '/persons/:personId',

  // Conversations
  CONVERSATIONS: '/conversations',
  CONVERSATION_BY_ID: '/conversations/:conversationId',

  MEMORIES: '/memories',
  ACTIONS: '/actions',
  ACTION_BY_ID: '/actions/:actionId',
  COMMAND: '/command',
} as const;