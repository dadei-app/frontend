import {
  isInstructionalTranscriptBleed,
  sanitizeCommandTranscript,
} from './commandTranscriptSanitize';
import { normalizeVisibleCommandText } from './wakeWordDetection';

function cleanCommandTranscript(raw: string): string {
  const cleaned = sanitizeCommandTranscript(raw);
  if (!cleaned || isInstructionalTranscriptBleed(cleaned)) return '';
  return cleaned;
}

/** Live caption while listening: full sanitized transcript (wake word stays visible). */
export function liveCommandCaptionText(text: string, fromFollowUp: boolean): string {
  const cleaned = cleanCommandTranscript(text);
  if (!cleaned) return '';
  return cleaned.trim();
}

/**
 * Text sent to inference. Follow-ups are verbatim; wake commands drop only the
 * wake phrase (not fillers like "what" in "what's my birthday").
 */
export function submitCommandText(text: string, fromFollowUp: boolean): string {
  const cleaned = cleanCommandTranscript(text);
  if (!cleaned) return '';
  if (fromFollowUp) return cleaned.trim();
  const stripped = normalizeVisibleCommandText(cleaned);
  return stripped || cleaned.trim();
}
