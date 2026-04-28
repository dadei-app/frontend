/// <reference lib="webworker" />

import { env, pipeline } from '@xenova/transformers';
import { WAKE_WORD_INITIAL_PROMPT } from '../lib/wakeWordDetection';

// Default local path is `/models/...`. Vite answers unknown paths with index.html (200),
// so the hub loader never falls back to Hugging Face and JSON.parse throws on HTML.
env.allowLocalModels = false;

// Whisper’s ONNX graph triggers many `[W:onnxruntime: … CleanUnusedInitializers…]` lines
// (one per unused initializer). Default log level is `warning`, which floods the console.
env.backends.onnx.logLevel = 'error';

/** Hub still reads `transformers-cache` by local key first; evict stale SPA HTML from older sessions. */
async function purgePoisonedTransformersCache(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open('transformers-cache');
    const keys = await cache.keys();
    await Promise.all(
      keys.map(async (req) => {
        let pathname: string;
        try {
          pathname = new URL(typeof req === 'string' ? req : req.url, self.location.origin).pathname;
        } catch {
          return;
        }
        if (pathname === '/models' || pathname.startsWith('/models/')) {
          await cache.delete(req);
        }
      }),
    );
  } catch {
    /* ignore */
  }
}

type MainToWorker = { type: 'transcribe'; requestId: number; audio: Float32Array };
type WorkerToMain = { type: 'result'; requestId: number; text: string };

type Job = { requestId: number; audio: Float32Array };

let asr: Awaited<ReturnType<typeof pipeline>> | null = null;
let loading: Promise<void> | null = null;
let processing = false;
const queue: Job[] = [];
const MAX_QUEUE = 4;

async function ensurePipeline() {
  if (asr) return;
  if (!loading) {
    loading = (async () => {
      await purgePoisonedTransformersCache();
      asr = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base');
    })();
  }
  await loading;
}

type AsrFn = (
  input: Float32Array,
  options?: Record<string, unknown>,
) => Promise<{ text?: string } | string>;

async function runTranscribe(job: Job) {
  await ensurePipeline();
  const { requestId, audio } = job;
  if (!asr) {
    console.warn('[Wake][worker] No ASR pipeline; empty result', { requestId });
    self.postMessage({ type: 'result', requestId, text: '' });
    return;
  }
  console.log('[Wake][worker] Transcribe start', { requestId, samples: audio.length });
  try {
    const out = await (asr as unknown as AsrFn)(audio, {
      initial_prompt: WAKE_WORD_INITIAL_PROMPT,
      language: 'english',
      task: 'transcribe',
    });
    let text = '';
    if (typeof out === 'string') {
      text = out;
    } else if (
      out &&
      typeof out === 'object' &&
      'text' in out &&
      typeof (out as { text: string }).text === 'string'
    ) {
      text = (out as { text: string }).text;
    }
    const preview = text.length > 100 ? `${text.slice(0, 100)}…` : text || '(empty)';
    console.log('[Wake][worker] Transcribe done', { requestId, chars: text.length, preview });
    self.postMessage({ type: 'result', requestId, text });
  } catch (err) {
    console.warn('[Wake][worker] Transcribe error', { requestId, err });
    self.postMessage({ type: 'result', requestId, text: '' });
  }
}

async function pump() {
  if (processing) return;
  const next = queue.shift();
  if (!next) return;
  processing = true;
  try {
    await runTranscribe(next);
  } finally {
    processing = false;
    void pump();
  }
}

self.onmessage = (ev: MessageEvent<MainToWorker>) => {
  const msg = ev.data;
  if (msg?.type !== 'transcribe' || typeof msg.requestId !== 'number' || !(msg.audio instanceof Float32Array)) {
    return;
  }
  while (queue.length >= MAX_QUEUE) {
    const dropped = queue.shift();
    if (dropped) {
      console.warn('[Wake][worker] Queue full; dropping job', { requestId: dropped.requestId });
      self.postMessage({ type: 'result', requestId: dropped.requestId, text: '' });
    }
  }
  queue.push({ requestId: msg.requestId, audio: msg.audio });
  void pump();
};
