import {
  Battery,
  Clock3,
  CloudSun,
  Globe,
  MapPin,
  MonitorSmartphone,
  Music,
  Navigation,
  Route,
  Ruler,
  Volume2,
  AppWindow,
  type LucideIcon,
} from 'lucide-react';
import { resolveWorkspaceToolLogo } from '@dadei/ui/components/settings/integrations/integrationIcons';

export type ScopeItem = {
  label: string;
  detail?: string;
};

export type WorkspaceProviderId = 'google' | 'microsoft' | 'apple';

export type WorkspaceProvider = {
  id: WorkspaceProviderId;
  label: string;
  networkEmail: string;
  linkedEmail?: string;
  comingSoon?: boolean;
};

export type IntegrationTool = {
  id: string;
  name: string;
  short: string;
  logo?: LogoDef;
  Icon?: LucideIcon;
  scopes: ScopeItem[];
  providers?: WorkspaceProviderId[];
};

export type IntegrationCategory = {
  id: string;
  label: string;
  short: string;
  tools: IntegrationTool[];
  workspace?: boolean;
};

export const WORKSPACE_PROVIDERS: WorkspaceProvider[] = [
  {
    id: 'google',
    label: 'Google',
    networkEmail: 'you@gmail.com',
  },
  {
    id: 'microsoft',
    label: 'Microsoft',
    networkEmail: 'you@gmail.com',
    linkedEmail: 'you@company.com',
  },
  {
    id: 'apple',
    label: 'Apple',
    networkEmail: 'you@gmail.com',
    comingSoon: true,
  },
];

export const ACCOUNT_FEATURES = [
  {
    id: 'sign-in',
    title: 'Sign in with any provider',
    body: 'Google, Microsoft, or Apple — matching emails link to the same network automatically.',
  },
  {
    id: 'link',
    title: 'Mix personal & work accounts',
    body: 'Connect additional providers in Settings, even when the email differs from your network.',
  },
  {
    id: 'defaults',
    title: 'Pick smart defaults',
    body: 'Choose which connected account handles mail, calendar, and contacts by default.',
  },
] as const;

const WORKSPACE_TOOLS: IntegrationTool[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    short: 'send only',
    providers: ['google'],
    scopes: [
      { label: 'send', detail: 'compose & deliver outbound mail' },
    ],
  },
  {
    id: 'mail',
    name: 'Outlook',
    short: 'inbox & send',
    providers: ['microsoft'],
    scopes: [
      { label: 'read', detail: 'list messages & open threads' },
      { label: 'search', detail: 'find mail by sender or subject' },
      { label: 'send', detail: 'compose & deliver outbound mail' },
      { label: 'modify', detail: 'move, flag, or archive messages' },
    ],
  },
  {
    id: 'calendar',
    name: 'Calendar',
    short: 'schedule & meetings',
    providers: ['google', 'microsoft', 'apple'],
    scopes: [
      { label: 'read', detail: 'list events & inspect details' },
      { label: 'create', detail: 'book new events & reminders' },
      { label: 'update', detail: 'reschedule or change attendees' },
      { label: 'delete', detail: 'cancel events from your calendar' },
    ],
  },
  {
    id: 'contacts',
    name: 'Contacts',
    short: 'people lookup',
    providers: ['google', 'microsoft', 'apple'],
    scopes: [
      { label: 'read', detail: 'list & open contact records' },
      { label: 'search', detail: 'find people by name or email' },
      { label: 'create', detail: 'add new contacts' },
      { label: 'update', detail: 'edit names, emails, phone numbers' },
    ],
  },
  {
    id: 'tasks',
    name: 'Tasks',
    short: 'to-do lists',
    providers: ['google', 'microsoft'],
    scopes: [
      { label: 'read', detail: 'list tasks & task lists' },
      { label: 'create', detail: 'add tasks with due dates & notes' },
      { label: 'update', detail: 'mark complete or edit details' },
      { label: 'delete', detail: 'remove tasks & lists' },
    ],
  },
  {
    id: 'docs',
    name: 'Docs',
    short: 'documents',
    providers: ['google'],
    scopes: [
      { label: 'read', detail: 'open documents & extract text' },
      { label: 'search', detail: 'find docs by name (app-created with drive.file)' },
      { label: 'create', detail: 'start new Google Docs' },
      { label: 'update', detail: 'append or replace document text' },
    ],
  },
  {
    id: 'docs',
    name: 'Word',
    short: 'documents',
    providers: ['microsoft'],
    scopes: [
      { label: 'read', detail: 'open Word documents & extract text' },
      { label: 'search', detail: 'find documents across OneDrive' },
      { label: 'create', detail: 'start new Word documents' },
      { label: 'update', detail: 'append or replace document text' },
    ],
  },
  {
    id: 'sheets',
    name: 'Sheets',
    short: 'spreadsheets',
    providers: ['google', 'microsoft'],
    scopes: [
      { label: 'read', detail: 'read cell ranges by spreadsheet ID' },
      { label: 'list', detail: 'browse spreadsheets (Google: app-created; Microsoft: full OneDrive)' },
      { label: 'create', detail: 'start new spreadsheets' },
      { label: 'update', detail: 'append rows or write cell ranges' },
    ],
  },
];

