import { describe, expect, it } from 'vitest';
import { deriveMicAppearance } from '@dadei/ui/lib/assistant/voice/micAppearance';

const base = {
  isServiceEnabled: true,
  isCommandMode: true,
  isTogglingService: false,
  registrationConflict: false,
  tutorialActive: false,
};

describe('deriveMicAppearance', () => {
  it('interrupts processing instead of exiting command mode', () => {
    for (const state of ['transcribing', 'thinking', 'responding'] as const) {
      const appearance = deriveMicAppearance({ ...base, state });
      expect(appearance.tone).toBe('blue');
      expect(appearance.showProcessingSpinner).toBe(true);
      expect(appearance.action).toBe('cancel_processing');
    }
  });

  it('exits command mode while listening or during readout', () => {
    for (const state of ['listening', 'follow_up'] as const) {
      const appearance = deriveMicAppearance({ ...base, state });
      expect(appearance.tone).toBe('blue');
      expect(appearance.showProcessingSpinner).toBe(false);
      expect(appearance.showLiveAura).toBe(true);
      expect(appearance.action).toBe('exit_command_mode');
    }
  });

  it('toggles passive service when command mode is inactive', () => {
    const appearance = deriveMicAppearance({
      ...base,
      isCommandMode: false,
      state: 'idle',
    });
    expect(appearance.tone).toBe('red');
    expect(appearance.action).toBe('toggle_service');
  });
});
