import { describe, expect, it } from 'vitest';
import { deriveMicAppearanceFromRuntime } from '@dadei/ui/lib/assistant/voice/micAppearance';
import { INITIAL_ASSISTANT_STATE } from '@dadei/ui/types/assistant.types';

const tutorialOff = { tutorialActive: false };

describe('deriveMicAppearanceFromRuntime', () => {
  it('shows gray loading chrome while the permissions gate is open', () => {
    const appearance = deriveMicAppearanceFromRuntime(
      {
        ...INITIAL_ASSISTANT_STATE,
        serviceMode: 'ambient',
        commandState: 'idle',
      },
      { ...tutorialOff, permissionsGateBlocked: true },
    );
    expect(appearance.grayChrome).toBe('loading');
    expect(appearance.tone).toBe('none');
    expect(appearance.action).toBe('none');
    expect(appearance.showAmbientRipples).toBe(false);
  });

  it('interrupts processing instead of exiting command service', () => {
    for (const commandState of ['thinking', 'responding'] as const) {
      const appearance = deriveMicAppearanceFromRuntime(
        {
          ...INITIAL_ASSISTANT_STATE,
          serviceMode: 'command',
          commandState,
          commandOwnerSessionId: 'sess-1',
        },
        tutorialOff,
      );
      expect(appearance.tone).toBe('blue');
      expect(appearance.showProcessingSpinner).toBe(true);
      expect(appearance.action).toBe('cancel_processing');
    }
  });

  it('exits command service while listening or during readout', () => {
    for (const commandState of ['listening', 'follow_up'] as const) {
      const appearance = deriveMicAppearanceFromRuntime(
        {
          ...INITIAL_ASSISTANT_STATE,
          serviceMode: 'command',
          commandState,
          commandOwnerSessionId: 'sess-1',
        },
        tutorialOff,
      );
      expect(appearance.tone).toBe('blue');
      expect(appearance.showProcessingSpinner).toBe(false);
      expect(appearance.showLiveAura).toBe(true);
      expect(appearance.action).toBe('exit_command_service');
    }
  });

  it('toggles ambient service when command service is inactive', () => {
    const appearance = deriveMicAppearanceFromRuntime(
      {
        ...INITIAL_ASSISTANT_STATE,
        serviceMode: 'ambient',
        commandState: 'idle',
      },
      tutorialOff,
    );
    expect(appearance.tone).toBe('red');
    expect(appearance.showAmbientRipples).toBe(true);
    expect(appearance.action).toBe('toggle_service');
  });

  it('does not show command chrome when command state is active but service mode is ambient', () => {
    const appearance = deriveMicAppearanceFromRuntime(
      {
        ...INITIAL_ASSISTANT_STATE,
        serviceMode: 'ambient',
        commandState: 'listening',
      },
      tutorialOff,
    );
    expect(appearance.tone).toBe('red');
    expect(appearance.action).toBe('toggle_service');
  });
});
