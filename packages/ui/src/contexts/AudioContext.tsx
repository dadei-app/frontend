import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useCommand, type CommandState } from '@dadei/ui/contexts/CommandContext';
import { useService } from '@dadei/ui/contexts/ServiceContext';
import { sendRealtimeMessage, subscribeRealtimeMessages } from '@dadei/ui/lib/realtimeClient';
import { notifyVoiceSpeechActivity } from '@dadei/ui/lib/voice/voiceSessionActivity';

const COMMAND_START_RETRY_MS = 500;
const MIC_ANALYSER_FFT_SIZE = 256;
const MIC_ANALYSER_SMOOTHING = 0.7;
/** Normalized RMS above which we treat follow-up speech as started (before ASR interim). */
const FOLLOW_UP_SPEECH_RMS = 0.06;

interface AudioContextType {
  isProcessing: boolean;
  isAudioPipelineReady: boolean;
  /** Normalized mic RMS in [0, 1] while listening; 0 otherwise. */
  micLevel: number;
}

export const AudioContext = createContext<AudioContextType | undefined>(undefined);

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

const CHUNK_FORWARD_STATES: CommandState[] = ['idle', 'listening', 'follow_up'];

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const { isServiceEnabled, registrationConflict, isConnected, isAssistantMode, isAssistantOwner } =
    useService();
  const { state } = useCommand();
  const [isProcessing] = useState(false);
  const [isAudioPipelineReady, setIsAudioPipelineReady] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [streamAnalyserReady, setStreamAnalyserReady] = useState(false);

  const stateRef = useRef(state);
  const forwardChunksRef = useRef(true);
  const prevStateRef = useRef<CommandState>(state);
  const commandStreamReadyRef = useRef(false);
  const lastCommandStartAttemptMsRef = useRef(0);
  const commandStreamActiveRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const webAudioCtxRef = useRef<globalThis.AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    forwardChunksRef.current = CHUNK_FORWARD_STATES.includes(state);
  }, [state]);

  useEffect(() => {
    const prev = prevStateRef.current;
    if (prev === 'listening' && state === 'thinking') {
      sendRealtimeMessage({ type: 'command_audio_end' });
    }
  }, [state]);

  useEffect(() => {
    const active = state === 'listening' || state === 'follow_up';
    if (!active || !streamAnalyserReady || !analyserRef.current) {
      setMicLevel(0);
      return;
    }

    const analyser = analyserRef.current;
    const buf = new Uint8Array(analyser.fftSize);
    let raf = 0;
    let speechActive = false;
    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let sumSq = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / buf.length);
      const level = Math.min(rms * 2.2, 1);
      setMicLevel(level);

      const speaking = level >= FOLLOW_UP_SPEECH_RMS;
      if (speaking && !speechActive && stateRef.current === 'follow_up') {
        notifyVoiceSpeechActivity();
      }
      speechActive = speaking;

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state, streamAnalyserReady]);

  const stopCommandAudioStream = useCallback((cancel = false) => {
    if (processorNodeRef.current) {
      processorNodeRef.current.onaudioprocess = null;
      processorNodeRef.current.disconnect();
      processorNodeRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    setStreamAnalyserReady(false);
    setMicLevel(0);
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
    if (commandStreamActiveRef.current) return;
    const media = await navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    mediaStreamRef.current = media;
    const ctx = new window.AudioContext({ sampleRate: 16000 });
    webAudioCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(media);
    sourceNodeRef.current = source;
    const analyserNode = ctx.createAnalyser();
    analyserNode.fftSize = MIC_ANALYSER_FFT_SIZE;
    analyserNode.smoothingTimeConstant = MIC_ANALYSER_SMOOTHING;
    source.connect(analyserNode);
    analyserRef.current = analyserNode;
    setStreamAnalyserReady(true);

    const processor = ctx.createScriptProcessor(2048, 1, 1);
    processorNodeRef.current = processor;
    analyserNode.connect(processor);
    processor.connect(ctx.destination);
    commandStreamActiveRef.current = true;
    commandStreamReadyRef.current = false;
    lastCommandStartAttemptMsRef.current = 0;
    ensureCommandSessionStarted(Date.now(), true);

    processor.onaudioprocess = (event) => {
      if (!commandStreamActiveRef.current || !forwardChunksRef.current) return;
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
    const shouldListen =
      (isServiceEnabled || (isAssistantMode && isAssistantOwner)) &&
      !registrationConflict &&
      isConnected;
    setIsAudioPipelineReady(shouldListen);
  }, [isServiceEnabled, isAssistantMode, isAssistantOwner, registrationConflict, isConnected]);

  useEffect(() => {
    const off = subscribeRealtimeMessages((msg) => {
      if (msg.event === 'command_transcript_ready') {
        commandStreamReadyRef.current = true;
      }
      if (msg.event === 'command_transcript_done' || msg.event === 'command_transcript_error') {
        // Keep forwarding mic while idle/listening/follow_up — done is per-utterance, not end of session.
        if (CHUNK_FORWARD_STATES.includes(stateRef.current)) {
          commandStreamReadyRef.current = true;
        } else {
          commandStreamReadyRef.current = false;
        }
      }
    });
    return off;
  }, []);

  useEffect(() => {
    const shouldListen =
      (isServiceEnabled || (isAssistantMode && isAssistantOwner)) &&
      !registrationConflict &&
      isConnected;
    const shouldStream = shouldListen && state !== 'locked';
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
    state,
    startCommandAudioStream,
    stopCommandAudioStream,
  ]);

  useEffect(() => () => stopCommandAudioStream(true), [stopCommandAudioStream]);

  return (
    <AudioContext.Provider value={{ isProcessing, isAudioPipelineReady, micLevel }}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) throw new Error('useAudio must be used within AudioProvider');
  return context;
}
