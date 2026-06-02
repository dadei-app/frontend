import { describe, expect, it } from 'vitest';
import {
  type InterimCaptionState,
  normalizeVisibleCommandText,
  normalizeTranscriptForWake,
  stabilizeInterimCaptionState,
  stripLeadingWakeDisfluencies,
  transcriptLikelyContainsWakeWord,
  transcriptStartsWithWakeCommand,
} from './wakeWordDetection';

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
});

describe('stabilizeInterimCaptionState', () => {
  const initial: InterimCaptionState = { utteranceId: null, interimSeq: 0, caption: '' };

  it('grows caption monotonically for in-order interim updates', () => {
    const a = stabilizeInterimCaptionState(initial, 'turn', 12, 1);
    const b = stabilizeInterimCaptionState(a, 'turn on', 12, 2);
    const c = stabilizeInterimCaptionState(b, 'turn on the lights', 12, 3);
    expect(c.caption).toBe('turn on the lights');
    expect(c.interimSeq).toBe(3);
    expect(c.utteranceId).toBe(12);
  });

  it('drops out-of-order interim sequence updates', () => {
    const a = stabilizeInterimCaptionState(initial, 'turn on the lights', 33, 5);
    const stale = stabilizeInterimCaptionState(a, 'turn on', 33, 4);
    expect(stale.caption).toBe('turn on the lights');
    expect(stale.interimSeq).toBe(5);
  });

  it('suppresses severe snap-back shrink within same utterance', () => {
    const a = stabilizeInterimCaptionState(initial, 'turn on the kitchen lights please', 9, 1);
    const b = stabilizeInterimCaptionState(a, 'turn', 9, 2);
    expect(b.caption).toBe('turn on the kitchen lights please');
  });
});
