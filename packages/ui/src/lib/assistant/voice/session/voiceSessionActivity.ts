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

/** Stop forwarding mic chunks and seal the utterance on the server (sync, no React wait). */

type CaptureCommitListener = () => void;

const captureCommitListeners = new Set<CaptureCommitListener>();

export function subscribeCommandCaptureCommit(listener: CaptureCommitListener): () => void {
  captureCommitListeners.add(listener);
  return () => captureCommitListeners.delete(listener);
}

export function notifyCommandCaptureCommit(): void {
  for (const listener of captureCommitListeners) {
    listener();
  }
}

type CaptureRearmListener = () => void;

const captureRearmListeners = new Set<CaptureRearmListener>();

export function subscribeCommandCaptureRearm(listener: CaptureRearmListener): () => void {
  captureRearmListeners.add(listener);
  return () => captureRearmListeners.delete(listener);
}

export function notifyCommandCaptureRearm(): void {
  for (const listener of captureRearmListeners) {
    listener();
  }
}

type CaptureSpeechListener = () => void;

const captureSpeechListeners = new Set<CaptureSpeechListener>();

export function subscribeCommandCaptureSpeech(listener: CaptureSpeechListener): () => void {
  captureSpeechListeners.add(listener);
  return () => captureSpeechListeners.delete(listener);
}

export function notifyCommandCaptureSpeech(): void {
  for (const listener of captureSpeechListeners) {
    listener();
  }
}