export function workspaceToolsForProvider(providerId: WorkspaceProviderId): IntegrationTool[] {
  return WORKSPACE_TOOLS.filter(tool => tool.providers?.includes(providerId));
}

export function defaultWorkspaceToolId(providerId: WorkspaceProviderId): string {
  const tools = workspaceToolsForProvider(providerId);
  if (providerId === 'microsoft') return tools.find(t => t.id === 'mail')?.id ?? tools[0]?.id ?? 'mail';
  if (providerId === 'apple') return tools.find(t => t.id === 'calendar')?.id ?? tools[0]?.id ?? 'calendar';
  return tools.find(t => t.id === 'gmail')?.id ?? tools[0]?.id ?? 'gmail';
}

export const INTEGRATION_CATEGORIES: IntegrationCategory[] = [
  {
    id: 'workspace',
    label: 'Connected accounts',
    short: 'Google, Microsoft & Apple',
    workspace: true,
    tools: WORKSPACE_TOOLS,
  },
  {
    id: 'mapping',
    label: 'Mapping data',
    short: 'places, routes & location',
    tools: [
      {
        id: 'geolocation',
        name: 'Geolocation',
        short: 'where am I',
        Icon: MapPin,
        scopes: [
          { label: 'local', detail: 'live coords from desktop client' },
          { label: 'remote', detail: 'coordinates for any lat/lng' },
          { label: 'reverse geocode', detail: 'coords → street address' },
          { label: 'formatted address', detail: 'human-readable place name' },
        ],
      },
      {
        id: 'places',
        name: 'Places search',
        short: 'find nearby & named spots',
        Icon: Navigation,
        scopes: [
          { label: 'near me', detail: 'search around current location' },
          { label: 'text search', detail: 'query by name, category, or address' },
          { label: 'place details', detail: 'hours, rating, phone, website' },
          { label: 'coordinates', detail: 'lat/lng for any result' },
        ],
      },
      {
        id: 'routes',
        name: 'Routes & directions',
        short: 'simulate a trip',
        Icon: Route,
        scopes: [
          { label: 'driving', detail: 'turn-by-turn driving directions' },
          { label: 'walking', detail: 'pedestrian routes' },
          { label: 'transit', detail: 'public transport options' },
          { label: 'multi-stop', detail: 'origin → destination wayfinding' },
        ],
      },
      {
        id: 'distance',
        name: 'Distance & traffic',
        short: 'ETA & travel time',
        Icon: Ruler,
        scopes: [
          { label: 'travel time', detail: 'duration between two points' },
          { label: 'traffic-aware', detail: 'live congestion in ETA' },
          { label: 'distance matrix', detail: 'compare multiple origins/destinations' },
          { label: 'mode selection', detail: 'driving, walking, or transit' },
        ],
      },
    ],
  },
  {
    id: 'client',
    label: 'Client data',
    short: 'desktop device control',
    tools: [
      {
        id: 'volume',
        name: 'Volume & audio',
        short: 'system sound levels',
        Icon: Volume2,
        scopes: [
          { label: 'set level', detail: 'target 0–100% volume' },
          { label: 'volume up', detail: 'increment system volume' },
          { label: 'volume down', detail: 'decrement system volume' },
          { label: 'mute', detail: 'toggle or force mute' },
        ],
      },
      {
        id: 'media',
        name: 'Media playback',
        short: 'control what is playing',
        Icon: Music,
        scopes: [
          { label: 'play / pause', detail: 'toggle active media' },
          { label: 'next track', detail: 'skip forward' },
          { label: 'previous track', detail: 'skip back' },
          { label: 'stop', detail: 'halt playback' },
        ],
      },
      {
        id: 'system',
        name: 'System control',
        short: 'lock, sleep & display',
        Icon: MonitorSmartphone,
        scopes: [
          { label: 'lock device', detail: 'lock the desktop session' },
          { label: 'sleep', detail: 'put device to sleep' },
          { label: 'dark mode', detail: 'toggle system appearance' },
          { label: 'do not disturb', detail: 'toggle focus / DND mode' },
        ],
      },
      {
        id: 'windows',
        name: 'Apps & windows',
        short: 'launch & manage apps',
        Icon: AppWindow,
        scopes: [
          { label: 'open app', detail: 'launch by name' },
          { label: 'close focused', detail: 'quit the active application' },
          { label: 'minimize', detail: 'minimize the focused window' },
        ],
      },
      {
        id: 'sensors',
        name: 'Device sensors',
        short: 'battery & screen capture',
        Icon: Battery,
        scopes: [
          { label: 'battery', detail: 'charge level & power state' },
          { label: 'screenshot', detail: 'capture the desktop screen' },
        ],
      },
      {
        id: 'context',
        name: 'Client context',
        short: 'live device metadata',
        Icon: MapPin,
        scopes: [
          { label: 'timezone', detail: 'IANA zone from active client' },
          { label: 'location', detail: 'live GPS / coords from desktop' },
          { label: 'client type', detail: 'web vs electron session' },
        ],
      },
    ],
  },
  {
    id: 'realtime',
    label: 'Realtime',
    short: 'always on — no OAuth',
    tools: [
      {
        id: 'web',
        name: 'Web search',
        short: 'fresh public information',
        Icon: Globe,
        scopes: [
          { label: 'web results', detail: 'Brave Search title, URL, and snippet' },
          { label: 'top matches', detail: 'ranked result list for the query' },
          { label: 'public web', detail: 'no account required' },
        ],
      },
      {
        id: 'weather',
        name: 'Weather',
        short: 'conditions & forecasts',
        Icon: CloudSun,
        scopes: [
          { label: 'local', detail: 'weather at your current coords' },
          { label: 'remote', detail: 'weather at any lat/lng or place' },
          { label: 'forecast', detail: 'multi-day outlook' },
        ],
      },
      {
        id: 'time',
        name: 'Current time',
        short: 'timezone-aware clocks',
        Icon: Clock3,
        scopes: [
          { label: 'account timezone', detail: 'your saved IANA zone' },
          { label: 'any timezone', detail: 'convert to Tokyo, UTC, etc.' },
          { label: 'always on', detail: 'no authorization needed' },
        ],
      },
    ],
  },
];

