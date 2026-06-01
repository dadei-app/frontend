import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useCommand, type CommandState } from '@dadei/ui/contexts/CommandContext';
import { useService } from '@dadei/ui/contexts/ServiceContext';
import { sendRealtimeMessage, subscribeRealtimeMessages } from '@dadei/ui/lib/realtimeClient';
import { notifyVoiceSpeechActivity } from '@dadei/ui/lib/voice/voiceSessionActivity';
import { RingBuffer } from '@dadei/ui/renderer/audio/ringBuffer';
import { WakeWordDetector } from '@dadei/ui/renderer/audio/wakeWordDetector';

const COMMAND_START_RETRY_MS = 500;
const MIC_ANALYSER_FFT_SIZE = 256;
const MIC_ANALYSER_SMOOTHING = 0.7;
// ScriptProcessorNode requires 0 or a power-of-two between 256 and 16384.
const COMMAND_AUDIO_PROCESSOR_BUFFER_SIZE = 2048;
const SAMPLE_RATE = 16000;
const FOLLOW_UP_SPEECH_RMS = 0.14;
const WAKE_POST_MAX_MS = 6500;
const WAKE_SILENCE_MS = 900;
const WAKE_MIN_CAPTURE_MS = 650;
const WAKE_SILENCE_RMS_BASE = 0.012;
const WAKE_SILENCE_RMS_MAX = 0.045;
const COMMAND_MIN_SAMPLES = 1600;
const ENABLE_LOCAL_WAKE_DETECTOR = true;

// Only forward microphone chunks while waiting for wake word or actively capturing user speech.
const CHUNK_FORWARD_STATES: CommandState[] = ['idle', 'listening', 'follow_up'];
const ASSISTANT_BUSY_STATES: CommandState[] = ['thinking', 'responding'];

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

