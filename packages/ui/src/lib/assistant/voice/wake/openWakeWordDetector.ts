import * as ort from 'onnxruntime-web';
import melUrl from '../../audio/models/melspectrogram.onnx?url';
import embeddingUrl from '../../audio/models/embedding_model.onnx?url';
import { SAMPLE_RATE } from '@dadei/ui/lib/assistant/audio/constants';
import {
  DEFAULT_WAKE_THRESHOLD,
  DEFAULT_WAKE_WORD_CLASSIFIERS,
  DETECTION_COOLDOWN_MS,
  EMBEDDING_SIZE,
  EMBEDDING_WINDOW_SIZE,
  MEL_BINS,
  MEL_FRAMES_PER_AUDIO_FRAME,
  MEL_HOP_FRAMES,
  MEL_WINDOW_FRAMES,
  OPEN_WAKEWORD_FRAME_SAMPLES,
  ORT_WASM_DIST_URL,
  PROCESSOR_BUFFER_SAMPLES,
} from '@dadei/ui/lib/assistant/voice/wake/constants';

export type WakeWordLabel = 'hey_dadei' | 'hey_jarvis';

export interface WakeWordClassifierConfig {
  label: WakeWordLabel;
  url: string;
}

export interface OpenWakeWordDetectorConfig {
  threshold?: number;
  wakeWordClassifiers?: WakeWordClassifierConfig[];
}

/** @deprecated Use OpenWakeWordDetectorConfig */
export type WakeWordDetectorConfig = OpenWakeWordDetectorConfig;

type WakeCallback = (timestampMs: number, wakeWord: WakeWordLabel) => void;
let wakeWordRuntimeUnavailable = false;
let ortWasmConfigured = false;

type WakeClassifierSession = {
  label: WakeWordLabel;
  session: ort.InferenceSession;
};

export class OpenWakeWordDetector {
  private readonly threshold: number;
  private readonly wakeWordClassifiers: WakeWordClassifierConfig[];
  private readonly callbacks = new Set<WakeCallback>();
  private melSession: ort.InferenceSession | null = null;
  private embeddingSession: ort.InferenceSession | null = null;
  private wakeClassifierSessions: WakeClassifierSession[] = [];
  private audioContext: globalThis.AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private running = false;
  private pendingAudio = new Float32Array(0);
  private melBuffer: Float32Array[] = [];
  private embeddingBuffer: Float32Array[] = [];
  private inferenceQueue: Promise<void> = Promise.resolve();
  private lastDetectedAtMs = 0;

  constructor(config: OpenWakeWordDetectorConfig = {}) {
    this.threshold = config.threshold ?? DEFAULT_WAKE_THRESHOLD;
    this.wakeWordClassifiers = config.wakeWordClassifiers ?? DEFAULT_WAKE_WORD_CLASSIFIERS;
    this.resetPipelineState();
  }

