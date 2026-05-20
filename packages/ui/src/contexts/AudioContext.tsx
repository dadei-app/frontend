import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useCommand } from '@dadei/ui/contexts/CommandContext';
import { useService } from '@dadei/ui/contexts/ServiceContext';
import { subscribeRealtimeMessages, sendRealtimeMessage } from '@dadei/ui/lib/realtimeClient';
import {
  normalizeVisibleCommandText,
  transcriptStartsWithWakeCommand,
} from '@dadei/ui/lib/wakeWordDetection';

interface AudioContextType {
  isProcessing: boolean;
  isAudioPipelineReady: boolean;
}

export const AudioContext = createContext<AudioContextType | undefined>(undefined);
const COMMAND_START_RETRY_MS = 500;

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

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const { isServiceEnabled, registrationConflict, isConnected, isAssistantMode, isAssistantOwner } =
    useService();
  const { mode, submitCommandText, setInterimTranscript } = useCommand();
  const [isProcessing] = useState(false);
  const [isAudioPipelineReady, setIsAudioPipelineReady] = useState(false);
  const commandModeRef = useRef(mode);
  const submitCommandTextRef = useRef(submitCommandText);
  const setInterimTranscriptRef = useRef(setInterimTranscript);
  const lastSubmittedTextRef = useRef<{ text: string; atMs: number } | null>(null);
  const wakeDetectedRef = useRef(false);
  const lastWakeInterimRef = useRef('');
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
    wakeDetectedRef.current = false;
    lastWakeInterimRef.current = '';
    lastCommandStartAttemptMsRef.current = 0;
  }, []);

  const ensureCommandSessionStarted = useCallback((nowMs: number, force = false) => {
    if (!commandStreamActiveRef.current) return;
    if (commandStreamReadyRef.current) return;
    if (!force && nowMs - lastCommandStartAttemptMsRef.current < COMMAND_START_RETRY_MS) return;
    lastCommandStartAttemptMsRef.current = nowMs;
    sendRealtimeMessage({ type: 'command_audio_start', sample_rate: 16000 });
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
    lastWakeInterimRef.current = '';
    lastCommandStartAttemptMsRef.current = 0;
    ensureCommandSessionStarted(Date.now(), true);
    processor.onaudioprocess = (event) => {
      if (!commandStreamActiveRef.current || commandModeRef.current !== 'passive') return;
      const input = event.inputBuffer.getChannelData(0);
      const downsampled = downsampleTo16k(input, ctx.sampleRate);
      const nowMs = Date.now();
      if (!commandStreamReadyRef.current) {
        ensureCommandSessionStarted(nowMs);
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
  }, [ensureCommandSessionStarted]);

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
        if (transcriptStartsWithWakeCommand(text)) {
          wakeDetectedRef.current = true;
          lastWakeInterimRef.current = text;
          const visible = normalizeVisibleCommandText(text);
          if (visible) setInterimTranscriptRef.current(visible);
          return;
        }
        if (wakeDetectedRef.current) {
          const visible = normalizeVisibleCommandText(text);
          if (visible) setInterimTranscriptRef.current(visible);
        }
        return;
      }
      if (msg.event === 'command_transcript_final') {
        if (commandModeRef.current !== 'passive') return;
        const finalRaw = typeof msg.text === 'string' ? msg.text : '';
        const text = finalRaw || lastWakeInterimRef.current;
        const startsWithWake = transcriptStartsWithWakeCommand(text);
        const finalPayload = startsWithWake || wakeDetectedRef.current ? text : '';
        const shouldSubmit = !!finalPayload;
        wakeDetectedRef.current = false;
        lastWakeInterimRef.current = '';
        if (!shouldSubmit) return;
        void submitVisibleCommandText(finalPayload, { claimAssistantMode: true });
      }
      if (msg.event === 'command_transcript_done' || msg.event === 'command_transcript_error') {
        commandStreamReadyRef.current = false;
        wakeDetectedRef.current = false;
        lastWakeInterimRef.current = '';
      }
    });
    return off;
  }, [submitVisibleCommandText]);

  useEffect(() => {
    const shouldListen =
      (isServiceEnabled || (isAssistantMode && isAssistantOwner)) && !registrationConflict && isConnected;
    setIsAudioPipelineReady(shouldListen);
  }, [isServiceEnabled, isAssistantMode, isAssistantOwner, registrationConflict, isConnected]);

  useEffect(() => {
    const shouldListen =
      (isServiceEnabled || (isAssistantMode && isAssistantOwner)) && !registrationConflict && isConnected;
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
    isServiceEnabled,
    isAssistantMode,
    isAssistantOwner,
    registrationConflict,
    isConnected,
    mode,
    startCommandAudioStream,
    stopCommandAudioStream,
  ]);

  useEffect(() => () => stopCommandAudioStream(true), [stopCommandAudioStream]);

  return (
    <AudioContext.Provider value={{ isProcessing, isAudioPipelineReady }}>{children}</AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) throw new Error('useAudio must be used within AudioProvider');
  return context;
}