function rms(samples: Int16Array): number {
  if (!samples.length) return 0;
  let sumSq = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i] / 32768;
    sumSq += v * v;
  }
  return Math.sqrt(sumSq / samples.length);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function concatPcm16(chunks: Int16Array[]): Int16Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Int16Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function pcm16ToWavBuffer(samples: Int16Array, sampleRate = SAMPLE_RATE): ArrayBuffer {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  let offset = 0;

  const writeString = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      view.setUint8(offset++, s.charCodeAt(i));
    }
  };

  writeString('RIFF');
  view.setUint32(offset, 36 + dataSize, true);
  offset += 4;
  writeString('WAVE');
  writeString('fmt ');
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, sampleRate * bytesPerSample, true);
  offset += 4;
  view.setUint16(offset, bytesPerSample, true);
  offset += 2;
  view.setUint16(offset, 16, true);
  offset += 2;
  writeString('data');
  view.setUint32(offset, dataSize, true);
  offset += 4;

  for (let i = 0; i < samples.length; i++) {
    view.setInt16(offset, samples[i], true);
    offset += 2;
  }

  return buffer;
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const { isServiceEnabled, registrationConflict, isConnected, isAssistantMode, isAssistantOwner } =
    useService();
  const { state, startListening, submitCapturedCommandAudio } = useCommand();

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

  const ringBufferRef = useRef(new RingBuffer(3, SAMPLE_RATE));
  const wakeDetectorRef = useRef<WakeWordDetector | null>(null);
  const wakeDetectorFailureLoggedRef = useRef(false);
  const wakeCaptureActiveRef = useRef(false);
  const wakeCaptureStartedAtMsRef = useRef(0);
  const wakeCaptureSilenceSinceMsRef = useRef<number | null>(null);
  const wakeCaptureSilenceRmsRef = useRef(WAKE_SILENCE_RMS_BASE);
  const wakeCaptureSpeechSeenRef = useRef(false);
  const wakeCaptureAmbientRmsRef = useRef(0);
  const wakeCaptureLastChunkRmsRef = useRef(0);
  const wakeCaptureLastElapsedMsRef = useRef(0);
  const wakeCaptureLastSilenceElapsedMsRef = useRef(0);
  const wakePreBufferRef = useRef<Int16Array>(new Int16Array(0));
  const wakePostChunksRef = useRef<Int16Array[]>([]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    forwardChunksRef.current = CHUNK_FORWARD_STATES.includes(state);
  }, [state]);

  useEffect(() => {
    const prev = prevStateRef.current;
    if (prev === 'listening' && ASSISTANT_BUSY_STATES.includes(state)) {
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
      // Cancel tears down backend stream registration. Mark local stream as unready so
      // the next utterance re-sends command_audio_start and rebinds the stream.
      commandStreamReadyRef.current = false;
      lastCommandStartAttemptMsRef.current = 0;
    }
    prevStateRef.current = state;
  }, [state]);

  useEffect(() => {
    const active = state === 'listening' || state === 'follow_up';
    if (!active) {
      setMicLevel(0);
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
      const level = Math.min(Math.sqrt(sumSq / buf.length) * 2.2, 1);
      setMicLevel(level);
      const speaking = level >= FOLLOW_UP_SPEECH_RMS;
      if (speaking && !speechActive && stateRef.current === 'follow_up') notifyVoiceSpeechActivity();
      speechActive = speaking;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state, streamAnalyserReady]);

  const submitWakeCapture = useCallback((reason: 'silence' | 'max_post') => {
    console.debug('[Voice][WakeCapture] finalize', {
      reason,
      elapsed_ms: wakeCaptureLastElapsedMsRef.current,
      silence_elapsed_ms: wakeCaptureLastSilenceElapsedMsRef.current,
      silence_rms_threshold: Number(wakeCaptureSilenceRmsRef.current.toFixed(5)),
      ambient_rms: Number(wakeCaptureAmbientRmsRef.current.toFixed(5)),
      last_chunk_rms: Number(wakeCaptureLastChunkRmsRef.current.toFixed(5)),
      speech_seen: wakeCaptureSpeechSeenRef.current,
    });
    wakeCaptureActiveRef.current = false;
    wakeCaptureSilenceSinceMsRef.current = null;
    wakeCaptureSilenceRmsRef.current = WAKE_SILENCE_RMS_BASE;
    wakeCaptureSpeechSeenRef.current = false;
    wakeCaptureAmbientRmsRef.current = 0;
    wakeCaptureLastChunkRmsRef.current = 0;
    wakeCaptureLastElapsedMsRef.current = 0;
    wakeCaptureLastSilenceElapsedMsRef.current = 0;
    const chunks = [wakePreBufferRef.current, ...wakePostChunksRef.current];
    wakePreBufferRef.current = new Int16Array(0);
    wakePostChunksRef.current = [];
    const pcm16 = concatPcm16(chunks);
    if (pcm16.length < COMMAND_MIN_SAMPLES) return;
    submitCapturedCommandAudio(pcm16ToWavBuffer(pcm16, SAMPLE_RATE));
  }, [submitCapturedCommandAudio]);

  const onWakeWordDetected = useCallback(
    (_timestampMs: number) => {
      if (wakeCaptureActiveRef.current) return;
      if (stateRef.current === 'thinking' || stateRef.current === 'responding' || stateRef.current === 'locked') {
        return;
      }
      wakeCaptureActiveRef.current = true;
      wakeCaptureStartedAtMsRef.current = Date.now();
      wakeCaptureSilenceSinceMsRef.current = null;
      wakePreBufferRef.current = ringBufferRef.current.drain();
      wakePostChunksRef.current = [];
      const ambientRms = rms(wakePreBufferRef.current);
      wakeCaptureAmbientRmsRef.current = ambientRms;
      // Adapt silence detection to current room noise so command-end feels consistent.
      wakeCaptureSilenceRmsRef.current = clamp(
        ambientRms * 1.8 + 0.004,
        WAKE_SILENCE_RMS_BASE,
        WAKE_SILENCE_RMS_MAX,
      );
      wakeCaptureSpeechSeenRef.current = false;
      console.debug('[Voice][WakeCapture] started', {
        ambient_rms: Number(ambientRms.toFixed(5)),
        silence_rms_threshold: Number(wakeCaptureSilenceRmsRef.current.toFixed(5)),
      });
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
    wakeCaptureActiveRef.current = false;
    wakeCaptureSilenceSinceMsRef.current = null;
    wakeCaptureSilenceRmsRef.current = WAKE_SILENCE_RMS_BASE;
    wakeCaptureSpeechSeenRef.current = false;
    wakeCaptureAmbientRmsRef.current = 0;
    wakeCaptureLastChunkRmsRef.current = 0;
    wakeCaptureLastElapsedMsRef.current = 0;
    wakeCaptureLastSilenceElapsedMsRef.current = 0;
    wakePreBufferRef.current = new Int16Array(0);
    wakePostChunksRef.current = [];
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
        // Keep passive capture alive even if wake detector boot fails.
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
      ringBufferRef.current.push(pcm16);

      if (wakeCaptureActiveRef.current) {
        wakePostChunksRef.current.push(pcm16);
        const nowMs = Date.now();
        const chunkRms = rms(pcm16);
        wakeCaptureLastChunkRmsRef.current = chunkRms;
        const silenceRms = wakeCaptureSilenceRmsRef.current;
        const speakingRms = silenceRms * 1.35;
        if (chunkRms >= speakingRms) {
          wakeCaptureSpeechSeenRef.current = true;
        }
        if (chunkRms < silenceRms) {
          if (wakeCaptureSilenceSinceMsRef.current == null) wakeCaptureSilenceSinceMsRef.current = nowMs;
        } else {
          wakeCaptureSilenceSinceMsRef.current = null;
        }
        const captureElapsed = nowMs - wakeCaptureStartedAtMsRef.current;
        const silenceElapsed = wakeCaptureSilenceSinceMsRef.current
          ? nowMs - wakeCaptureSilenceSinceMsRef.current
          : 0;
        wakeCaptureLastElapsedMsRef.current = captureElapsed;
        wakeCaptureLastSilenceElapsedMsRef.current = silenceElapsed;
        const canEndForSilence =
          captureElapsed >= WAKE_MIN_CAPTURE_MS &&
          wakeCaptureSpeechSeenRef.current &&
          silenceElapsed >= WAKE_SILENCE_MS;
        const maxPostExceeded = captureElapsed >= WAKE_POST_MAX_MS;
        if (maxPostExceeded || canEndForSilence) {
          submitWakeCapture(maxPostExceeded ? 'max_post' : 'silence');
        }
      }

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
  }, [ensureCommandSessionStarted, onWakeWordDetected, submitWakeCapture]);

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
