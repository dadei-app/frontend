import { describe, expect, it } from 'vitest';
import {
  COMMAND_BUBBLE_STACK_SPACING,
  HISTORY_BLOCK_GAP_PX,
  LIVE_PAIR_GAP_PX,
  commandBubbleStackStyle,
  hasVisibleAssistantContent,
  isUserCaptureLive,
  shouldShowLiveUserBubble,
  stackEdgeMaskStyle,
  userBubblePhase,
  userBubblePlacement,
} from '@dadei/ui/lib/assistant/voice/ui/commandBubbleMotion';

const noText = { isInterim: false, userText: '', followUpListenOpen: false };
const withText = { isInterim: false, userText: 'Set a reminder', followUpListenOpen: false };
const interim = { isInterim: true, userText: 'Set a', followUpListenOpen: false };
const followUpListen = { isInterim: false, userText: '', followUpListenOpen: true };

describe('commandBubbleMotion', () => {
  it('uses one uniform gap for every bubble in the stack', () => {
    expect(commandBubbleStackStyle().gap).toBe(COMMAND_BUBBLE_STACK_SPACING.stackGapPx);
    expect(LIVE_PAIR_GAP_PX).toBe(COMMAND_BUBBLE_STACK_SPACING.stackGapPx);
    expect(HISTORY_BLOCK_GAP_PX).toBe(COMMAND_BUBBLE_STACK_SPACING.stackGapPx);
  });

  it('docks the user bubble while capturing speech', () => {
    expect(userBubblePlacement('listening', true, noText)).toBe('dock');
    expect(userBubblePhase('listening', 'dock')).toBe('thought');
    expect(isUserCaptureLive('dock', 'thought')).toBe(true);
  });

  it('opens an empty follow-up dock when listening is ready', () => {
    expect(userBubblePlacement('follow_up', true, followUpListen)).toBe('dock');
    expect(shouldShowLiveUserBubble('dock', '', true)).toBe(true);
  });

  it('keeps submitted follow-up text in the stack while dadei responds', () => {
    expect(userBubblePlacement('follow_up', true, withText)).toBe('stack');
    expect(userBubblePhase('follow_up', 'stack')).toBe('settled');
    expect(isUserCaptureLive('stack', 'settled')).toBe(false);
  });

  it('reopens the dock on follow-up interim capture only', () => {
    expect(userBubblePlacement('follow_up', true, interim)).toBe('dock');
    expect(userBubblePlacement('follow_up', true, noText)).toBeNull();
  });

  it('settles the user bubble into the stack while thinking', () => {
    expect(userBubblePlacement('thinking', true, withText)).toBe('stack');
    expect(userBubblePlacement('responding', true, withText)).toBe('stack');
    expect(userBubblePhase('thinking', 'stack')).toBe('settled');
    expect(userBubblePhase('responding', 'stack')).toBe('settled');
  });

  it('hides the assistant bubble until thinking starts', () => {
    expect(hasVisibleAssistantContent('', null, 'pending', 'listening', false)).toBe(false);
    expect(hasVisibleAssistantContent('', 'Thinking', 'pending', 'thinking', false)).toBe(true);
    expect(hasVisibleAssistantContent('', null, 'pending', 'thinking', true)).toBe(true);
    expect(hasVisibleAssistantContent('Hello', null, 'streaming', 'responding', false)).toBe(true);
  });

  it('avoids dual-edge stack masks when scroll range is shorter than both fade bands', () => {
    const clientHeight = 400;
    const scrollHeight = clientHeight + 40;
    const dual = stackEdgeMaskStyle(true, true, scrollHeight, clientHeight);
    expect(dual).toBeDefined();
    expect(dual?.maskImage).toContain('transparent 100%');
    expect(dual?.maskImage).not.toContain('transparent 0, #000');

    const tinyRange = stackEdgeMaskStyle(true, true, clientHeight + 8, clientHeight);
    expect(tinyRange?.maskImage).not.toContain('transparent 0');

    const noScroll = stackEdgeMaskStyle(true, true, clientHeight + 1, clientHeight);
    expect(noScroll).toBeUndefined();
  });

  it('keeps a single bottom fade when pinned to the top of a scrollable stack', () => {
    const clientHeight = 400;
    const scrollHeight = clientHeight + 120;
    const topPinned = stackEdgeMaskStyle(false, true, scrollHeight, clientHeight);
    expect(topPinned?.maskImage).toContain('#000 0');
    expect(topPinned?.maskImage).toContain('transparent 100%');
    expect(topPinned?.maskImage).not.toContain('transparent 0');
  });
});
