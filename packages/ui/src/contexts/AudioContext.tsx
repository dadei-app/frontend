import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useMicVAD } from '@ricky0123/vad-react';
import { interactionsApi } from '@dadei/ui/lib/api/interactions';
import { useCommand } from '@dadei/ui/contexts/CommandContext';
import { useService } from '@dadei/ui/contexts/ServiceContext';
import { subscribeRealtimeMessages, sendRealtimeMessage } from '@dadei/ui/lib/realtimeClient';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@dadei/ui/lib/queryKeys';
import {
  normalizeVisibleCommandText,
  transcriptStartsWithWakeCommand,
} from '@dadei/ui/lib/wakeWordDetection';

interface AudioContextType {
  isProcessing: boolean;
  isVADReady: boolean;
}

export const AudioContext = createContext<AudioContextType | undefined>(undefined);

function calculateRMS(audio: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < audio.length; i++) sum += audio[i] * audio[i];
  return Math.sqrt(sum / audio.length);
}

function hasSignificantAudio(audio: Float32Array): boolean {
  const rms = calculateRMS(audio);
  if (rms < 0.008 || rms > 0.55) return false;
  const durationSeconds = audio.length / 16000;
  return durationSeconds >= 0.42 && durationSeconds <= 10;
}

function encodeWAV(samples: Float32Array, sampleRate: number = 16000): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
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

function downsampleTo16k(input: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate <= 16000) return input;
  const ratio = inputSampleRate / 16000;
  const outLength = Math.max(1, Math.floor(input.length / ratio));
  const output = new Float32Array(outLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < outLength) {
    const nextOffsetBuffer = Math.min(input.length, Math.round((offsetResult + 1) * ratio));
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer; i++) {
      accum += input[i];
      count++;
    }
    output[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return output;
}

