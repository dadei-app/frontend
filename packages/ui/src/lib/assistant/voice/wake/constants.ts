import heyJarvisUrl from '../../audio/models/hey_jarvis.onnx?url';
import heyDadeiUrl from '../../audio/models/hey_dadei.onnx?url';
import type { WakeWordClassifierConfig } from './openWakeWordDetector';

export const PROCESSOR_BUFFER_SAMPLES = 2048;
export const OPEN_WAKEWORD_FRAME_SAMPLES = 1280;
export const MEL_BINS = 32;
export const MEL_WINDOW_FRAMES = 76;
export const MEL_HOP_FRAMES = 8;
export const MEL_FRAMES_PER_AUDIO_FRAME = 5;
export const EMBEDDING_SIZE = 96;
export const EMBEDDING_WINDOW_SIZE = 16;
export const DEFAULT_WAKE_THRESHOLD = 0.82;
export const DETECTION_COOLDOWN_MS = 1500;
export const ORT_WEB_VERSION = '1.26.0';
export const ORT_WASM_DIST_URL = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_WEB_VERSION}/dist/`;

export const DEFAULT_WAKE_WORD_CLASSIFIERS: WakeWordClassifierConfig[] = [
  // { label: 'hey_dadei', url: heyDadeiUrl },
  { label: 'hey_jarvis', url: heyJarvisUrl },
];
