import { describe, expect, it } from 'vitest';
import {
  assistantRuntimeReducer,
  selectCanClaimCommandService,
  selectIsAmbientEnabled,
  selectIsCommandService,
} from '@dadei/ui/lib/assistant/assistantRuntime';
import { INITIAL_ASSISTANT_STATE } from '@dadei/ui/types/assistant.types';

describe('assistantRuntimeReducer', () => {
  it('enables ambient listening without command lock', () => {
    const next = assistantRuntimeReducer(INITIAL_ASSISTANT_STATE, {
      type: 'service/status',
      enabled: true,
    });
    expect(next.serviceMode).toBe('ambient');
    expect(selectIsAmbientEnabled(next)).toBe(true);
    expect(selectIsCommandService(next)).toBe(false);
  });

  it('claiming command service disables ambient and holds command lock', () => {
    const next = assistantRuntimeReducer(
      { ...INITIAL_ASSISTANT_STATE, serviceMode: 'ambient' },
      {
        type: 'command/sync',
        active: true,
        ownerSessionId: 'sess-a',
        expiresAt: '2099-01-01T00:00:00.000Z',
      },
    );
    expect(next.serviceMode).toBe('command');
    expect(next.commandOwnerSessionId).toBe('sess-a');
    expect(selectIsAmbientEnabled(next)).toBe(false);
  });

  it('releasing command service returns to ambient', () => {
    const next = assistantRuntimeReducer(
      {
        ...INITIAL_ASSISTANT_STATE,
        serviceMode: 'command',
        commandState: 'follow_up',
        commandMode: 'introduction',
        commandOwnerSessionId: 'sess-a',
      },
      {
        type: 'command/sync',
        active: false,
        ownerSessionId: null,
        expiresAt: null,
      },
    );
    expect(next.serviceMode).toBe('ambient');
    expect(next.commandState).toBe('idle');
    expect(next.commandMode).toBe('normal');
  });

  it('allows claim when ambient is on, connected while off, or this session owns command', () => {
    const ambient = { ...INITIAL_ASSISTANT_STATE, serviceMode: 'ambient' as const };
    expect(selectCanClaimCommandService(ambient, 'sess-a')).toBe(true);
    expect(selectCanClaimCommandService(INITIAL_ASSISTANT_STATE, 'sess-a')).toBe(false);

    const connectedOff = {
      ...INITIAL_ASSISTANT_STATE,
      isConnected: true,
      serviceMode: 'off' as const,
    };
    expect(selectCanClaimCommandService(connectedOff, 'sess-a')).toBe(true);

    const owned = {
      ...INITIAL_ASSISTANT_STATE,
      serviceMode: 'command' as const,
      commandOwnerSessionId: 'sess-a',
    };
    expect(selectCanClaimCommandService(owned, 'sess-a')).toBe(true);
    expect(selectCanClaimCommandService(owned, 'sess-b')).toBe(false);
  });

  it('ignores ambient enable while command lock is held', () => {
    const next = assistantRuntimeReducer(
      {
        ...INITIAL_ASSISTANT_STATE,
        serviceMode: 'command',
        commandState: 'listening',
      },
      { type: 'service/status', enabled: true },
    );
    expect(next.serviceMode).toBe('command');
  });
});
