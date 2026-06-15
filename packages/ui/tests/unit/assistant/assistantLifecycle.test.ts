import { describe, expect, it } from 'vitest';
import {
  applyAssistantStateSnapshot,
  markMicIntentHandled,
  parseAssistantStateWireMessage,
  resetAssistantLifecycle,
  shouldAcceptMicIntent,
  waitForServiceStateRevisionAfter,
} from '@dadei/ui/lib/assistant/lifecycle/assistantLifecycle';
import { INITIAL_ASSISTANT_STATE } from '@dadei/ui/types/assistant.types';

describe('assistantLifecycle', () => {
  it('parses assistant_state websocket payloads', () => {
    const snapshot = parseAssistantStateWireMessage({
      event: 'assistant_state',
      revision: 3,
      ambient_enabled: true,
      command_mode_active: false,
      owner_session_id: null,
      expires_at: null,
    });
    expect(snapshot).toEqual({
      revision: 3,
      ambientEnabled: true,
      commandModeActive: false,
      ownerSessionId: null,
      expiresAt: null,
    });
  });

  it('drops stale snapshots and applies monotonic revisions', () => {
    resetAssistantLifecycle();
    const actions: unknown[] = [];
    const dispatch = (action: unknown) => actions.push(action);

    applyAssistantStateSnapshot(
      dispatch,
      {
        revision: 2,
        ambientEnabled: true,
        commandModeActive: false,
        ownerSessionId: null,
        expiresAt: null,
      },
      INITIAL_ASSISTANT_STATE,
    );
    applyAssistantStateSnapshot(
      dispatch,
      {
        revision: 1,
        ambientEnabled: false,
        commandModeActive: false,
        ownerSessionId: null,
        expiresAt: null,
      },
      INITIAL_ASSISTANT_STATE,
    );

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ type: 'assistant_state/sync', revision: 2 });
  });

  it('rate-limits mic intents', () => {
    resetAssistantLifecycle();
    expect(shouldAcceptMicIntent(1_000)).toBe(true);
    markMicIntentHandled(1_000);
    expect(shouldAcceptMicIntent(1_100)).toBe(false);
    expect(shouldAcceptMicIntent(1_400)).toBe(true);
  });

  it('resolves revision waiters when a newer snapshot applies', async () => {
    resetAssistantLifecycle();
    const actions: unknown[] = [];
    const dispatch = (action: unknown) => actions.push(action);
    const wait = waitForServiceStateRevisionAfter(1);

    applyAssistantStateSnapshot(
      dispatch,
      {
        revision: 2,
        ambientEnabled: true,
        commandModeActive: false,
        ownerSessionId: null,
        expiresAt: null,
      },
      INITIAL_ASSISTANT_STATE,
    );

    await expect(wait).resolves.toBeUndefined();
  });
});
