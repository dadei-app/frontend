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
import {
  GOOGLE_LOGOS,
  type LogoDef,
} from '@dadei/ui/components/settings/integrations/integrationIcons';

export type ScopeItem = {
  label: string;
  detail?: string;
};

export type IntegrationTool = {
  id: string;
  name: string;
  short: string;
  logo?: LogoDef;
  Icon?: LucideIcon;
  scopes: ScopeItem[];
};

export type IntegrationCategory = {
  id: string;
  label: string;
  short: string;
  tools: IntegrationTool[];
};

export const INTEGRATION_CATEGORIES: IntegrationCategory[] = [
  {
    id: 'google',
    label: 'Google Workspace',
    short: 'connect once via OAuth',
    tools: [
      {
        id: 'gmail',
        name: 'Gmail',
        short: 'inbox & send',
        logo: GOOGLE_LOGOS.gmail,
        scopes: [
          { label: 'read', detail: 'list threads & open messages' },
          { label: 'search', detail: 'query inbox by sender, subject, or date' },
          { label: 'send', detail: 'compose & deliver outbound mail' },
          { label: 'modify', detail: 'labels, archive, mark read/unread' },
          { label: 'delete', detail: 'remove messages permanently' },
        ],
      },
      {
        id: 'calendar',
        name: 'Calendar',
        short: 'schedule & meetings',
        logo: GOOGLE_LOGOS.calendar,
        scopes: [
          { label: 'read', detail: 'list events & inspect details' },
          { label: 'create', detail: 'book new events & reminders' },
          { label: 'update', detail: 'reschedule, rename, or change attendees' },
          { label: 'delete', detail: 'cancel events from your calendar' },
        ],
      },
      {
        id: 'contacts',
        name: 'Contacts',
        short: 'people lookup',
        logo: GOOGLE_LOGOS.contacts,
        scopes: [
          { label: 'read', detail: 'list & open contact records' },
          { label: 'search', detail: 'find people by name or email' },
          { label: 'create', detail: 'add new contacts' },
          { label: 'update', detail: 'edit names, emails, phone numbers' },
          { label: 'delete', detail: 'remove contacts' },
        ],
      },
      {
        id: 'tasks',
        name: 'Tasks',
        short: 'to-do lists',
        logo: GOOGLE_LOGOS.tasks,
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
        short: 'docs read & write',
        logo: GOOGLE_LOGOS.docs,
        scopes: [
          { label: 'read', detail: 'open & read document content' },
          { label: 'create', detail: 'start new Google Docs' },
          { label: 'append', detail: 'add text to the end of a doc' },
          { label: 'update', detail: 'replace or edit existing content' },
          { label: 'delete', detail: 'remove documents' },
        ],
      },
      {
        id: 'drive',
        name: 'Drive',
        short: 'app files only',
        logo: GOOGLE_LOGOS.drive,
        scopes: [
          { label: 'read', detail: 'list & inspect files dadei created' },
          { label: 'search', detail: 'find files by name or type' },
          { label: 'create', detail: 'upload or create new files' },
          { label: 'update', detail: 'rename or change file metadata' },
          { label: 'delete', detail: 'remove app-scoped files' },
        ],
      },
      {
        id: 'sheets',
        name: 'Sheets',
        short: 'sheets & cells',
        logo: GOOGLE_LOGOS.sheets,
        scopes: [
          { label: 'read', detail: 'read ranges & cell values' },
          { label: 'create', detail: 'start new spreadsheets' },
          { label: 'append', detail: 'add rows to existing sheets' },
          { label: 'update', detail: 'write to specific cell ranges' },
          { label: 'delete', detail: 'remove spreadsheets' },
        ],
      },
    ],
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
          { label: 'now playing', detail: 'read title, artist, app' },
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
          { label: 'fullscreen', detail: 'toggle focused window fullscreen' },
          { label: 'dismiss notifications', detail: 'clear notification center' },
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
          { label: 'instant answers', detail: 'DuckDuckGo abstract text' },
          { label: 'related topics', detail: 'linked follow-up queries' },
          { label: 'public web', detail: 'no Google account required' },
          { label: 'news & facts', detail: 'time-sensitive public info' },
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
          { label: 'current', detail: 'live conditions right now' },
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
          { label: 'scheduling', detail: 'sanity-check meeting times' },
          { label: 'always on', detail: 'no authorization needed' },
        ],
      },
    ],
  },
];
