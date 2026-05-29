/** Lightweight pub/sub so AudioContext can signal speech before ASR interim arrives. */

type SpeechActivityListener = () => void;

const listeners = new Set<SpeechActivityListener>();

export function subscribeVoiceSpeechActivity(listener: SpeechActivityListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyVoiceSpeechActivity(): void {
  for (const listener of listeners) {
    listener();
  }
}
