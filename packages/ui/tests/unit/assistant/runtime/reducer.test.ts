import { describe, expect, it } from 'vitest';
import {
  assistantRuntimeReducer,
  selectIsAmbientEnabled,
  selectIsCommandMode,
} from '@dadei/ui/lib/assistant/runtime/reducer';
import { INITIAL_ASSISTANT_RUNTIME } from '@dadei/ui/lib/assistant/runtime/types';

describe('assistantRuntimeReducer', () => {
  it('enables ambient listening without command lock', () => {
    const next = assistantRuntimeReducer(INITIAL_ASSISTANT_RUNTIME, {
      type: 'service/status',
      enabled: true,
    });
    expect(next.service).toBe('ambient');
    expect(selectIsAmbientEnabled(next)).toBe(true);
    expect(selectIsCommandMode(next)).toBe(false);
  });

  it('claiming command mode disables ambient and holds command lock', () => {
    const next = assistantRuntimeReducer(
      { ...INITIAL_ASSISTANT_RUNTIME, service: 'ambient' },
      {
        type: 'command/sync',
        active: true,
        ownerSessionId: 'sess-a',
        expiresAt: '2099-01-01T00:00:00.000Z',
      },
    );
    expect(next.service).toBe('command');
    expect(next.commandOwnerSessionId).toBe('sess-a');
    expect(selectIsAmbientEnabled(next)).toBe(false);
  });

  it('releasing command mode returns to ambient', () => {
    const next = assistantRuntimeReducer(
      {
        ...INITIAL_ASSISTANT_RUNTIME,
        service: 'command',
        command: 'follow_up',
        submode: 'introduction',
        commandOwnerSessionId: 'sess-a',
      },
      {
        type: 'command/sync',
        active: false,
        ownerSessionId: null,
        expiresAt: null,
      },
    );
    expect(next.service).toBe('ambient');
    expect(next.command).toBe('idle');
    expect(next.submode).toBe('normal');
  });

  it('ignores ambient enable while command lock is held', () => {
    const next = assistantRuntimeReducer(
      {
        ...INITIAL_ASSISTANT_RUNTIME,
        service: 'command',
        command: 'listening',
      },
      { type: 'service/status', enabled: true },
    );
    expect(next.service).toBe('command');
  });
});
