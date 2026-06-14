import {
  COMMAND_CAPTURE_STATES,
  COMMAND_PROCESSING_STATES,
  selectIsAmbientEnabled,
  selectIsCommandService,
} from '@dadei/ui/lib/assistant/assistantRuntime';
import type { AssistantState } from '@dadei/ui/types/assistant.types';

export type MicTone = 'blue' | 'red' | 'green' | 'none';

export type MicGrayChrome = 'none' | 'locked' | 'loading';

export type MicAction =
  | 'none'
  | 'toggle_service'
  | 'exit_command_service'
  | 'cancel_processing';

export type MicAppearance = {
  grayChrome: MicGrayChrome;
  tone: MicTone;
  showProcessingSpinner: boolean;
  showLiveAura: boolean;
  /** Ambient service enabled — listening for wake word. */
  showAmbientRipples: boolean;
  action: MicAction;
};

export function deriveMicAppearanceFromRuntime(
  runtime: AssistantState,
  options: {
    tutorialActive: boolean;
    permissionsGateBlocked?: boolean;
  },
): MicAppearance {
  const { tutorialActive, permissionsGateBlocked = false } = options;

  if (tutorialActive) {
    return {
      grayChrome: 'locked',
      tone: 'none',
      showProcessingSpinner: false,
      showLiveAura: false,
      showAmbientRipples: false,
      action: 'none',
    };
  }

  if (runtime.commandState === 'locked' || runtime.registrationConflict) {
    return {
      grayChrome: 'locked',
      tone: 'none',
      showProcessingSpinner: false,
      showLiveAura: false,
      showAmbientRipples: false,
      action: 'none',
    };
  }

  if (permissionsGateBlocked) {
    return {
      grayChrome: 'loading',
      tone: 'none',
      showProcessingSpinner: false,
      showLiveAura: false,
      showAmbientRipples: false,
      action: 'none',
    };
  }

  if (runtime.isTogglingService) {
    return {
      grayChrome: 'loading',
      tone: 'none',
      showProcessingSpinner: false,
      showLiveAura: false,
      showAmbientRipples: false,
      action: 'none',
    };
  }

  if (selectIsCommandService(runtime)) {
    const processing = COMMAND_PROCESSING_STATES.has(runtime.commandState);
    const capturing = COMMAND_CAPTURE_STATES.has(runtime.commandState);
    return {
      grayChrome: 'none',
      tone: 'blue',
      showProcessingSpinner: processing,
      showLiveAura: capturing && !processing,
      showAmbientRipples: false,
      action: processing ? 'cancel_processing' : 'exit_command_service',
    };
  }

  if (selectIsAmbientEnabled(runtime)) {
    return {
      grayChrome: 'none',
      tone: 'red',
      showProcessingSpinner: false,
      showLiveAura: false,
      showAmbientRipples: true,
      action: 'toggle_service',
    };
  }

  return {
    grayChrome: 'none',
    tone: 'green',
    showProcessingSpinner: false,
    showLiveAura: false,
    showAmbientRipples: false,
    action: 'toggle_service',
  };
}

/** @deprecated Use deriveMicAppearanceFromRuntime — kept for gradual migration. */
export { deriveMicAppearanceFromRuntime as deriveMicAppearance };
