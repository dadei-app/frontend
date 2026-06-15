import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { CommandBubbleStack } from '@dadei/ui/components/command/CommandBubble';
import { ASSISTANT_REVEAL_DELAY_MS } from '@dadei/ui/lib/assistant/voice/ui/commandBubbleMotion';

const mockUseCommand = vi.fn();

vi.mock('@dadei/ui/contexts/CommandContext', () => ({
  useCommand: () => mockUseCommand(),
}));

describe('CommandBubbleStack', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseCommand.mockReturnValue({
      state: 'listening',
      bubbleHistory: [],
      liveTurnId: 'turn-1',
      userBubbleText: 'Dadei, what time is it?',
      assistantBubbleText: '',
      assistantBubbleStatus: 'pending',
      assistantStatusLine: null,
      userCaptionInterim: false,
      followUpDockPrimed: false,
      assistantBubbleAnchored: false,
      notifyAssistantRevealStarted: vi.fn(),
      notifyAssistantRevealComplete: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the live user caption while listening', () => {
    render(<CommandBubbleStack />);
    expect(screen.getByText('Dadei, what time is it?')).toBeInTheDocument();
  });

  it('shows assistant status while thinking', async () => {
    mockUseCommand.mockReturnValue({
      state: 'thinking',
      bubbleHistory: [],
      liveTurnId: 'turn-1',
      userBubbleText: 'Set a reminder',
      assistantBubbleText: '',
      assistantBubbleStatus: 'pending',
      assistantStatusLine: 'Thinking',
      userCaptionInterim: false,
      followUpDockPrimed: false,
      assistantBubbleAnchored: true,
      notifyAssistantRevealStarted: vi.fn(),
      notifyAssistantRevealComplete: vi.fn(),
    });

    render(<CommandBubbleStack />);
    await act(async () => {
      vi.advanceTimersByTime(ASSISTANT_REVEAL_DELAY_MS);
    });
    expect(screen.getByText(/Thinking/)).toBeInTheDocument();
  });

  it('keeps the assistant shell visible when anchored during a status gap', async () => {
    mockUseCommand.mockReturnValue({
      state: 'thinking',
      bubbleHistory: [],
      liveTurnId: 'turn-1',
      userBubbleText: 'Set a reminder',
      assistantBubbleText: '',
      assistantBubbleStatus: 'pending',
      assistantStatusLine: null,
      userCaptionInterim: false,
      followUpDockPrimed: false,
      assistantBubbleAnchored: true,
      notifyAssistantRevealStarted: vi.fn(),
      notifyAssistantRevealComplete: vi.fn(),
    });

    render(<CommandBubbleStack />);
    await act(async () => {
      vi.advanceTimersByTime(ASSISTANT_REVEAL_DELAY_MS);
    });
    expect(screen.getByText(/Thinking/)).toBeInTheDocument();
    expect(screen.getAllByText('dadei').length).toBeGreaterThan(0);
  });

  it('shows assistant response text while responding', () => {
    mockUseCommand.mockReturnValue({
      state: 'responding',
      bubbleHistory: [],
      liveTurnId: 'turn-1',
      userBubbleText: 'Hello',
      assistantBubbleText: 'Hi there — how can I help?',
      assistantBubbleStatus: 'streaming',
      assistantStatusLine: null,
      userCaptionInterim: false,
      followUpDockPrimed: false,
      assistantBubbleAnchored: false,
      notifyAssistantRevealStarted: vi.fn(),
      notifyAssistantRevealComplete: vi.fn(),
    });

    render(<CommandBubbleStack />);
    expect(screen.getByText('Hi there — how can I help?')).toBeInTheDocument();
  });

  it('keeps submitted user text settled in the stack while dadei typewrites', () => {
    mockUseCommand.mockReturnValue({
      state: 'responding',
      bubbleHistory: [],
      liveTurnId: 'turn-1',
      userBubbleText: 'And tomorrow?',
      assistantBubbleText: 'Sure — what time works?',
      assistantBubbleStatus: 'revealing',
      assistantStatusLine: null,
      userCaptionInterim: false,
      followUpDockPrimed: true,
      notifyAssistantRevealStarted: vi.fn(),
      notifyAssistantRevealComplete: vi.fn(),
    });

    render(<CommandBubbleStack />);
    expect(screen.getByText('And tomorrow?')).toBeInTheDocument();
    expect(screen.queryByText('listening')).not.toBeInTheDocument();
  });
});
