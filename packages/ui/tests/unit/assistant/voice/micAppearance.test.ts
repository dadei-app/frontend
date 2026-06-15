import { describe, expect, it } from 'vitest';

import { deriveMicAppearanceFromRuntime } from '@dadei/ui/lib/assistant/voice/micAppearance';

import { INITIAL_ASSISTANT_STATE } from '@dadei/ui/types/assistant.types';

const tutorialOff = { tutorialActive: false };

describe('deriveMicAppearanceFromRuntime', () => {
  it('blocks mic actions while the permissions gate is open', () => {
    const appearance = deriveMicAppearanceFromRuntime(
      {
        ...INITIAL_ASSISTANT_STATE,
        serviceMode: 'ambient',
        commandState: 'idle',
      },
      { ...tutorialOff, permissionsGateBlocked: true },
    );
    expect(appearance.action).toBe('none');
    expect(appearance.showAmbientRipples).toBe(false);
  });

  it('interrupts thinking while the command thinking flag is active but state is still idle', () => {
    const appearance = deriveMicAppearanceFromRuntime(
      {
        ...INITIAL_ASSISTANT_STATE,
        serviceMode: 'command',
        commandState: 'idle',
        commandOwnerSessionId: 'sess-1',
        commandThinkingActive: false,
      },
      { ...tutorialOff, isCommandThinking: true },
    );
    expect(appearance.showThinkingSpinner).toBe(true);
    expect(appearance.action).toBe('cancel_thinking');
  });

  it('interrupts thinking while the command thinking flag is active but state is still idle (runtime)', () => {
    const appearance = deriveMicAppearanceFromRuntime(
      {
        ...INITIAL_ASSISTANT_STATE,
        serviceMode: 'command',
        commandState: 'idle',
        commandOwnerSessionId: 'sess-1',
        commandThinkingActive: true,
      },
      tutorialOff,
    );
    expect(appearance.showThinkingSpinner).toBe(true);
    expect(appearance.action).toBe('cancel_thinking');
  });

  it('interrupts thinking instead of exiting command service', () => {
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
      expect(appearance.showThinkingSpinner).toBe(true);
      expect(appearance.action).toBe('cancel_thinking');
    }
  });

  it('blocks mic actions while awaiting assistant_state websocket sync', () => {
    const appearance = deriveMicAppearanceFromRuntime(
      {
        ...INITIAL_ASSISTANT_STATE,
        serviceMode: 'command',
        commandState: 'follow_up',
        commandOwnerSessionId: 'sess-1',
        serviceStateSyncPending: true,
        serviceStateSyncBaselineRevision: 2,
        serviceStateRevision: 2,
      },
      tutorialOff,
    );
    expect(appearance.action).toBe('none');
    expect(appearance.modulateGlassGlow).toBe(false);
  });

  it('exits command service while listening or during follow-up capture', () => {
    for (const commandState of ['listening', 'follow_up'] as const) {
      const appearance = deriveMicAppearanceFromRuntime(
        {
          ...INITIAL_ASSISTANT_STATE,
          serviceMode: 'command',
          commandState,
          commandOwnerSessionId: 'sess-1',
        },
        { ...tutorialOff, assistantBubbleStatus: 'pending' },
      );
      expect(appearance.showThinkingSpinner).toBe(false);
      expect(appearance.modulateGlassGlow).toBe(true);
      expect(appearance.action).toBe('exit_command_service');
    }
  });

  it('cancels thinking during typewriter readout in follow_up', () => {
    const appearance = deriveMicAppearanceFromRuntime(
      {
        ...INITIAL_ASSISTANT_STATE,
        serviceMode: 'command',
        commandState: 'follow_up',
        commandOwnerSessionId: 'sess-1',
      },
      { ...tutorialOff, assistantBubbleStatus: 'revealing' },
    );
    expect(appearance.showThinkingSpinner).toBe(true);
    expect(appearance.action).toBe('cancel_thinking');
    expect(appearance.modulateGlassGlow).toBe(false);
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
    expect(appearance.showAmbientRipples).toBe(true);
    expect(appearance.action).toBe('toggle_service');
  });

  it('does not route command actions when command state is active but service mode is ambient', () => {
    const appearance = deriveMicAppearanceFromRuntime(
      {
        ...INITIAL_ASSISTANT_STATE,
        serviceMode: 'ambient',
        commandState: 'listening',
      },
      tutorialOff,
    );
    expect(appearance.action).toBe('toggle_service');
  });
});
