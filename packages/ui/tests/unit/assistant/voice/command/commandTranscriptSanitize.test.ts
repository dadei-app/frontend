import { describe, expect, it } from 'vitest';
import { sanitizeCommandTranscript } from '@dadei/ui/lib/assistant/voice/command/commandTranscriptSanitize';
import { normalizeVisibleCommandText, stripLeadingWakeDisfluencies } from '@dadei/ui/lib/assistant/voice/command/wakeWordDetection';
import { liveCommandCaptionText, submitCommandText } from '@dadei/ui/lib/assistant/voice/command/commandCaption';

describe('sanitizeCommandTranscript', () => {
  it('preserves legitimate commands with what', () => {
    expect(sanitizeCommandTranscript('hey jarvis, what time is it')).toBe('hey jarvis, what time is it');
    expect(sanitizeCommandTranscript('what time is it')).toBe('what time is it');
  });

  it('does not strip what from commands when ASR bleeds instruction phrases mid-utterance', () => {
    const asrBleed =
      'hey jarvis transcribe exactly what is spoken time is it';
    expect(sanitizeCommandTranscript(asrBleed)).toBe(asrBleed);
    expect(liveCommandCaptionText(asrBleed, false)).toBe(asrBleed);
  });

  it('still strips instruction bleed anchored at the start', () => {
    expect(sanitizeCommandTranscript('transcribe exactly what is spoken time is it')).toBe('time is it');
  });
});

describe('hey jarvis what time is it', () => {
  it('keeps what in live caption and submit text', () => {
    const raw = 'hey jarvis, what time is it';
    expect(liveCommandCaptionText(raw, false)).toBe(raw);
    expect(submitCommandText(raw, false)).toBe('what time is it');
    expect(normalizeVisibleCommandText(raw)).toBe('what time is it');
  });

  it('does not treat what as a disfluency filler', () => {
    expect(stripLeadingWakeDisfluencies('what time is it')).toBe('what time is it');
  });
});
