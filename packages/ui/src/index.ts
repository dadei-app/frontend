export { default as AssistantLayout } from './pages/AssistantLayout';
export { default as LoginPage } from './pages/LoginPage';
export { default as OAuthCallback } from './pages/OAuthCallback';

export { AuthProvider, AuthContext, useAuth } from './contexts/AuthContext';
export {
  AssistantRuntimeProvider,
  useAssistantRuntime,
  useAssistantRuntimeActions,
  useAssistantRuntimeState,
} from './contexts/AssistantRuntimeContext';
export { ServiceProvider, ServiceContext, useService } from './contexts/ServiceContext';
export { AudioProvider, AudioContext, useAudio } from './contexts/AudioContext';
export {
  CommandProvider,
  useCommand,
  CommandBubbleStackHost,
} from './contexts/CommandContext';
export type { CommandMode, CommandState, AssistantBubbleStatus } from './types/command.types';
export type { ServiceMode, ServiceModeClaim } from './types/service.types';
export type { AssistantState, AssistantAction } from './types/assistant.types';
export { default as CommandBubble, CommandBubbleStack } from './components/command/CommandBubble';
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
export { TutorialOverlay } from './components/tutorial/Overlay';
export {
  TutorialProvider,
  useTutorial,
  useTutorialContext,
  useTutorialEngaged,
  useTutorialSettingsTourActive,
  useTutorialTargetInteractive,
} from './contexts/TutorialContext';