function extractWakeSegment(raw: string): string {
  const text = raw.trim();
  if (!text) return '';
  if (transcriptStartsWithWakeCommand(text)) return text;

  const wakeMatch = text.match(
    /\b(assistant|dadei|dadey|dadee|daday|dah[-\s]?dee|da[-\s]?dee|da[-\s]?dei)\b/i,
  );
  if (!wakeMatch || wakeMatch.index == null) return '';
  return text.slice(wakeMatch.index).trim();
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const { isServiceEnabled, registrationConflict, isConnected, isAssistantMode, isAssistantOwner } =
    useService();
  const { mode, submitCommandText, setInterimTranscript } = useCommand();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVADReady, setIsVADReady] = useState(false);
  const speechStartMsRef = useRef<number | null>(null);
  const commandModeRef = useRef(mode);
  const submitCommandTextRef = useRef(submitCommandText);
  const setInterimTranscriptRef = useRef(setInterimTranscript);
  const lastSubmittedTextRef = useRef<{ text: string; atMs: number } | null>(null);
  const wakeDetectedRef = useRef(false);
  const commandCandidateRef = useRef(false);
  const speakingActiveUntilMsRef = useRef(0);
  const commandStreamReadyRef = useRef(false);
  const lastCommandStartAttemptMsRef = useRef(0);
  const commandStreamActiveRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const webAudioCtxRef = useRef<globalThis.AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);

  useEffect(() => {
    commandModeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    submitCommandTextRef.current = submitCommandText;
  }, [submitCommandText]);
  useEffect(() => {
    setInterimTranscriptRef.current = setInterimTranscript;
  }, [setInterimTranscript]);

  const submitVisibleCommandText = useCallback(
    (raw: string, options?: { claimAssistantMode?: boolean }): boolean => {
      const visible = normalizeVisibleCommandText(raw);
      if (!visible) return false;
      const nowMs = Date.now();
      const last = lastSubmittedTextRef.current;
      if (last && last.text === visible && nowMs - last.atMs < 1500) return false;
      lastSubmittedTextRef.current = { text: visible, atMs: nowMs };
      setInterimTranscriptRef.current(visible);
      submitCommandTextRef.current(visible, options);
      return true;
    },
    [],
  );

  const stopCommandAudioStream = useCallback((cancel = false) => {
    if (processorNodeRef.current) {
      processorNodeRef.current.onaudioprocess = null;
      processorNodeRef.current.disconnect();
      processorNodeRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (webAudioCtxRef.current) {
      void webAudioCtxRef.current.close();
      webAudioCtxRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (commandStreamActiveRef.current) {
      sendRealtimeMessage({ type: cancel ? 'command_audio_cancel' : 'command_audio_end' });
    }
    commandStreamActiveRef.current = false;
    commandStreamReadyRef.current = false;
    commandCandidateRef.current = false;
    wakeDetectedRef.current = false;
    speakingActiveUntilMsRef.current = 0;
    lastCommandStartAttemptMsRef.current = 0;
  }, []);

  const startCommandAudioStream = useCallback(async () => {
    if (commandStreamActiveRef.current || commandModeRef.current !== 'passive') return;
    const media = await navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    mediaStreamRef.current = media;
    const ctx = new window.AudioContext({ sampleRate: 16000 });
    webAudioCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(media);
    sourceNodeRef.current = source;
    const processor = ctx.createScriptProcessor(2048, 1, 1);
    processorNodeRef.current = processor;
    source.connect(processor);
    processor.connect(ctx.destination);
    commandStreamActiveRef.current = true;
    commandStreamReadyRef.current = false;
    wakeDetectedRef.current = false;
    commandCandidateRef.current = false;
    speakingActiveUntilMsRef.current = 0;
    lastCommandStartAttemptMsRef.current = 0;
    processor.onaudioprocess = (event) => {
      if (!commandStreamActiveRef.current || commandModeRef.current !== 'passive') return;
      const input = event.inputBuffer.getChannelData(0);
      const downsampled = downsampleTo16k(input, ctx.sampleRate);
      const rms = calculateRMS(downsampled);
      const nowMs = Date.now();
      const speechThreshold = 0.0045;
      const hangoverMs = 1200;
      const isSpeechChunk = rms >= speechThreshold;
      if (isSpeechChunk) {
        speakingActiveUntilMsRef.current = nowMs + hangoverMs;
      }
      if (!isSpeechChunk && nowMs >= speakingActiveUntilMsRef.current) {
        return;
      }
      if (!commandStreamReadyRef.current) {
        if (nowMs - lastCommandStartAttemptMsRef.current >= 350) {
          lastCommandStartAttemptMsRef.current = nowMs;
          void sendRealtimeMessage({ type: 'command_audio_start', sample_rate: 16000 });
        }
        return;
      }
      const pcm16 = new Int16Array(downsampled.length);
      for (let i = 0; i < downsampled.length; i++) {
        const s = Math.max(-1, Math.min(1, downsampled[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      const bytes = new Uint8Array(pcm16.buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      sendRealtimeMessage({ type: 'command_audio_chunk', pcm16_b64: btoa(binary) });
    };
  }, []);

  useEffect(() => {
    const off = subscribeRealtimeMessages((msg) => {
      if (msg.event === 'command_transcript_ready') {
        commandStreamReadyRef.current = true;
        return;
      }
      if (msg.event === 'command_transcript_interim') {
        if (commandModeRef.current !== 'passive') return;
        const text = typeof msg.text === 'string' ? msg.text : '';
        if (!text) return;
        const wakeSegment = extractWakeSegment(text);
        if (!wakeSegment && !wakeDetectedRef.current) return;
        if (wakeSegment) {
          wakeDetectedRef.current = true;
          commandCandidateRef.current = true;
        }
        const visible = normalizeVisibleCommandText(wakeSegment || text);
        if (visible) setInterimTranscriptRef.current(visible);
        return;
      }
      if (msg.event === 'command_transcript_final') {
        if (commandModeRef.current !== 'passive') return;
        const text = typeof msg.text === 'string' ? msg.text : '';
        if (!text) return;
        const wakeSegment = extractWakeSegment(text);
        const finalPayload = wakeSegment || (wakeDetectedRef.current ? text : '');
        const shouldSubmit = !!finalPayload;
        wakeDetectedRef.current = false;
        commandCandidateRef.current = false;
        if (!shouldSubmit) return;
        void submitVisibleCommandText(finalPayload, { claimAssistantMode: true });
      }
      if (msg.event === 'command_transcript_done' || msg.event === 'command_transcript_error') {
        commandStreamReadyRef.current = false;
        wakeDetectedRef.current = false;
        commandCandidateRef.current = false;
      }
    });
    return off;
  }, [submitVisibleCommandText]);

  const assetPath = new URL(import.meta.env.BASE_URL, window.location.origin).href;
  const vad = useMicVAD({
    startOnLoad: true,
    baseAssetPath: assetPath,
    onnxWASMBasePath: assetPath,
    onSpeechStart: () => {
      speechStartMsRef.current = Date.now();
    },
    onSpeechEnd: async (audio: Float32Array) => {
      if (commandModeRef.current !== 'passive' || !hasSignificantAudio(audio)) return;
      if (commandCandidateRef.current) {
        return;
      }
      setIsProcessing(true);
      try {
        const chunkEndMs = Date.now();
        const approxStartFromAudioMs = chunkEndMs - Math.round((audio.length / 16000) * 1000);
        const chunkStartMs = speechStartMsRef.current ?? approxStartFromAudioMs;
        speechStartMsRef.current = null;
        await interactionsApi.register(encodeWAV(audio, 16000), undefined, { chunkStartMs, chunkEndMs });
        void queryClient.invalidateQueries({ queryKey: queryKeys.interactions });
      } catch (error) {
        console.error('[VAD] Failed to send interaction audio:', error);
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
    if (!vad.loading && !vad.errored) setIsVADReady(true);
  }, [vad.loading, vad.errored]);

  useEffect(() => {
    if (!isVADReady) return;
    const shouldListen =
      (isServiceEnabled || (isAssistantMode && isAssistantOwner)) && !registrationConflict && isConnected;
    if (shouldListen && !vad.listening) vad.start();
    else if (!shouldListen && vad.listening) vad.pause();

    const shouldStream = shouldListen && mode === 'passive';
    if (shouldStream && !commandStreamActiveRef.current) {
      void startCommandAudioStream().catch((e) => {
        console.error('[Audio] command stream start failed', e);
        stopCommandAudioStream(true);
      });
    } else if (!shouldStream && commandStreamActiveRef.current) {
      stopCommandAudioStream(true);
    }
  }, [
    isVADReady,
    isServiceEnabled,
    isAssistantMode,
    isAssistantOwner,
    registrationConflict,
    isConnected,
    vad.listening,
    mode,
    startCommandAudioStream,
    stopCommandAudioStream,
  ]);

  useEffect(() => () => stopCommandAudioStream(true), [stopCommandAudioStream]);

  return <AudioContext.Provider value={{ isProcessing, isVADReady }}>{children}</AudioContext.Provider>;
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) throw new Error('useAudio must be used within AudioProvider');
  return context;
}
