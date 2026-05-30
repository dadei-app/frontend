export { default as AssistantLayout } from './pages/AssistantLayout';
export { default as LoginPage } from './pages/LoginPage';

export { AuthProvider, AuthContext, useAuth } from './contexts/AuthContext';
export { ServiceProvider, ServiceContext, useService } from './contexts/ServiceContext';
export { AudioProvider, AudioContext, useAudio } from './contexts/AudioContext';
export { CommandProvider, useCommand } from './contexts/CommandContext';
export type { CommandState, CommandMode } from './contexts/CommandContext';
export { default as MicLevelIndicator } from './components/command/MicLevelIndicator';
export { default as MicLevelIndicator2 } from './components/command/MicLevelIndicator2';
export { default as TextBubble } from './components/command/TextBubble';
export {
  NotificationProvider,
  useNotifications,
} from './contexts/NotificationContext';
export type { ShowBannerInput, BannerItem } from './contexts/NotificationContext';

export { default as LoginOverlay } from './components/modals/LoginModal';
export { default as Header } from './components/Header';
export { default as MicrophoneButton } from './components/MicrophoneButton';
export { default as InteractionPanel } from './components/interaction-panel';
export { default as Banner } from './components/ui/Banner';
export { default as Toast } from './components/ui/Toast';
export { default as PeoplePanel } from './components/PeoplePanel';
