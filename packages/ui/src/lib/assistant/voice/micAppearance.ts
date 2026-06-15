import {
  COMMAND_CAPTURE_STATES,
  COMMAND_PROCESSING_STATES,
  selectIsAmbientEnabled,
  selectIsCommandService,
  selectIsServiceStateSyncPending,
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
  },
): MicAppearance {
  const { tutorialActive, permissionsGateBlocked = false } = options;

  if (tutorialActive) {
    return {
      grayChrome: 'locked',
      tone: 'none',
      showProcessingSpinner: false,
      modulateGlassGlow: false,
      showAmbientRipples: false,
      action: 'none',
    };
  }

  if (runtime.commandState === 'locked' || runtime.registrationConflict) {
    return {
      grayChrome: 'locked',
      tone: 'none',
      showProcessingSpinner: false,
      modulateGlassGlow: false,
      showAmbientRipples: false,
      action: 'none',
    };
  }

  if (permissionsGateBlocked) {
    return {
      grayChrome: 'loading',
      tone: 'none',
      showProcessingSpinner: false,
      modulateGlassGlow: false,
      showAmbientRipples: false,
      action: 'none',
    };
  }

  if (selectIsServiceStateSyncPending(runtime)) {
    return {
      grayChrome: 'loading',
      tone: 'none',
      showProcessingSpinner: false,
      modulateGlassGlow: false,
      showAmbientRipples: false,
      action: 'none',
    };
  }

  if (selectIsCommandService(runtime)) {
    const processing =
      COMMAND_PROCESSING_STATES.has(runtime.commandState) || runtime.commandPipelineActive;
    const capturing = !processing && COMMAND_CAPTURE_STATES.has(runtime.commandState);
    return {
      grayChrome: 'none',
      tone: 'blue',
      showProcessingSpinner: processing,
      modulateGlassGlow: capturing && !processing,
      showAmbientRipples: false,
      action: processing ? 'cancel_processing' : 'exit_command_service',
    };
  }

  if (selectIsAmbientEnabled(runtime)) {
    return {
      grayChrome: 'none',
      tone: 'red',
      showProcessingSpinner: false,
      modulateGlassGlow: false,
      showAmbientRipples: true,
      action: 'toggle_service',
    };
  }

  return {
    grayChrome: 'none',
    tone: 'green',
    showProcessingSpinner: false,
    modulateGlassGlow: false,
    showAmbientRipples: false,
    action: 'toggle_service',
  };
}

/** @deprecated Use deriveMicAppearanceFromRuntime — kept for gradual migration. */
export { deriveMicAppearanceFromRuntime as deriveMicAppearance };
