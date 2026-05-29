/**
 * Strip Whisper initial-prompt hallucinations before UI display or command submit.
 */

const BLEED_PATTERNS: RegExp[] = [
  /\btranscribe\s+exactly\s+what\s+is\s+spoken\b/gi,
  /\btranscribe\s+the\s+problem\b/gi,
  /\btranscribe\s+exactly\b/gi,
  /\bdo\s+not\s+add\s+extra\s+words\b/gi,
  /\bwake\s+words?\s*:\s*dadei\b/gi,
  /\bspelled\s+d-a-d-e-i\b/gi,
  /\bpronounced\s+dah-dee\b/gi,
  /\bassistant\s+means\s+the\s+voice\s+assistant\b/gi,
  /^\s*transcribe\b[,.:;]?\s*/i,
  /^\s*transcript\b[,.:;]?\s*/i,
];

export function sanitizeCommandTranscript(text: string): string {
  let out = text.trim();
  if (!out) return '';

  for (const pattern of BLEED_PATTERNS) {
    out = out.replace(pattern, ' ');
  }

  return out.replace(/\s+/g, ' ').trim();
}

/** True when the transcript is mostly ASR instruction hallucination. */
export function isInstructionalTranscriptBleed(text: string): boolean {
  const s = text.trim().toLowerCase();
  if (!s) return false;
  if (/^transcribe\b/.test(s)) return true;
  if (/^transcript\b/.test(s)) return true;
  if (/\btranscribe\s+(exactly|the)\b/.test(s)) return true;
  if (/\bdo\s+not\s+add\s+extra\s+words\b/.test(s)) return true;
  if (/\bwake\s+words?\s*:/.test(s)) return true;
  return false;
}
