import { describe, expect, it } from 'vitest';
import { deriveMicAppearanceFromRuntime } from '@dadei/ui/lib/assistant/voice/micAppearance';
import { INITIAL_ASSISTANT_RUNTIME } from '@dadei/ui/lib/assistant/runtime/types';

const tutorialOff = { tutorialActive: false };

describe('deriveMicAppearanceFromRuntime', () => {
  it('interrupts processing instead of exiting command mode', () => {
    for (const command of ['transcribing', 'thinking', 'responding'] as const) {
      const appearance = deriveMicAppearanceFromRuntime(
        {
          ...INITIAL_ASSISTANT_RUNTIME,
          service: 'command',
          command,
          commandOwnerSessionId: 'sess-1',
        },
        tutorialOff,
      );
      expect(appearance.tone).toBe('blue');
      expect(appearance.showProcessingSpinner).toBe(true);
      expect(appearance.action).toBe('cancel_processing');
    }
  });

  it('exits command mode while listening or during readout', () => {
    for (const command of ['listening', 'follow_up'] as const) {
      const appearance = deriveMicAppearanceFromRuntime(
        {
          ...INITIAL_ASSISTANT_RUNTIME,
          service: 'command',
          command,
          commandOwnerSessionId: 'sess-1',
        },
        tutorialOff,
      );
      expect(appearance.tone).toBe('blue');
      expect(appearance.showProcessingSpinner).toBe(false);
      expect(appearance.showLiveAura).toBe(true);
      expect(appearance.action).toBe('exit_command_mode');
    }
  });

  it('toggles ambient service when command mode is inactive', () => {
    const appearance = deriveMicAppearanceFromRuntime(
      {
        ...INITIAL_ASSISTANT_RUNTIME,
        service: 'ambient',
        command: 'idle',
      },
      tutorialOff,
    );
    expect(appearance.tone).toBe('red');
    expect(appearance.showAmbientRipples).toBe(true);
    expect(appearance.action).toBe('toggle_service');
  });

  it('does not show command chrome when local phase is active but service lock is ambient', () => {
    const appearance = deriveMicAppearanceFromRuntime(
      {
        ...INITIAL_ASSISTANT_RUNTIME,
        service: 'ambient',
        command: 'listening',
      },
      tutorialOff,
    );
    expect(appearance.tone).toBe('red');
    expect(appearance.action).toBe('toggle_service');
  });
});
