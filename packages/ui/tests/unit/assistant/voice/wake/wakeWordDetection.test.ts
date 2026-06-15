import { describe, expect, it } from 'vitest';
import {
  normalizeVisibleCommandText,
  normalizeTranscriptForWake,
  stripLeadingWakeDisfluencies,
  transcriptLikelyContainsWakeWord,
  transcriptStartsWithWakeCommand,
} from '@dadei/ui/lib/assistant/voice/wake/wakeWordDetection';

describe('stripLeadingWakeDisfluencies', () => {
  it('removes a chain of leading fillers', () => {
    expect(stripLeadingWakeDisfluencies('Um, uh, Dadei')).toBe('Dadei');
    expect(stripLeadingWakeDisfluencies('  okay,   so, well  dahdee')).toBe('dahdee');
  });

  it('caps strips at MAX_DISFLUENCY_STRIPS', () => {
    expect(stripLeadingWakeDisfluencies('um um um um um Dadei')).toBe('um Dadei');
  });
});

describe('normalizeTranscriptForWake', () => {
  it('trims then strips fillers', () => {
    expect(normalizeTranscriptForWake('  Hey, Dadei  ')).toBe('Dadei');
  });
});

describe('transcriptStartsWithWakeCommand', () => {
  it('accepts Dadei variants at start', () => {
    expect(transcriptStartsWithWakeCommand('Dadei')).toBe(true);
    expect(transcriptStartsWithWakeCommand('dadei, what time')).toBe(true);
    expect(transcriptStartsWithWakeCommand('Dah-dee please')).toBe(true);
  });

  it('accepts Assistant at start', () => {
    expect(transcriptStartsWithWakeCommand('Assistant, what time')).toBe(true);
    expect(transcriptStartsWithWakeCommand('assistant: go')).toBe(true);
  });

  it('accepts wake after leading disfluencies', () => {
    expect(transcriptStartsWithWakeCommand('Um, Dadei')).toBe(true);
    expect(transcriptStartsWithWakeCommand('Uh, Assistant, remind me')).toBe(true);
  });

  it('rejects mid-sentence wake', () => {
    expect(transcriptStartsWithWakeCommand('I said and Dadei earlier')).toBe(false);
    expect(transcriptStartsWithWakeCommand('talk to my assistant, please')).toBe(false);
    expect(transcriptStartsWithWakeCommand('I really like my assistant')).toBe(false);
  });

  it('accepts phonetic assistant and dadei mishearings at start', () => {
    expect(transcriptStartsWithWakeCommand('assisted')).toBe(true);
    expect(transcriptStartsWithWakeCommand('Assisted, hello')).toBe(true);
    expect(transcriptStartsWithWakeCommand('daddy')).toBe(true);
    expect(transcriptStartsWithWakeCommand('Daddy, turn on')).toBe(true);
  });

  it('rejects ASR prompt bleed starting with assistant', () => {
    expect(
      transcriptStartsWithWakeCommand(
        'Assistant means the voice assistant, not assist.',
      ),
    ).toBe(false);
  });

  it('accepts bare assistant wake', () => {
    expect(transcriptStartsWithWakeCommand('Assistant')).toBe(true);
    expect(transcriptStartsWithWakeCommand('assistant please')).toBe(true);
  });

  it('rejects instructional transcribe bleed as first word', () => {
    expect(transcriptStartsWithWakeCommand('Transcribe the problem')).toBe(false);
    expect(transcriptStartsWithWakeCommand('transcribe exactly what is spoken')).toBe(false);
  });
});

describe('transcriptLikelyContainsWakeWord', () => {
  it('finds assistant or dadei shapes in text', () => {
    expect(transcriptLikelyContainsWakeWord('foo Dadei bar')).toBe(true);
    expect(transcriptLikelyContainsWakeWord('my assistant is here')).toBe(true);
  });
});

describe('normalizeVisibleCommandText', () => {
  it('strips wake words and leading punctuation', () => {
    expect(normalizeVisibleCommandText('Assistant, set a reminder')).toBe('set a reminder');
    expect(normalizeVisibleCommandText('Dadei what time is it')).toBe('what time is it');
  });

  it('handles disfluencies before wake words', () => {
    expect(normalizeVisibleCommandText('Um, Assistant: call mom')).toBe('call mom');
  });

  it('keeps non-wake text unchanged', () => {
    expect(normalizeVisibleCommandText('turn on the lights')).toBe('turn on the lights');
  });

  it('preserves standalone greetings as valid commands', () => {
    expect(normalizeVisibleCommandText('hello')).toBe('hello');
    expect(normalizeVisibleCommandText('Hello!')).toBe('Hello!');
    expect(normalizeVisibleCommandText("what's up")).toBe("what's up");
    expect(normalizeVisibleCommandText("hi what's the weather")).toBe("what's the weather");
  });
});
