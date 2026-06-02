import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useCommand, type CommandState } from '@dadei/ui/contexts/CommandContext';
import { useService } from '@dadei/ui/contexts/ServiceContext';
import { sendRealtimeMessage, subscribeRealtimeMessages } from '@dadei/ui/lib/realtime/realtimeClient';
import { notifyVoiceSpeechActivity } from '@dadei/ui/lib/voice/session/voiceSessionActivity';
import {
  COMMAND_MIC_LEVEL_GAIN,
  COMMAND_SPEECH_RMS,
  COMMAND_UTTERANCE_END_SILENCE_MS,
  FOLLOW_UP_SPEECH_RMS,
} from '@dadei/ui/lib/voice/session/voiceConstants';
import { WakeWordDetector } from '@dadei/ui/renderer/audio/wakeWordDetector';

const COMMAND_START_RETRY_MS = 500;
const MIC_ANALYSER_FFT_SIZE = 256;
const MIC_ANALYSER_SMOOTHING = 0.7;
// ScriptProcessorNode requires 0 or a power-of-two between 256 and 16384.
const COMMAND_AUDIO_PROCESSOR_BUFFER_SIZE = 2048;
const SAMPLE_RATE = 16000;
const ENABLE_LOCAL_WAKE_DETECTOR = true;

// Only forward microphone chunks while waiting for wake word or actively capturing user speech.
const CHUNK_FORWARD_STATES: CommandState[] = ['idle', 'listening', 'follow_up'];
const ASSISTANT_BUSY_STATES: CommandState[] = ['transcribing', 'thinking', 'responding'];

interface AudioContextType {
  isProcessing: boolean;
  isAudioPipelineReady: boolean;
  micLevel: number;
}

export const AudioContext = createContext<AudioContextType | undefined>(undefined);

function downsampleTo16k(input: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate <= SAMPLE_RATE) return input;
  const ratio = inputSampleRate / SAMPLE_RATE;
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

