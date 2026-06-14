import { describe, expect, it } from 'vitest';
import {
  permissionIdsForClient,
  permissionsForPlatform,
} from '@dadei/ui/lib/onboarding/tutorial/permissionsRegistry';

describe('permissionIdsForClient', () => {
  it('includes base capabilities on web', () => {
    expect(permissionIdsForClient('web', false)).toEqual([
      'microphone',
      'location',
      'notifications',
    ]);
  });

  it('includes macOS desktop automation permissions on electron darwin', () => {
    const ids = permissionIdsForClient('desktop-darwin', true);
    expect(ids).toContain('microphone');
    expect(ids).toContain('accessibility');
    expect(ids).toContain('automation');
  });

  it('filters registry entries to the client capability set', () => {
    const entries = permissionsForPlatform('desktop-win32', true);
    expect(entries.map(entry => entry.id)).toEqual(['microphone', 'location', 'notifications']);
  });
});