  onWakeWord(callback: WakeCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  async start(audioStream: MediaStream): Promise<void> {
    if (this.running) return;
    if (wakeWordRuntimeUnavailable) {
      throw new Error('Wake-word runtime is disabled after a previous initialization failure.');
    }

    await this.initializeModels();

    const ctx = new window.AudioContext({ sampleRate: SAMPLE_RATE });
    this.audioContext = ctx;
    this.sourceNode = ctx.createMediaStreamSource(audioStream);
    this.processorNode = ctx.createScriptProcessor(PROCESSOR_BUFFER_SAMPLES, 1, 1);
    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(ctx.destination);

    this.running = true;
    this.processorNode.onaudioprocess = (event) => {
      if (!this.running) return;
      const chunk = event.inputBuffer.getChannelData(0);
      this.appendAudioChunk(chunk);
      while (this.pendingAudio.length >= OPEN_WAKEWORD_FRAME_SAMPLES) {
        const frame = this.pendingAudio.slice(0, OPEN_WAKEWORD_FRAME_SAMPLES);
        this.pendingAudio = this.pendingAudio.slice(OPEN_WAKEWORD_FRAME_SAMPLES);
        this.inferenceQueue = this.inferenceQueue
          .then(() => this.processFrame(frame))
          .catch((error: unknown) => {
            this.handleRuntimeFailure('inference pipeline', error);
          });
      }
    };
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.processorNode) {
      this.processorNode.onaudioprocess = null;
      this.processorNode.disconnect();
      this.processorNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
    this.melSession = null;
    this.embeddingSession = null;
    this.wakeClassifierSessions = [];
    this.pendingAudio = new Float32Array(0);
    this.inferenceQueue = Promise.resolve();
    this.resetPipelineState();
  }

  private static configuredOrtWasmPath(): void {
    if (ortWasmConfigured) return;
    ort.env.wasm.wasmPaths = ORT_WASM_DIST_URL;
    ortWasmConfigured = true;
  }

  private async initializeModels(): Promise<void> {
    try {
      OpenWakeWordDetector.configuredOrtWasmPath();
      const sessionOptions: ort.InferenceSession.SessionOptions = { executionProviders: ['wasm'] };

      this.melSession = await ort.InferenceSession.create(melUrl, sessionOptions);
      // eslint-disable-next-line no-console
      console.info('[WakeWord] model load success: melspectrogram');

      this.embeddingSession = await ort.InferenceSession.create(embeddingUrl, sessionOptions);
      // eslint-disable-next-line no-console
      console.info('[WakeWord] model load success: embedding_model');

      this.wakeClassifierSessions = await Promise.all(
        this.wakeWordClassifiers.map(async ({ label, url }) => {
          const session = await ort.InferenceSession.create(url, sessionOptions);
          // eslint-disable-next-line no-console
          console.info(`[WakeWord] model load success: ${label}`);
          return { label, session };
        }),
      );
    } catch (error) {
      const stage = this.melSession
        ? this.embeddingSession
          ? 'wake_classifier'
          : 'embedding_model'
        : 'melspectrogram';
      // eslint-disable-next-line no-console
      console.info(`[WakeWord] model load failure: ${stage}`, error);
      this.handleRuntimeFailure(`model load (${stage})`, error);
      throw error instanceof Error ? error : new Error('Wake-word model initialization failed');
    }
  }

  private appendAudioChunk(chunk: Float32Array): void {
    const combined = new Float32Array(this.pendingAudio.length + chunk.length);
    combined.set(this.pendingAudio, 0);
    combined.set(chunk, this.pendingAudio.length);
    this.pendingAudio = combined;
  }

  private async processFrame(frame: Float32Array): Promise<void> {
    if (
      !this.running ||
      !this.melSession ||
      !this.embeddingSession ||
      this.wakeClassifierSessions.length === 0
    ) {
      return;
    }

    const scaledFrame = new Float32Array(frame.length);
    for (let i = 0; i < frame.length; i++) {
      const s = Math.max(-1, Math.min(1, frame[i]));
      scaledFrame[i] = s * 32767;
    }

    const melInputName = this.melSession.inputNames[0];
    const melOutputName = this.melSession.outputNames[0];
    const melFeeds: Record<string, ort.Tensor> = {
      [melInputName]: new ort.Tensor('float32', scaledFrame, [1, OPEN_WAKEWORD_FRAME_SAMPLES]),
    };
    const melResult = await this.melSession.run(melFeeds);
    const melData = melResult[melOutputName].data as Float32Array;

    for (let i = 0; i < melData.length; i++) {
      melData[i] = melData[i] / 10.0 + 2.0;
    }
    for (let i = 0; i < MEL_FRAMES_PER_AUDIO_FRAME; i++) {
      const start = i * MEL_BINS;
      const melFrame = new Float32Array(melData.subarray(start, start + MEL_BINS));
      this.melBuffer.push(melFrame);
    }

    while (this.melBuffer.length >= MEL_WINDOW_FRAMES) {
      const flattenedMel = new Float32Array(MEL_WINDOW_FRAMES * MEL_BINS);
      for (let i = 0; i < MEL_WINDOW_FRAMES; i++) {
        flattenedMel.set(this.melBuffer[i], i * MEL_BINS);
      }

      const embeddingInputName = this.embeddingSession.inputNames[0];
      const embeddingOutputName = this.embeddingSession.outputNames[0];
      const embeddingFeeds: Record<string, ort.Tensor> = {
        [embeddingInputName]: new ort.Tensor('float32', flattenedMel, [1, MEL_WINDOW_FRAMES, MEL_BINS, 1]),
      };
      const embeddingResult = await this.embeddingSession.run(embeddingFeeds);
      const embeddingData = embeddingResult[embeddingOutputName].data as Float32Array;

      this.embeddingBuffer.shift();
      this.embeddingBuffer.push(new Float32Array(embeddingData));

      const flattenedEmbeddings = new Float32Array(EMBEDDING_WINDOW_SIZE * EMBEDDING_SIZE);
      for (let i = 0; i < this.embeddingBuffer.length; i++) {
        flattenedEmbeddings.set(this.embeddingBuffer[i], i * EMBEDDING_SIZE);
      }

      const wakeInputTensor = new ort.Tensor('float32', flattenedEmbeddings, [
        1,
        EMBEDDING_WINDOW_SIZE,
        EMBEDDING_SIZE,
      ]);

      let bestScore = 0;
      let bestLabel: WakeWordLabel | null = null;
      for (const { label, session } of this.wakeClassifierSessions) {
        const wakeInputName = session.inputNames[0];
        const wakeOutputName = session.outputNames[0];
        const wakeResult = await session.run({
          [wakeInputName]: wakeInputTensor,
        });
        const score = (wakeResult[wakeOutputName].data as Float32Array)[0] ?? 0;
        if (score > bestScore) {
          bestScore = score;
          bestLabel = label;
        }
      }

      const now = Date.now();
      if (
        bestLabel &&
        bestScore > this.threshold &&
        now - this.lastDetectedAtMs >= DETECTION_COOLDOWN_MS
      ) {
        this.lastDetectedAtMs = now;
        // eslint-disable-next-line no-console
        console.info(
          `[WakeWord] detected ${bestLabel} (score=${bestScore.toFixed(4)})`,
        );
        this.callbacks.forEach((cb) => cb(now, bestLabel));
      }

      this.melBuffer.splice(0, MEL_HOP_FRAMES);
    }
  }

  private resetPipelineState(): void {
    this.pendingAudio = new Float32Array(0);
    this.melBuffer = [];
    this.embeddingBuffer = Array.from(
      { length: EMBEDDING_WINDOW_SIZE },
      () => new Float32Array(EMBEDDING_SIZE).fill(0),
    );
    this.lastDetectedAtMs = 0;
  }

  private handleRuntimeFailure(stage: string, error: unknown): void {
    wakeWordRuntimeUnavailable = true;
    this.running = false;
    // eslint-disable-next-line no-console
    console.info(`[WakeWord] runtime failure: ${stage}`, error);
    void this.stop();
  }
}

/** @deprecated Use OpenWakeWordDetector */
export const WakeWordDetector = OpenWakeWordDetector;
