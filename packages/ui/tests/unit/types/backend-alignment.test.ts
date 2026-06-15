import { describe, expect, it } from 'vitest';
import {
  COMMAND_MODES,
  ENROLLMENT_KICKOFF_TEXT,
  type CommandMode,
} from '@dadei/ui/types/command.types';
import type { ServiceModeClaim } from '@dadei/ui/types/service.types';

/** Backend CommandMode literal set (enrollment.py). */
const BACKEND_COMMAND_MODES = ['normal', 'introduction', 'retraining'] as const;

/** Backend CommandModeStateResponse / command_mode webhook shape (api_models.py, service_router.py). */
type BackendCommandModeSnapshot = {
  active: boolean;
  owner_session_id: string | null;
  expires_at: string | null;
};

describe('backend type alignment', () => {
  it('CommandMode values match backend enrollment.CommandMode', () => {
    expect([...COMMAND_MODES]).toEqual([...BACKEND_COMMAND_MODES]);
    const _exhaustive: Record<CommandMode, true> = {
      normal: true,
      introduction: true,
      retraining: true,
    };
    expect(Object.keys(_exhaustive)).toHaveLength(BACKEND_COMMAND_MODES.length);
  });

  it('enrollment kickoff token matches backend ENROLLMENT_KICKOFF', () => {
    expect(ENROLLMENT_KICKOFF_TEXT).toBe('__dadei_enrollment_kickoff__');
  });

  it('ServiceModeClaim matches backend command-mode claim response fields', () => {
    const sample: ServiceModeClaim = {
      active: true,
      owner_session_id: 'sess-1',
      expires_at: '2099-01-01T00:00:00.000Z',
      revision: 4,
    };
    const backend: BackendCommandModeSnapshot = sample;
    expect(backend.active).toBe(true);
    expect(backend.owner_session_id).toBe('sess-1');
  });
});
