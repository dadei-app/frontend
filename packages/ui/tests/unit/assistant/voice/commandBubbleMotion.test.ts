import { describe, expect, it } from 'vitest';
import {
  isAssistantLive,
  isUserCaptureLive,
  shouldShowLiveUserBubble,
  userBubblePhase,
  userBubblePlacement,
} from '@dadei/ui/lib/assistant/voice/ui/commandBubbleMotion';

const noText = { isInterim: false, userText: '' };
const withText = { isInterim: false, userText: 'Set a reminder' };
const interim = { isInterim: true, userText: 'Set a' };

describe('commandBubbleMotion', () => {
  it('docks the user bubble while capturing speech', () => {
    expect(userBubblePlacement('listening', true, noText)).toBe('dock');
    expect(userBubblePhase('listening', 'dock')).toBe('thought');
    expect(isUserCaptureLive('dock', 'thought')).toBe(true);
  });

  it('keeps submitted follow-up text in the stack, not the dock', () => {
    expect(userBubblePlacement('follow_up', true, withText)).toBe('stack');
    expect(userBubblePhase('follow_up', 'stack')).toBe('settled');
    expect(isUserCaptureLive('stack', 'settled')).toBe(false);
  });

  it('reopens the dock on follow-up interim capture only', () => {
    expect(userBubblePlacement('follow_up', true, interim)).toBe('dock');
    expect(userBubblePlacement('follow_up', true, noText)).toBeNull();
  });

  it('settles the user bubble into the stack while processing', () => {
    expect(userBubblePlacement('thinking', true, withText)).toBe('stack');
    expect(userBubblePlacement('responding', true, withText)).toBe('stack');
    expect(userBubblePhase('thinking', 'stack')).toBe('settling');
    expect(userBubblePhase('responding', 'stack')).toBe('settled');
    expect(isUserCaptureLive('stack', 'settling')).toBe(false);
  });

  it('shows an empty dock bubble during capture but requires text in the stack', () => {
    expect(shouldShowLiveUserBubble('dock', '')).toBe(true);
    expect(shouldShowLiveUserBubble('stack', '')).toBe(false);
    expect(shouldShowLiveUserBubble('stack', 'hello')).toBe(true);
  });

  it('hides placement when there is no live turn', () => {
    expect(userBubblePlacement('listening', false, noText)).toBeNull();
    expect(userBubblePlacement('idle', false, noText)).toBeNull();
  });

  it('tracks assistant activity during processing states', () => {
    expect(isAssistantLive('thinking')).toBe(true);
    expect(isAssistantLive('responding')).toBe(true);
    expect(isAssistantLive('follow_up')).toBe(false);
  });
});
