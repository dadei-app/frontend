import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MicrophoneButton from '@dadei/ui/components/MicrophoneButton';
import { AudioContext } from '@dadei/ui/contexts/AudioContext';

const mockSubmitMicIntent = vi.fn();

vi.mock('@dadei/ui/contexts/SystemContext', () => ({
  useSystem: () => ({
    matchesHotkey: (event: KeyboardEvent) => event.code === 'Space',
  }),
}));

vi.mock('@dadei/ui/contexts/ServiceContext', () => ({
  useService: () => ({
    permissionsGateOpen: false,
  }),
}));

vi.mock('@dadei/ui/contexts/AssistantRuntimeContext', () => ({
  useAssistantRuntimeState: () => ({
    serviceMode: 'ambient',
    commandState: 'idle',
    commandMode: 'normal',
    commandOwnerSessionId: null,
    commandServiceExpiresAt: null,
    isConnected: true,
    registrationConflict: false,
    serviceStateSyncPending: false,
    serviceStateSyncBaselineRevision: null,
    serviceStateRevision: 1,
    commandThinkingActive: false,
  }),
}));

vi.mock('@dadei/ui/lib/assistant/lifecycle/useMicIntent', () => ({
  useMicIntent: () => ({
    submitMicIntent: mockSubmitMicIntent,
    inputsInert: false,
    appearance: {
      grayChrome: 'none',
      tone: 'red',
      showThinkingSpinner: false,
      modulateGlassGlow: false,
      showAmbientRipples: true,
      action: 'toggle_service',
    },
  }),
}));

vi.mock('@dadei/ui/contexts/TutorialContext', () => ({
  useTutorialEngaged: () => false,
}));
function renderMic(extra?: { disableSpaceToggle?: boolean }) {
  return render(
    <AudioContext.Provider
      value={{ isAudioPipelineReady: true, micLevel: 0, setMicLevelPreview: vi.fn() }}
    >
      <MicrophoneButton {...extra} />
    </AudioContext.Provider>,
  );
}

describe('MicrophoneButton', () => {
  beforeEach(() => {
    mockSubmitMicIntent.mockReset();
  });

  it('submits mic intent when clicked', async () => {
    const user = userEvent.setup();
    renderMic();

    await user.click(screen.getByRole('button'));
    expect(mockSubmitMicIntent).toHaveBeenCalledOnce();
  });

  it('responds to space hotkey when enabled', async () => {
    const user = userEvent.setup();
    renderMic();

    await user.keyboard(' ');
    expect(mockSubmitMicIntent).toHaveBeenCalledOnce();
  });

  it('ignores space when disableSpaceToggle is set', async () => {
    const user = userEvent.setup();
    renderMic({ disableSpaceToggle: true });

    await user.keyboard(' ');
    expect(mockSubmitMicIntent).not.toHaveBeenCalled();
  });
});
