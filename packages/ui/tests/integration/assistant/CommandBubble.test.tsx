import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CommandBubbleStack } from '@dadei/ui/components/command/CommandBubble';

const mockUseCommand = vi.fn();

vi.mock('@dadei/ui/contexts/CommandContext', () => ({
  useCommand: () => mockUseCommand(),
}));

describe('CommandBubbleStack', () => {
  beforeEach(() => {
    mockUseCommand.mockReturnValue({
      state: 'listening',
      bubbleHistory: [],
      liveTurnId: 'turn-1',
      userBubbleText: 'Dadei, what time is it?',
      assistantBubbleText: '',
      assistantBubbleStatus: 'pending',
      assistantStatusLine: null,
      userCaptionInterim: false,
      notifyAssistantRevealStarted: vi.fn(),
      notifyAssistantRevealComplete: vi.fn(),
    });
  });

  it('shows the live user caption while listening', () => {
    render(<CommandBubbleStack />);
    expect(screen.getByText('Dadei, what time is it?')).toBeInTheDocument();
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('shows assistant status while thinking', () => {
    mockUseCommand.mockReturnValue({
      state: 'thinking',
      bubbleHistory: [],
      liveTurnId: 'turn-1',
      userBubbleText: 'Set a reminder',
      assistantBubbleText: '',
      assistantBubbleStatus: 'pending',
      assistantStatusLine: 'Thinking',
      userCaptionInterim: false,
      notifyAssistantRevealStarted: vi.fn(),
      notifyAssistantRevealComplete: vi.fn(),
    });

    render(<CommandBubbleStack />);
    expect(screen.getByText(/Thinking/)).toBeInTheDocument();
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
      notifyAssistantRevealStarted: vi.fn(),
      notifyAssistantRevealComplete: vi.fn(),
    });

    render(<CommandBubbleStack />);
    expect(screen.getByText('Hi there — how can I help?')).toBeInTheDocument();
    expect(screen.getAllByText('dadei').length).toBeGreaterThan(0);
  });
});
