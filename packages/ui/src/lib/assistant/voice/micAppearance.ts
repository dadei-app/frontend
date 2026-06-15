import {
  COMMAND_CAPTURE_STATES,
  selectIsAmbientEnabled,
  selectIsCommandService,
  selectIsCommandThinking,
  selectIsMicSyncPending,
} from '@dadei/ui/lib/assistant/assistantRuntime';
import type { AssistantState } from '@dadei/ui/types/assistant.types';
import type { AssistantBubbleStatus } from '@dadei/ui/types/command.types';

export type MicTone = 'blue' | 'red' | 'green' | 'none';

export type MicGrayChrome = 'none' | 'locked' | 'loading';

export type MicAction =
  | 'none'
  | 'toggle_service'
  | 'exit_command_service'
  | 'cancel_thinking';

export type MicAppearance = {
  grayChrome: MicGrayChrome;
  tone: MicTone;
  showThinkingSpinner: boolean;
  /** Command capture — modulate blue glass glow from mic level. */
  modulateGlassGlow: boolean;
  /** Ambient service enabled — listening for wake word. */
  showAmbientRipples: boolean;
  action: MicAction;
};

export function deriveMicAppearanceFromRuntime(
  runtime: AssistantState,
  options: {
    tutorialActive: boolean;
    permissionsGateBlocked?: boolean;
    assistantBubbleStatus?: AssistantBubbleStatus | null;
    /** When set, overrides `selectIsCommandThinking` (sync ref snapshot for mic clicks). */
    isCommandThinking?: boolean;
  },
): MicAppearance {
  const {
    tutorialActive,
    permissionsGateBlocked = false,
    assistantBubbleStatus = null,
    isCommandThinking,
  } = options;

  if (tutorialActive) {
    return {
      grayChrome: 'locked',
      tone: 'none',
      showThinkingSpinner: false,
      modulateGlassGlow: false,
      showAmbientRipples: false,
      action: 'none',
    };
  }

  if (runtime.commandState === 'locked' || runtime.registrationConflict) {
    return {
      grayChrome: 'locked',
      tone: 'none',
      showThinkingSpinner: false,
      modulateGlassGlow: false,
      showAmbientRipples: false,
      action: 'none',
    };
  }

  if (permissionsGateBlocked) {
    return {
      grayChrome: 'loading',
      tone: 'none',
      showThinkingSpinner: false,
      modulateGlassGlow: false,
      showAmbientRipples: false,
      action: 'none',
    };
  }

  if (selectIsMicSyncPending(runtime)) {
    return {
      grayChrome: 'loading',
      tone: 'none',
      showThinkingSpinner: false,
      modulateGlassGlow: false,
      showAmbientRipples: false,
      action: 'none',
    };
  }

  if (selectIsCommandService(runtime)) {
    const thinking =
      isCommandThinking ?? selectIsCommandThinking(runtime, assistantBubbleStatus);
    const capturing = !thinking && COMMAND_CAPTURE_STATES.has(runtime.commandState);
    return {
      grayChrome: 'none',
      tone: 'blue',
      showThinkingSpinner: thinking,
      modulateGlassGlow: capturing && !thinking,
      showAmbientRipples: false,
      action: thinking ? 'cancel_thinking' : 'exit_command_service',
    };
  }

  if (selectIsAmbientEnabled(runtime)) {
    return {
      grayChrome: 'none',
      tone: 'red',
      showThinkingSpinner: false,
      modulateGlassGlow: false,
      showAmbientRipples: true,
      action: 'toggle_service',
    };
  }

  return {
    grayChrome: 'none',
    tone: 'green',
    showThinkingSpinner: false,
    modulateGlassGlow: false,
    showAmbientRipples: false,
    action: 'toggle_service',
  };
}

/** @deprecated Use deriveMicAppearanceFromRuntime — kept for gradual migration. */
export { deriveMicAppearanceFromRuntime as deriveMicAppearance };
