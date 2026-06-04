export { default as AssistantLayout } from './pages/AssistantLayout';
export { default as LoginPage } from './pages/LoginPage';

export { AuthProvider, AuthContext, useAuth } from './contexts/AuthContext';
export { ServiceProvider, ServiceContext, useService } from './contexts/ServiceContext';
export { AudioProvider, AudioContext, useAudio } from './contexts/AudioContext';
export {
  CommandProvider,
  useCommand,
  CommandBubbleStackHost,
} from './contexts/CommandContext';
export type { CommandState, CommandMode } from './contexts/CommandContext';
export { default as CommandBubble } from './components/command/CommandBubble';
export {
  NotificationProvider,
  useNotifications,
} from './contexts/NotificationContext';
export type { ShowBannerInput, BannerItem } from './contexts/NotificationContext';

export { default as Header } from './components/Header';
export { default as MicrophoneButton } from './components/MicrophoneButton';
export { default as InteractionPanel } from './components/interaction-panel';
export { default as Banner } from './components/notifications/Banner';
export { default as Toast } from './components/notifications/Toast';
export { default as PeoplePanel } from './components/PersonsPanel';
export { TutorialOverlay, TutorialProvider } from './components/tutorial';
export { default as SubscribePage } from './pages/SubscribePage';
