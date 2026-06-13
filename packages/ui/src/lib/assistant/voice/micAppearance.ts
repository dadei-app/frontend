import {
  COMMAND_CAPTURE_PHASES,
  COMMAND_PROCESSING_PHASES,
  selectIsAmbientEnabled,
  selectIsCommandMode,
} from '@dadei/ui/lib/assistant/runtime/reducer';
import type { AssistantRuntimeState } from '@dadei/ui/lib/assistant/runtime/types';

export type MicTone = 'blue' | 'red' | 'green' | 'none';

export type MicGrayChrome = 'none' | 'locked' | 'loading';

export type MicAction =
  | 'none'
  | 'toggle_service'
  | 'exit_command_mode'
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

/**
 * Mic chrome and click behavior derived solely from centralized assistant runtime.
 *
 * Lock hierarchy: service off → ambient → command (+ command phase).
 */
export function deriveMicAppearanceFromRuntime(
  runtime: AssistantRuntimeState,
  options: {
    tutorialActive: boolean;
  },
): MicAppearance {
  const { tutorialActive } = options;

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

  if (runtime.command === 'locked' || runtime.registrationConflict) {
    return {
      grayChrome: 'locked',
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

  if (selectIsCommandMode(runtime)) {
    const processing = COMMAND_PROCESSING_PHASES.has(runtime.command);
    const capturing = COMMAND_CAPTURE_PHASES.has(runtime.command);
    return {
      grayChrome: 'none',
      tone: 'blue',
      showProcessingSpinner: processing,
      showLiveAura: capturing && !processing,
      showAmbientRipples: false,
      action: processing ? 'cancel_processing' : 'exit_command_mode',
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
export { COMMAND_PROCESSING_PHASES as COMMAND_PROCESSING_STATES } from '@dadei/ui/lib/assistant/runtime/reducer';
