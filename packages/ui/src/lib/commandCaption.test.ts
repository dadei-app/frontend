import { describe, expect, it } from 'vitest';
import { liveCommandCaptionText, submitCommandText } from './commandCaption';

describe('liveCommandCaptionText', () => {
  it('keeps the full sanitized transcript while listening', () => {
    expect(liveCommandCaptionText('Assistant, tell me the weather', false)).toBe(
      'Assistant, tell me the weather',
    );
    expect(liveCommandCaptionText('Today show my calendar', false)).toBe('Today show my calendar');
  });
});

describe('submitCommandText', () => {
  it('strips wake words only when submitting a wake command', () => {
    expect(submitCommandText('Assistant, tell me the weather', false)).toBe('tell me the weather');
    expect(submitCommandText('Dadei what time is it', false)).toBe('what time is it');
    expect(submitCommandText('hey jarvis whats my birthday', false)).toBe('whats my birthday');
  });

  it('does not strip command words that resemble wake prefixes', () => {
    expect(submitCommandText('Today show my calendar', false)).toBe('Today show my calendar');
    expect(submitCommandText('Ready to schedule a meeting', false)).toBe('Ready to schedule a meeting');
    expect(submitCommandText('Tell me the weather', false)).toBe('Tell me the weather');
  });

  it('keeps follow-up text unchanged', () => {
    expect(submitCommandText('and tomorrow too', true)).toBe('and tomorrow too');
  });
});

describe('caption vs submit parity', () => {
  it('does not drop the first command word between preview and submit display', () => {
    const raw = 'Tell me the weather today';
    expect(liveCommandCaptionText(raw, false)).toBe(raw);
    expect(submitCommandText(raw, false)).toBe(raw);
  });
});
