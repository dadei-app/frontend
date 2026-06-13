import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MicrophoneButton from '@dadei/ui/components/MicrophoneButton';
import { AudioContext } from '@dadei/ui/contexts/AudioContext';

const mockToggleService = vi.fn();
const mockExitCommandMode = vi.fn();
const mockCancelProcessing = vi.fn();

vi.mock('@dadei/ui/contexts/SystemContext', () => ({
  useSystem: () => ({
    matchesHotkey: (event: KeyboardEvent) => event.code === 'Space',
  }),
}));

vi.mock('@dadei/ui/contexts/AssistantRuntimeContext', () => ({
  useAssistantRuntimeState: () => ({
    service: 'ambient',
    command: 'idle',
    submode: 'normal',
    commandOwnerSessionId: null,
    commandModeExpiresAt: null,
    isConnected: true,
    registrationConflict: false,
    isTogglingService: false,
  }),
}));

vi.mock('@dadei/ui/contexts/ServiceContext', () => ({
  useService: () => ({
    toggleService: mockToggleService,
  }),
}));

vi.mock('@dadei/ui/contexts/CommandContext', () => ({
  useCommand: () => ({
    state: 'idle',
    isCommandMode: false,
    cancelCommandMode: mockExitCommandMode,
    cancelProcessing: mockCancelProcessing,
  }),
}));

vi.mock('@dadei/ui/contexts/TutorialContext', () => ({
  useTutorialEngaged: () => false,
}));

vi.mock('@dadei/ui/components/command/MicLevelAura', () => ({
  default: () => null,
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
    mockToggleService.mockReset();
    mockExitCommandMode.mockReset();
    mockCancelProcessing.mockReset();
  });

  it('toggles ambient service when clicked in idle command state', async () => {
    const user = userEvent.setup();
    renderMic();

    await user.click(screen.getByRole('button'));
    expect(mockToggleService).toHaveBeenCalledOnce();
  });

  it('responds to space hotkey when enabled', async () => {
    const user = userEvent.setup();
    renderMic();

    await user.keyboard(' ');
    expect(mockToggleService).toHaveBeenCalled();
  });

  it('does not respond to space when hotkey is disabled', async () => {
    const user = userEvent.setup();
    renderMic({ disableSpaceToggle: true });

    mockToggleService.mockClear();
    await user.keyboard(' ');
    expect(mockToggleService).not.toHaveBeenCalled();
  });
});