function toPcm16(input: Float32Array): Int16Array {
  const pcm16 = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm16;
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const { isServiceEnabled, registrationConflict, isConnected, isAssistantMode, isAssistantOwner } =
    useService();
  const { state, startListening, notifyCommandUtteranceEnded } = useCommand();

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

  const wakeDetectorRef = useRef<WakeWordDetector | null>(null);
  const wakeDetectorFailureLoggedRef = useRef(false);
  const commandSpeechSeenRef = useRef(false);
  const commandSilenceStartedMsRef = useRef<number | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    forwardChunksRef.current = CHUNK_FORWARD_STATES.includes(state);
  }, [state]);

  useEffect(() => {
    const prev = prevStateRef.current;
    if (prev === 'listening' && (state === 'transcribing' || ASSISTANT_BUSY_STATES.includes(state))) {
      sendRealtimeMessage({ type: 'command_audio_end' });
    } else if (
      (ASSISTANT_BUSY_STATES.includes(state) && prev === 'follow_up') ||
      (state === 'follow_up' && ASSISTANT_BUSY_STATES.includes(prev))
    ) {
      sendRealtimeMessage({ type: 'command_audio_discard' });
    } else if (
      (prev === 'listening' || prev === 'follow_up') &&
      (state === 'idle' || state === 'locked')
    ) {
      sendRealtimeMessage({ type: 'command_audio_cancel' });
      commandStreamReadyRef.current = false;
      lastCommandStartAttemptMsRef.current = 0;
    }
    prevStateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (state === 'listening' || state === 'follow_up') {
      commandSpeechSeenRef.current = false;
      commandSilenceStartedMsRef.current = null;
    }
  }, [state]);

  useEffect(() => {
    const active = state === 'listening' || state === 'follow_up';
    if (!active) {
      setMicLevel(0);
      commandSpeechSeenRef.current = false;
      commandSilenceStartedMsRef.current = null;
      return;
    }
    if (!streamAnalyserReady || !analyserRef.current) return;

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
      const inCommandCapture =
        stateRef.current === 'listening' || stateRef.current === 'follow_up';
      const level = Math.min(
        Math.sqrt(sumSq / buf.length) * (inCommandCapture ? COMMAND_MIC_LEVEL_GAIN : 2.2),
        1,
      );
      setMicLevel(level);
      const speaking = level >= FOLLOW_UP_SPEECH_RMS;
      if (speaking && !speechActive && stateRef.current === 'follow_up') notifyVoiceSpeechActivity();
      speechActive = speaking;

      if (stateRef.current === 'listening' || stateRef.current === 'follow_up') {
        const commandSpeaking = level >= COMMAND_SPEECH_RMS;
        if (commandSpeaking) {
          commandSpeechSeenRef.current = true;
          commandSilenceStartedMsRef.current = null;
        } else if (commandSpeechSeenRef.current) {
          const now = performance.now();
          if (commandSilenceStartedMsRef.current === null) {
            commandSilenceStartedMsRef.current = now;
          } else if (now - commandSilenceStartedMsRef.current >= COMMAND_UTTERANCE_END_SILENCE_MS) {
            commandSpeechSeenRef.current = false;
            commandSilenceStartedMsRef.current = null;
            notifyCommandUtteranceEnded();
          }
        }
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state, streamAnalyserReady, notifyCommandUtteranceEnded]);

  /** Local wake model only arms assistant mode; transcription is websocket-only. */
  const onWakeWordDetected = useCallback(
    (_timestampMs: number) => {
      if (
        stateRef.current === 'transcribing' ||
        stateRef.current === 'thinking' ||
        stateRef.current === 'responding' ||
        stateRef.current === 'locked'
      ) {
        return;
      }
      console.debug('[Voice][Wake] detected — entering listening (server will transcribe)');
      startListening();
    },
    [startListening],
  );

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
    if (wakeDetectorRef.current) {
      void wakeDetectorRef.current.stop();
      wakeDetectorRef.current = null;
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
    sendRealtimeMessage({ type: 'command_audio_start', sample_rate: SAMPLE_RATE });
  }, []);

  const startCommandAudioStream = useCallback(async () => {
    if (commandStreamActiveRef.current) return;
    const media = await navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: SAMPLE_RATE, channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    mediaStreamRef.current = media;

    if (ENABLE_LOCAL_WAKE_DETECTOR) {
      const wakeDetector = new WakeWordDetector({ threshold: 0.5 });
      wakeDetector.onWakeWord(onWakeWordDetected);
      try {
        await wakeDetector.start(media);
        wakeDetectorRef.current = wakeDetector;
      } catch (error) {
        if (!wakeDetectorFailureLoggedRef.current) {
          wakeDetectorFailureLoggedRef.current = true;
          console.error('[Audio] wake-word detector start failed; passive capture continues', error);
        } else {
          console.warn('[Audio] wake-word detector unavailable for this session.');
        }
        wakeDetectorRef.current = null;
      }
    }

    const ctx = new window.AudioContext({ sampleRate: SAMPLE_RATE });
    webAudioCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(media);
    sourceNodeRef.current = source;

    const analyserNode = ctx.createAnalyser();
    analyserNode.fftSize = MIC_ANALYSER_FFT_SIZE;
    analyserNode.smoothingTimeConstant = MIC_ANALYSER_SMOOTHING;
    source.connect(analyserNode);
    analyserRef.current = analyserNode;
    setStreamAnalyserReady(true);

    const processor = ctx.createScriptProcessor(COMMAND_AUDIO_PROCESSOR_BUFFER_SIZE, 1, 1);
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
      const pcm16 = toPcm16(downsampled);

      const nowMs = Date.now();
      if (!commandStreamReadyRef.current) {
        ensureCommandSessionStarted(nowMs);
        return;
      }
      const bytes = new Uint8Array(pcm16.buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      sendRealtimeMessage({ type: 'command_audio_chunk', pcm16_b64: btoa(binary) });
    };
  }, [ensureCommandSessionStarted, onWakeWordDetected]);

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
