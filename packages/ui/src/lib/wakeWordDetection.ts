/**
 * On-device wake ASR (Whisper) is weak on rare names. We bias decoding with initial_prompt
 * and accept several plausible spellings / “dah dee” phonetic outputs, plus “Assistant”.
 */

import {
  isInstructionalTranscriptBleed,
  sanitizeCommandTranscript,
} from './commandTranscriptSanitize';

const LEADING_DISFLUENCY =
  /^[\s,.;:!?'"`]+|^(?:um|uh|ugh|erm|er|hm+|hmm+|hey|hi|hello|ok|okay|so|well)\b[\s,.;:!?'"`]*/iu;

/** Max leading filler words to strip before wake-token detection. */
const MAX_DISFLUENCY_STRIPS = 4;
const INTERIM_SHRINK_GUARD_RATIO = 0.7;

/**
 * Strips a bounded chain of leading hesitation words (e.g. "Um, uh, Dadei").
 */
export function stripLeadingWakeDisfluencies(text: string): string {
  let s = text.trim();
  for (let i = 0; i < MAX_DISFLUENCY_STRIPS; i++) {
    const next = s.replace(LEADING_DISFLUENCY, '').trim();
    if (next === s) break;
    s = next;
  }
  return s;
}

export function normalizeTranscriptForWake(text: string): string {
  return stripLeadingWakeDisfluencies(text.trim());
}

/** Short bias only — long prompts bleed into transcripts and the command bubble. */
export const WAKE_WORD_INITIAL_PROMPT = 'Dadei. Wake words: Dadei, Assistant.';

const ASSISTANT_WAKE_BAD_FOLLOW = new Set([
  'means',
  'is',
  'was',
  'will',
  'has',
  'had',
  'are',
  'were',
  'can',
  'could',
  'should',
  'would',
]);

/** Instructional ASR hallucinations only — not spoken wake words. */
const WAKE_REJECT_FIRST_WORDS = new Set([
  'transcribe',
  'transcribed',
  'transcript',
  'transcribing',
]);

const ASSISTANT_WAKE_FIRST_WORDS = new Set([
  'assistant',
  'assisted',
  'assisting',
  'assistive',
  'assist',
  'assists',
  'assistance',
  'system',
]);

const DADEI_WAKE_FIRST_WORDS = new Set([
  'dadei',
  'dadey',
  'dadee',
  'daday',
  'dah-dee',
  'dahdee',
  'da-dee',
  'daddy',
  'daddies',
  'dadai',
  'dadeh',
]);

/**
 * True when the transcript is plausibly the user saying a wake word.
 */
export function transcriptLikelyContainsWakeWord(text: string): boolean {
  const raw = text.trim();
  if (!raw) return false;

  const lower = raw.toLowerCase().normalize('NFKD');

  if (/\bassistant\b/.test(lower)) return true;

  const hasDadeiShape =
    /\bdadei\b/.test(lower) ||
    /\bdadey\b/.test(lower) ||
    /\bdadee\b/.test(lower) ||
    /\bdaday\b/.test(lower) ||
    /\bdah[-\s]?dee\b/.test(lower) ||
    /\bda[-\s]?dee\b/.test(lower) ||
    /\bda\s+d[eiy]\b/.test(lower) ||
    /\bda[-\s]?dei\b/.test(lower) ||
    /\bdade\s*[-]?\s*i\b/.test(lower);

  if (hasDadeiShape) return true;

  const collapsed = lower.replace(/[^a-z]/g, '');
  if (/dadei|dadey|dadee|daday|dahdee|dadai|dadeh/.test(collapsed)) return true;
  if (/assistant/.test(collapsed)) return true;

  return false;
}

function startsWithAssistantWake(lead: string, firstWord: string, collapsedLead: string): boolean {
  if (/\bvoice assistant\b/i.test(lead)) return false;

  if (
    /^assistant\b/i.test(lead) ||
    /^assisted\b/i.test(lead) ||
    /^assisting\b/i.test(lead) ||
    /^assistive\b/i.test(lead) ||
    /^assist\b/i.test(lead) ||
    /^assists\b/i.test(lead) ||
    /^assistance\b/i.test(lead) ||
    /^system\b/i.test(lead)
  ) {
    const follow = lead.match(/^[\w'-]+\b[,.:]?\s*(\S+)/i);
    if (follow) {
      const nextWord = (follow[1] ?? '').toLowerCase().replace(/[,.:;]+$/, '');
      if (nextWord && ASSISTANT_WAKE_BAD_FOLLOW.has(nextWord)) return false;
    }
    return true;
  }

  if (ASSISTANT_WAKE_FIRST_WORDS.has(firstWord)) return true;
  return /^assistant/.test(collapsedLead);
}

function startsWithDadeiWake(lead: string, collapsedLead: string, firstWord: string): boolean {
  if (DADEI_WAKE_FIRST_WORDS.has(firstWord)) return true;

  const startsShape =
    /^dadei\b/i.test(lead) ||
    /^dadey\b/i.test(lead) ||
    /^dadee\b/i.test(lead) ||
    /^daday\b/i.test(lead) ||
    /^dah[-\s]?dee\b/i.test(lead) ||
    /^da[-\s]?dee\b/i.test(lead) ||
    /^da\s+d[eiy]\b/i.test(lead) ||
    /^da[-\s]?dei\b/i.test(lead) ||
    /^dade\s*[-]?\s*i\b/i.test(lead) ||
    /^daddy\b/i.test(lead);

  if (startsShape) return true;

  return /^(dadei|dadey|dadee|daday|dahdee|dadai|dadeh|daddy)/.test(collapsedLead);
}

/**
 * True when the transcript begins with a wake token after optional leading fillers
 * (“Um, Dadei …”). Mid-sentence “… and Dadei …” is not treated as a command.
 */
export function transcriptStartsWithWakeCommand(text: string): boolean {
  const normalized = normalizeTranscriptForWake(text);
  if (!normalized) return false;

  const lower = normalized.toLowerCase().normalize('NFKD');
  const lead = lower.replace(/^[^\p{L}\p{N}]+/u, '');
  if (!lead) return false;

  const firstWord = lead.match(/^[\p{L}\p{N}'-]+/u)?.[0]?.toLowerCase() ?? '';
  if (!firstWord || WAKE_REJECT_FIRST_WORDS.has(firstWord)) return false;

  const collapsedLead = lead.replace(/[^a-z]/g, '');

  if (startsWithAssistantWake(lead, firstWord, collapsedLead)) return true;
  if (startsWithDadeiWake(lead, collapsedLead, firstWord)) return true;

  return false;
}

/**
 * Produces the exact visible command text after wake-word stripping.
 * This output should be rendered in UI and sent as payload verbatim.
 */
export function normalizeVisibleCommandText(text: string): string {
  const cleaned = sanitizeCommandTranscript(text);
  if (!cleaned || isInstructionalTranscriptBleed(cleaned)) return '';

  const normalized = normalizeTranscriptForWake(cleaned);
  if (!normalized) return '';

  let out = normalized;
  out = out.replace(/^\s*da[- ]?dei\b[,.]?\s*/i, '');
  out = out.replace(/^\s*dadei\b[,.]?\s*/i, '');
  out = out.replace(/^\s*daddy\b[,.]?\s*/i, '');
  out = out.replace(/^\s*assistant\b[,.:]?\s*/i, '');
  out = out.replace(/^\s*assisted\b[,.:]?\s*/i, '');
  out = out.replace(/^\s*assisting\b[,.:]?\s*/i, '');
  out = out.replace(/^\s*assistive\b[,.:]?\s*/i, '');
  out = out.replace(/^\s*assist\b[,.:]?\s*/i, '');
  out = out.replace(/^\s*assists\b[,.:]?\s*/i, '');
  out = out.replace(/^\s*assistance\b[,.:]?\s*/i, '');
  out = out.replace(/^\s*system\b[,.:]?\s*/i, '');
  out = out.replace(/\s+/g, ' ').trim();
  return out;
}

export interface InterimCaptionState {
  utteranceId: number | null;
  interimSeq: number;
  caption: string;
}

function normalizeInterimCaption(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function longestCommonPrefixLen(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let idx = 0;
  while (idx < max && a[idx] === b[idx]) idx += 1;
  return idx;
}

export function stabilizeInterimCaptionState(
  prev: InterimCaptionState,
  rawCaption: string,
  utteranceId: number | null,
  interimSeq: number | null,
): InterimCaptionState {
  const candidate = rawCaption.trim();
  if (!candidate) return prev;
  const seq = typeof interimSeq === 'number' && Number.isFinite(interimSeq) ? interimSeq : null;
  const hasUtteranceId = typeof utteranceId === 'number' && Number.isFinite(utteranceId);
  const changedUtterance = hasUtteranceId && prev.utteranceId !== utteranceId;
  const base: InterimCaptionState = changedUtterance
    ? { utteranceId: utteranceId!, interimSeq: 0, caption: '' }
    : {
        utteranceId: hasUtteranceId ? utteranceId : prev.utteranceId,
        interimSeq: prev.interimSeq,
        caption: prev.caption,
      };

  if (seq != null && seq <= base.interimSeq) return base;
  const nextSeq = seq ?? base.interimSeq;
  const prevCaption = base.caption.trim();
  if (!prevCaption) return { ...base, interimSeq: nextSeq, caption: candidate };
  const prevNorm = normalizeInterimCaption(prevCaption);
  const nextNorm = normalizeInterimCaption(candidate);
  if (!nextNorm || nextNorm === prevNorm) return { ...base, interimSeq: nextSeq };
  if (nextNorm.startsWith(prevNorm)) return { ...base, interimSeq: nextSeq, caption: candidate };
  if (prevNorm.startsWith(nextNorm)) {
    const minAllowed = Math.max(4, Math.floor(prevNorm.length * INTERIM_SHRINK_GUARD_RATIO));
    if (nextNorm.length < minAllowed) return { ...base, interimSeq: nextSeq };
  } else {
    const lcp = longestCommonPrefixLen(prevNorm, nextNorm);
    const weakAlignment = lcp < Math.max(3, Math.floor(Math.min(prevNorm.length, nextNorm.length) * 0.45));
    if (weakAlignment && nextNorm.length < prevNorm.length) return { ...base, interimSeq: nextSeq };
  }
  return { ...base, interimSeq: nextSeq, caption: candidate };
}
