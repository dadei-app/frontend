import { describe, expect, it } from 'vitest';
import {
  assistantRuntimeReducer,
  selectCanClaimCommandService,
  selectIsAmbientEnabled,
  selectIsCommandService,
} from '@dadei/ui/lib/assistant/assistantRuntime';
import { INITIAL_ASSISTANT_STATE } from '@dadei/ui/types/assistant.types';

describe('assistantRuntimeReducer', () => {
  it('enables ambient listening from authoritative snapshot', () => {
    const next = assistantRuntimeReducer(INITIAL_ASSISTANT_STATE, {
      type: 'assistant_state/sync',
      revision: 1,
      serviceMode: 'ambient',
      commandOwnerSessionId: null,
      commandServiceExpiresAt: null,
      commandState: 'idle',
      commandMode: 'normal',
    });
    expect(next.serviceMode).toBe('ambient');
    expect(selectIsAmbientEnabled(next)).toBe(true);
    expect(selectIsCommandService(next)).toBe(false);
  });

  it('claiming command service disables ambient and holds command lock', () => {
    const next = assistantRuntimeReducer(
      { ...INITIAL_ASSISTANT_STATE, serviceMode: 'ambient' },
      {
        type: 'assistant_state/sync',
        revision: 2,
        serviceMode: 'command',
        commandOwnerSessionId: 'sess-a',
        commandServiceExpiresAt: '2099-01-01T00:00:00.000Z',
        commandState: 'idle',
        commandMode: 'normal',
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
        serviceStateRevision: 2,
      },
      {
        type: 'assistant_state/sync',
        revision: 3,
        serviceMode: 'ambient',
        commandOwnerSessionId: null,
        commandServiceExpiresAt: null,
        commandState: 'idle',
        commandMode: 'normal',
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

  it('ignores stale revisions but clears an in-flight service-state sync wait', () => {
    const next = assistantRuntimeReducer(
      {
        ...INITIAL_ASSISTANT_STATE,
        serviceMode: 'command',
        commandState: 'listening',
        serviceStateRevision: 4,
        serviceStateSyncPending: true,
        serviceStateSyncBaselineRevision: 3,
      },
      {
        type: 'assistant_state/sync',
        revision: 4,
        serviceMode: 'ambient',
        commandOwnerSessionId: null,
        commandServiceExpiresAt: null,
        commandState: 'idle',
        commandMode: 'normal',
      },
    );
    expect(next.serviceMode).toBe('command');
    expect(next.serviceStateSyncPending).toBe(false);
    expect(next.serviceStateSyncBaselineRevision).toBeNull();
  });

  it('clears service-state sync pending when a newer revision applies', () => {
    const next = assistantRuntimeReducer(
      {
        ...INITIAL_ASSISTANT_STATE,
        serviceMode: 'command',
        serviceStateRevision: 4,
        serviceStateSyncPending: true,
        serviceStateSyncBaselineRevision: 4,
      },
      {
        type: 'assistant_state/sync',
        revision: 5,
        serviceMode: 'ambient',
        commandOwnerSessionId: null,
        commandServiceExpiresAt: null,
        commandState: 'idle',
        commandMode: 'normal',
      },
    );
    expect(next.serviceMode).toBe('ambient');
    expect(next.serviceStateSyncPending).toBe(false);
  });
});
