/**
 * On-device wake ASR (Whisper) is weak on rare names. We bias decoding with initial_prompt
 * and accept several plausible spellings / “dah dee” phonetic outputs, plus “Assistant”.
 */

const LEADING_DISFLUENCY =
  /^[\s,.;:!?'"`]+|^(?:um|uh|ugh|erm|er|hm+|hmm+|hey|hi|hello|ok|okay|so|well)\b[\s,.;:!?'"`]*/iu;

/** Max leading filler words to strip before wake-token detection. */
const MAX_DISFLUENCY_STRIPS = 4;

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

export const WAKE_WORD_INITIAL_PROMPT = [
  'Dadei.',
  'Wake words: Dadei, Assistant.',
  'Spelled D-A-D-E-I.',
  'Pronounced dah-dee, like "dah dee" or "da dee".',
  'Not "daddy". Not "day day". Not "diddy".',
  'Assistant means the voice assistant, not "assist".',
].join(' ');

/**
 * True when the transcript is plausibly the user saying a wake word.
 * Intentionally stricter on "daddy" alone to avoid accidental triggers.
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

  if (/\bdaddy\b/.test(lower)) return false;

  return false;
}

function startsWithAssistantWake(lead: string, collapsedLead: string): boolean {
  if (/^assistant\b/i.test(lead)) return true;
  return /^assistant/i.test(collapsedLead);
}

function startsWithDadeiWake(lead: string, collapsedLead: string, firstWord: string): boolean {
  if (firstWord === 'daddy') return false;

  const startsShape =
    /^dadei\b/i.test(lead) ||
    /^dadey\b/i.test(lead) ||
    /^dadee\b/i.test(lead) ||
    /^daday\b/i.test(lead) ||
    /^dah[-\s]?dee\b/i.test(lead) ||
    /^da[-\s]?dee\b/i.test(lead) ||
    /^da\s+d[eiy]\b/i.test(lead) ||
    /^da[-\s]?dei\b/i.test(lead) ||
    /^dade\s*[-]?\s*i\b/i.test(lead);

  if (startsShape) return true;

  return /^(dadei|dadey|dadee|daday|dahdee|dadai|dadeh)/.test(collapsedLead);
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
  if (firstWord === 'daddy') return false;

  const collapsedLead = lead.replace(/[^a-z]/g, '');

  if (startsWithAssistantWake(lead, collapsedLead)) return true;
  if (startsWithDadeiWake(lead, collapsedLead, firstWord)) return true;

  return false;
}

/**
 * Produces the exact visible command text after wake-word stripping.
 * This output should be rendered in UI and sent as payload verbatim.
 */
export function normalizeVisibleCommandText(text: string): string {
  const normalized = normalizeTranscriptForWake(text);
  if (!normalized) return '';

  let out = normalized;
  out = out.replace(/^\s*da[- ]?dei[,.]?\s*/i, '');
  out = out.replace(/^\s*assistant\b[,.:]?\s*/i, '');
  out = out.replace(/\s+/g, ' ').trim();
  return out;
}
