import type { CommandState } from '@dadei/ui/contexts/CommandContext';

export type MicTone = 'blue' | 'red' | 'green' | 'none';

/** Gray chrome variants — both suppress click/hotkey. */
export type MicGrayChrome = 'none' | 'locked' | 'loading';

export type MicAction = 'none' | 'toggle_service' | 'exit_command_mode';

export type MicAppearance = {
  grayChrome: MicGrayChrome;
  tone: MicTone;
  /** Command pipeline: transcribing / thinking / responding */
  showProcessingSpinner: boolean;
  showLiveAura: boolean;
  /** Passive service enabled, waiting for wake word */
  showPassiveRipples: boolean;
  action: MicAction;
};

const PROCESSING_STATES: ReadonlySet<CommandState> = new Set([
  'transcribing',
  'thinking',
  'responding',
]);

const CAPTURE_STATES: ReadonlySet<CommandState> = new Set(['listening', 'follow_up']);

function isCommandMode(state: CommandState, isAssistantMode: boolean): boolean {
  return state !== 'idle' || isAssistantMode;
}

/**
 * Single source of truth for mic chrome and primary click/hotkey behavior.
 *
 * Service enabled/disabled = passive mic on/off (red/green).
 * Command mode = active command pipeline (blue); exit leaves service as-is.
 */
export function deriveMicAppearance(input: {
  state: CommandState;
  isServiceEnabled: boolean;
  isAssistantMode: boolean;
  isTogglingService: boolean;
  registrationConflict: boolean;
  tutorialActive: boolean;
}): MicAppearance {
  const {
    state,
    isServiceEnabled,
    isAssistantMode,
    isTogglingService,
    registrationConflict,
    tutorialActive,
  } = input;

  if (tutorialActive) {
    return {
      grayChrome: 'locked',
      tone: 'none',
      showProcessingSpinner: false,
      showLiveAura: false,
      showPassiveRipples: false,
      action: 'none',
    };
  }

  if (state === 'locked' || registrationConflict) {
    return {
      grayChrome: 'locked',
      tone: 'none',
      showProcessingSpinner: false,
      showLiveAura: false,
      showPassiveRipples: false,
      action: 'none',
    };
  }

  if (isTogglingService) {
    return {
      grayChrome: 'loading',
      tone: 'none',
      showProcessingSpinner: false,
      showLiveAura: false,
      showPassiveRipples: false,
      action: 'none',
    };
  }

  const commandMode = isCommandMode(state, isAssistantMode);
  const processing = PROCESSING_STATES.has(state);
  const capturing = CAPTURE_STATES.has(state);

  if (commandMode) {
    return {
      grayChrome: 'none',
      tone: 'blue',
      showProcessingSpinner: processing,
      showLiveAura: capturing && !processing,
      showPassiveRipples: false,
      action: 'exit_command_mode',
    };
  }

  if (isServiceEnabled) {
    return {
      grayChrome: 'none',
      tone: 'red',
      showProcessingSpinner: false,
      showLiveAura: false,
      showPassiveRipples: true,
      action: 'toggle_service',
    };
  }

  return {
    grayChrome: 'none',
    tone: 'green',
    showProcessingSpinner: false,
    showLiveAura: false,
    showPassiveRipples: false,
    action: 'toggle_service',
  };
}
