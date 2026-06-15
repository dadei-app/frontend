// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@dadei/ui/lib/platform/query/queryKeys';

const handlers: Array<(msg: { event: string; data?: unknown }) => void> = [];

vi.mock('@dadei/ui/lib/assistant/realtime/realtimeClient', () => ({
  subscribeRealtimeMessages: (handler: (msg: { event: string; data?: unknown }) => void) => {
    handlers.push(handler);
    return () => {
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    };
  },
}));

describe('ServiceContext integration_reauth wiring', () => {
  beforeEach(() => {
    handlers.length = 0;
  });

  it('invalidates integrationsStatus and authMe on integration_reauth', async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    function handleIntegrationReauth(_data: unknown) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.integrationsStatus });
      void queryClient.invalidateQueries({ queryKey: queryKeys.authMe });
    }

    const off = (await import('@dadei/ui/lib/assistant/realtime/realtimeClient'))
      .subscribeRealtimeMessages(msg => {
        if (msg.event === 'integration_reauth') {
          handleIntegrationReauth(msg.data);
        }
      });

    handlers[0]?.({
      event: 'integration_reauth',
      data: { provider: 'google', reason: 'invalid_grant', needs_reauth: true },
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.integrationsStatus });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.authMe });

    off();
  });
});
