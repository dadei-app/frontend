/**
 * Strip Whisper initial-prompt hallucinations before UI display or command submit.
 * Bleed removal is start-anchored so mid-utterance phrases cannot eat command words
 * (e.g. "what time is it" losing "what" via "what is spoken" bleed).
 */

const BLEED_PATTERNS: RegExp[] = [
  /^\s*transcribe\s+exactly\s+what\s+is\s+spoken\b[\s,.;:!?'"`]*/gi,
  /^\s*transcribe\s+the\s+problem\b[\s,.;:!?'"`]*/gi,
  /^\s*transcribe\s+exactly\b[\s,.;:!?'"`]*/gi,
  /^\s*do\s+not\s+add\s+extra\s+words\b[\s,.;:!?'"`]*/gi,
  /^\s*wake\s+words?\s*:\s*dadei\b[\s,.;:!?'"`]*/gi,
  /^\s*spelled\s+d-a-d-e-i\b[\s,.;:!?'"`]*/gi,
  /^\s*pronounced\s+dah-dee\b[\s,.;:!?'"`]*/gi,
  /^\s*assistant\s+means\s+the\s+voice\s+assistant\b[\s,.;:!?'"`]*/gi,
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
  if (/^transcribe\s+(exactly|the)\b/.test(s)) return true;
  if (/^do\s+not\s+add\s+extra\s+words\b/.test(s)) return true;
  if (/^wake\s+words?\s*:/.test(s)) return true;
  return false;
}
