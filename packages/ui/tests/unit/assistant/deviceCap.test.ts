import { describe, expect, it } from 'vitest';
import { isDeviceCapBlocked } from '@dadei/ui/lib/assistant/lifecycle/deviceCap';

describe('isDeviceCapBlocked', () => {
  it('does not block pro (unlimited devices)', () => {
    expect(isDeviceCapBlocked(['client-a', 'client-b'], null, 'client-a')).toBe(false);
  });

  it('allows the only connected device once session id is known', () => {
    expect(isDeviceCapBlocked(['client-a'], 1, 'client-a')).toBe(false);
  });

  it('does not block while session id is unknown and only one client is connected', () => {
    expect(isDeviceCapBlocked(['client-a'], 1, null)).toBe(false);
  });

  it('blocks a second device on the free tier', () => {
    expect(isDeviceCapBlocked(['client-a'], 1, 'client-b')).toBe(true);
    expect(isDeviceCapBlocked(['client-a', 'client-b'], 1, 'client-b')).toBe(true);
  });

  it('blocks when clearly over cap before session id is known', () => {
    expect(isDeviceCapBlocked(['client-a', 'client-b'], 1, null)).toBe(true);
  });
});
