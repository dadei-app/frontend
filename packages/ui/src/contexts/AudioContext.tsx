import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useMicVAD } from '@ricky0123/vad-react';
import { interactionsApi } from '@dadei/ui/lib/api/interactions';
import { useCommand } from '@dadei/ui/contexts/CommandContext';
import { useService } from '@dadei/ui/contexts/ServiceContext';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@dadei/ui/lib/queryKeys';
import {
  normalizeTranscriptForWake,
  transcriptStartsWithWakeCommand,
} from '@dadei/ui/lib/wakeWordDetection';

interface AudioContextType {
  isProcessing: boolean;
  isVADReady: boolean;
}

export const AudioContext = createContext<AudioContextType | undefined>(undefined);

function calculateRMS(audio: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < audio.length; i++) {
    sum += audio[i] * audio[i];
  }
  return Math.sqrt(sum / audio.length);
}

function hasSignificantAudio(audio: Float32Array): boolean {
  const rms = calculateRMS(audio);
  const minRMS = 0.008;
  const maxRMS = 0.55;

  if (rms < minRMS) {
    console.log('[VAD] Rejected: Too quiet (RMS:', rms.toFixed(4), ')');
    return false;
  }

  if (rms > maxRMS) {
    console.log('[VAD] Rejected: Too loud/clipping (RMS:', rms.toFixed(4), ')');
    return false;
  }

  const durationSeconds = audio.length / 16000;
  const minDuration = 0.42;
  const maxDuration = 10;

  if (durationSeconds < minDuration) {
    console.log('[VAD] Rejected: Too short (', durationSeconds.toFixed(2), 's)');
    return false;
  }

  if (durationSeconds > maxDuration) {
    console.log('[VAD] Rejected: Too long (', durationSeconds.toFixed(2), 's)');
    return false;
  }

  console.log('[VAD] Accepted: RMS=', rms.toFixed(4), 'Duration=', durationSeconds.toFixed(2), 's');
  return true;
}

/** Short utterances (e.g. "Dadei") for wake-only ASR; still rejects obvious noise/clipping. */
function hasSignificantAudioForWakeWord(audio: Float32Array): boolean {
  const rms = calculateRMS(audio);
  const minRMS = 0.006;
  const maxRMS = 0.55;
  if (rms < minRMS || rms > maxRMS) return false;
  const durationSeconds = audio.length / 16000;
  const minDuration = 0.28;
  const maxDuration = 10;
  return durationSeconds >= minDuration && durationSeconds <= maxDuration;
}

function encodeWAV(samples: Float32Array, sampleRate: number = 16000): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