export function workspaceToolDisplayName(tool: IntegrationTool, provider: WorkspaceProviderId): string {
  if (provider === 'microsoft') {
    const microsoftNames: Partial<Record<string, string>> = {
      mail: 'Outlook',
      files: 'OneDrive',
      docs: 'Word',
      sheets: 'Excel',
      tasks: 'To Do',
    };
    if (microsoftNames[tool.id]) return microsoftNames[tool.id]!;
  }

  if (provider === 'google') {
    const googleNames: Partial<Record<string, string>> = {
      gmail: 'Gmail',
      drive: 'Drive',
      files: 'Drive',
      sheets: 'Sheets',
      docs: 'Docs',
    };
    if (googleNames[tool.id]) return googleNames[tool.id]!;
  }

  return tool.name;
}

export function toolsForCategory(
  category: IntegrationCategory,
  workspaceProvider: WorkspaceProviderId,
): IntegrationTool[] {
  if (!category.workspace) return category.tools;
  return workspaceToolsForProvider(workspaceProvider).map(tool => ({
    ...tool,
    name: workspaceToolDisplayName(tool, workspaceProvider),
    logo: resolveWorkspaceToolLogo(tool.id, workspaceProvider),
  }));
}

export const INTEGRATION_TOOL_COUNT = INTEGRATION_CATEGORIES.reduce(
  (sum, category) => sum + category.tools.length,
  0,
);