type TranscribePending = {
  resolve: (text: string) => void;
  timeout: ReturnType<typeof setTimeout>;
};

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const {
    isServiceEnabled,
    registrationConflict,
    isConnected,
    isAssistantMode,
    isAssistantOwner,
  } = useService();
  const { mode, submitCommandAudio } = useCommand();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVADReady, setIsVADReady] = useState(false);
  const speechStartMsRef = useRef<number | null>(null);
  const wakeWordWorkerRef = useRef<Worker | null>(null);
  const commandModeRef = useRef(mode);
  const submitCommandAudioRef = useRef(submitCommandAudio);
  const transcribeRequestIdRef = useRef(0);
  const transcribePendingRef = useRef(new Map<number, TranscribePending>());

  useEffect(() => {
    commandModeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    submitCommandAudioRef.current = submitCommandAudio;
  }, [submitCommandAudio]);

  const transcribeSegment = useCallback((audio: Float32Array): Promise<string> => {
    const w = wakeWordWorkerRef.current;
    if (!w) return Promise.resolve('');
    const id = ++transcribeRequestIdRef.current;
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        const pending = transcribePendingRef.current.get(id);
        if (pending) {
          transcribePendingRef.current.delete(id);
          console.warn('[Wake] Local ASR timed out (120s)', { requestId: id });
          pending.resolve('');
        }
      }, 120_000);
      transcribePendingRef.current.set(id, {
        resolve: (text: string) => {
          clearTimeout(timeout);
          transcribePendingRef.current.delete(id);
          resolve(text);
        },
        timeout,
      });
      const clone = audio.slice();
      w.postMessage({ type: 'transcribe', requestId: id, audio: clone }, [clone.buffer]);
    });
  }, []);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/wakeWordWorker.ts', import.meta.url), {
      type: 'module',
    });
    wakeWordWorkerRef.current = worker;
    worker.onmessage = (e: MessageEvent<{ type?: string; requestId?: number; text?: string }>) => {
      const { type, requestId, text } = e.data ?? {};
      if (type !== 'result' || typeof requestId !== 'number') return;
      const pending = transcribePendingRef.current.get(requestId);
      if (!pending) return;
      transcribePendingRef.current.delete(requestId);
      clearTimeout(pending.timeout);
      pending.resolve(typeof text === 'string' ? text : '');
    };
    return () => {
      for (const [, p] of transcribePendingRef.current) {
        clearTimeout(p.timeout);
        p.resolve('');
      }
      transcribePendingRef.current.clear();
      worker.terminate();
      wakeWordWorkerRef.current = null;
    };
  }, []);

  function getAssetPath() {
    return new URL(import.meta.env.BASE_URL, window.location.origin).href;
  }

  const assetPath = getAssetPath();

  const vad = useMicVAD({
    startOnLoad: true,
    baseAssetPath: assetPath,
    onnxWASMBasePath: assetPath,

    onSpeechStart: () => {
      speechStartMsRef.current = Date.now();
      console.log('[VAD] Speech started at', speechStartMsRef.current);
    },
    onVADMisfire: () => console.log('VAD misfire'),
    onSpeechEnd: async (audio: Float32Array) => {
      const modeNow = commandModeRef.current;
      const fullQuality = hasSignificantAudio(audio);
      const wakeScanOk = hasSignificantAudioForWakeWord(audio);

      if (modeNow !== 'passive') {
        console.log('[VAD] Skipping segment while command pipeline active:', modeNow);
        return;
      }

      if (!wakeScanOk && !fullQuality) {
        console.log('[VAD] Audio rejected - quality check failed');
        return;
      }

      console.log('[Wake] Segment', {
        fullQuality,
        wakeScanOk,
        workerReady: !!wakeWordWorkerRef.current,
        samples: audio.length,
        approxSec: (audio.length / 16000).toFixed(2),
      });

      setIsProcessing(true);

      try {
        const chunkEndMs = Date.now();
        const approxStartFromAudioMs =
          chunkEndMs - Math.round((audio.length / 16000) * 1000);
        const chunkStartMs = speechStartMsRef.current ?? approxStartFromAudioMs;
        speechStartMsRef.current = null;

        const wavBuffer = encodeWAV(audio, 16000);

        if (wakeScanOk && wakeWordWorkerRef.current) {
          let localText = '';
          try {
            localText = await transcribeSegment(audio);
          } catch (e) {
            console.warn('[Wake] Local ASR threw:', e);
            localText = '';
          }
          const normalized = normalizeTranscriptForWake(localText);
          const preview =
            normalized.length > 120 ? `${normalized.slice(0, 120)}…` : normalized || '(empty)';
          const prefixMatch = transcriptStartsWithWakeCommand(localText);
          console.log('[Wake] Local ASR done', { chars: localText.length, preview, prefixMatch });
          if (prefixMatch) {
            console.log('[Wake] Routed to command (wake-prefixed transcript)');
            submitCommandAudioRef.current(wavBuffer, { claimAssistantMode: true });
            return;
          }
        } else if (wakeScanOk && !wakeWordWorkerRef.current) {
          console.warn('[Wake] wakeScanOk but wake worker not ready — cannot run wake ASR');
        }

        if (!fullQuality) {
          console.log(
            '[Wake] Skipping interaction: segment failed fullQuality (min ~0.42s RMS band). wakeScanOk was',
            wakeScanOk,
          );
          return;
        }

        if (isAssistantMode && isAssistantOwner) {
          console.log('[AssistantMode] Routed segment directly to command');
          submitCommandAudioRef.current(wavBuffer);
          return;
        }

        await interactionsApi.register(wavBuffer, undefined, {
          chunkStartMs,
          chunkEndMs,
        });
        void queryClient.invalidateQueries({ queryKey: queryKeys.interactions });
        console.log('[VAD] Audio sent successfully (interaction)');
      } catch (error) {
        console.error('[VAD] Failed to send audio:', error);
      } finally {
        setIsProcessing(false);
      }
    },

    model: 'v5',
    positiveSpeechThreshold: 0.5,
    negativeSpeechThreshold: 0.35,
    redemptionMs: 1000,
    minSpeechMs: 500,
    preSpeechPadMs: 600,
    submitUserSpeechOnPause: false,
  });

  useEffect(() => {
    if (!vad.loading && !vad.errored) {
      console.log('[VAD] Ready and initialized');
      setIsVADReady(true);
    }
  }, [vad.loading, vad.errored]);

  useEffect(() => {
    if (!isVADReady) return;

    const shouldListen =
      (isServiceEnabled || (isAssistantMode && isAssistantOwner)) &&
      !registrationConflict &&
      isConnected;

    if (shouldListen && !vad.listening) {
      console.log('[VAD] Starting listening');
      vad.start();
    } else if (!shouldListen && vad.listening) {
      console.log('[VAD] Pausing listening');
      vad.pause();
    }
  }, [
    isAssistantMode,
    isAssistantOwner,
    isServiceEnabled,
    registrationConflict,
    isConnected,
    vad.listening,
    isVADReady,
  ]);

  useEffect(() => {
    if (vad.loading) {
      console.log('[VAD] Loading models...');
    }
    if (vad.errored) {
      console.error('[VAD] Error:', vad.errored);
    }
  }, [vad.loading, vad.errored]);

  return (
    <AudioContext.Provider value={{ isProcessing, isVADReady }}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within AudioProvider');
  }
  return context;
}
