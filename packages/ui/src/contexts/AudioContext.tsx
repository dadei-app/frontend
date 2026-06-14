import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useCommand, type CommandState } from '@dadei/ui/contexts/CommandContext';
import { useAssistantRuntimeState } from '@dadei/ui/contexts/AssistantRuntimeContext';
import {
  selectVoiceEnrollmentActive,
  selectShouldForwardAudioChunks,
  selectShouldRunAudioPipeline,
  selectShouldStreamAudio,
} from '@dadei/ui/lib/assistant/assistantRuntime';
import { getRealtimeSessionId } from '@dadei/ui/lib/assistant/realtime/realtimeClient';
import { sendRealtimeMessage, subscribeRealtimeMessages } from '@dadei/ui/lib/assistant/realtime/realtimeClient';
import {
  notifyVoiceSpeechActivity,
  subscribeCommandCaptureCommit,
  subscribeCommandCaptureRearm,
} from '@dadei/ui/lib/assistant/voice/session/voiceSessionActivity';
import {
  COMMAND_MIC_LEVEL_GAIN,
  FOLLOW_UP_SPEECH_RMS,
} from '@dadei/ui/lib/assistant/voice/constants';
import {
  OpenWakeWordDetector,
  type WakeWordLabel,
} from '@dadei/ui/lib/assistant/voice/wake/openWakeWordDetector';
import type { AudioSettings } from '@dadei/ui/types/electron';
import { AUDIO_SETTINGS_CHANGED } from '@dadei/ui/lib/assistant/audio/audioSettingsEvents';
import { useSystem } from '@dadei/ui/contexts/SystemContext';
import { useService } from '@dadei/ui/contexts/ServiceContext';
import { useTutorialContext, useTutorialEngaged } from '@dadei/ui/contexts/TutorialContext';

const COMMAND_START_RETRY_MS = 500;
const COMMAND_AUDIO_PROCESSOR_BUFFER_SIZE = 2048;
const ENABLE_LOCAL_WAKE_DETECTOR = true;

const MIC_LEVEL_ANALYSER_FFT = 256;
const MIC_LEVEL_ANALYSER_SMOOTHING = 0.7;
const MIC_LEVEL_SCALE = 3.5;

const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  inputDeviceId: null,
  sampleRate: 16000,
  noiseSuppression: true,
  noiseSuppressionLevel: 50,
};

const CHUNK_FORWARD_STATES: CommandState[] = ['idle', 'listening', 'follow_up'];
const ASSISTANT_BUSY_STATES: CommandState[] = ['transcribing', 'thinking', 'responding'];

/** Normalized 0–1 level from a time-domain analyser (command aura + settings meter). */
export function computeMicLevelFromAnalyser(analyser: AnalyserNode, buffer: Uint8Array<ArrayBufferLike>): number {
  analyser.getByteTimeDomainData(buffer as Uint8Array<ArrayBuffer>);
  let sumSq = 0;
  for (let i = 0; i < buffer.length; i++) {
    const v = (buffer[i] - 128) / 128;
    sumSq += v * v;
  }
  return Math.min(
    Math.sqrt(sumSq / buffer.length) * COMMAND_MIC_LEVEL_GAIN * MIC_LEVEL_SCALE,
    1,
  );
}

export function clampMicLevel(level: number): number {
  return Math.max(0, Math.min(1, level));
}

/** Motion targets for MicLevelAura from a normalized mic level (75% of full strength). */
export function micLevelAuraMotion(level: number, visible: boolean) {
  const clamped = clampMicLevel(level);
  return {
    opacity: visible ? 0.33 + clamped * 0.42 : 0,
    scale: visible ? 1.06 + clamped * 0.69 : 0.91,
    y: visible ? -3 - clamped * 16.5 : 0,
  };
}

export function micLevelMeterLabel(level: number): 'Quiet' | 'Low' | 'Good' | 'Hot' {
  const clamped = clampMicLevel(level);
  if (clamped < 0.02) return 'Quiet';
  if (clamped < 0.35) return 'Low';
  if (clamped < 0.7) return 'Good';
  return 'Hot';
}

interface AudioContextType {
  isAudioPipelineReady: boolean;
  micLevel: number;
  setMicLevelPreview: (active: boolean) => void;
}

export const AudioContext = createContext<AudioContextType | undefined>(undefined);

function downsampleToTarget(
  input: Float32Array,
  inputSampleRate: number,
  targetSampleRate: number,
): Float32Array {
  if (inputSampleRate <= targetSampleRate) return input;
  const ratio = inputSampleRate / targetSampleRate;
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

function buildAudioConstraints(prefs: AudioSettings): MediaTrackConstraints {
  const audio: MediaTrackConstraints = {
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: prefs.noiseSuppression,
  };
  if (prefs.inputDeviceId) {
    audio.deviceId = { ideal: prefs.inputDeviceId };
  }
  return audio;
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const { audioSettings } = useSystem();
  const { permissionsGateOpen } = useService();
  const runtime = useAssistantRuntimeState();
  const sessionId = getRealtimeSessionId();
  const { startListening } = useCommand();
  const voiceEnrollmentActive = selectVoiceEnrollmentActive(runtime);
  const state = runtime.commandState;
  const tutorial = useTutorialContext();
  const tutorialEngaged = useTutorialEngaged();

  const [isAudioPipelineReady, setIsAudioPipelineReady] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [streamAnalyserReady, setStreamAnalyserReady] = useState(false);
  const [previewAnalyserReady, setPreviewAnalyserReady] = useState(false);
  const [micPreviewWanted, setMicPreviewWanted] = useState(false);
  const [previewSettingsEpoch, setPreviewSettingsEpoch] = useState(0);

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

  const previewStreamRef = useRef<MediaStream | null>(null);
  const previewCtxRef = useRef<globalThis.AudioContext | null>(null);
  const previewAnalyserRef = useRef<AnalyserNode | null>(null);

  const wakeDetectorRef = useRef<OpenWakeWordDetector | null>(null);
  const wakeDetectorFailureLoggedRef = useRef(false);
  const commandAudioEndSentRef = useRef(false);
  const audioSettingsRef = useRef<AudioSettings>(DEFAULT_AUDIO_SETTINGS);
  const micPreviewRequestsRef = useRef(0);
  const voiceEnrollmentRef = useRef(false);
  voiceEnrollmentRef.current = voiceEnrollmentActive;

  const rearmIntroductionCapture = useCallback(() => {
    if (!voiceEnrollmentRef.current || !commandStreamActiveRef.current) return;
    commandAudioEndSentRef.current = false;
    commandStreamReadyRef.current = false;
    sendRealtimeMessage({ type: 'command_audio_discard' });
    sendRealtimeMessage({
      type: 'command_audio_start',
      sample_rate: audioSettingsRef.current.sampleRate,
      introduction_mode: true,
    });
  }, []);

  const setMicLevelPreview = useCallback((active: boolean) => {
    micPreviewRequestsRef.current = Math.max(
      0,
      micPreviewRequestsRef.current + (active ? 1 : -1),
    );
    setMicPreviewWanted(micPreviewRequestsRef.current > 0);
  }, []);

  const stopMicPreviewStream = useCallback(() => {
    if (previewAnalyserRef.current) {
      previewAnalyserRef.current.disconnect();
      previewAnalyserRef.current = null;
    }
    setPreviewAnalyserReady(false);
    if (previewCtxRef.current) {
      void previewCtxRef.current.close();
      previewCtxRef.current = null;
    }
    if (previewStreamRef.current) {
      previewStreamRef.current.getTracks().forEach(t => t.stop());
      previewStreamRef.current = null;
    }
  }, []);

  const startMicPreviewStream = useCallback(async () => {
    if (previewAnalyserRef.current) return;
    const prefs = audioSettingsRef.current;
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: buildAudioConstraints(prefs),
      });
      previewStreamRef.current = media;
      const ctx = new window.AudioContext();
      previewCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(media);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = MIC_LEVEL_ANALYSER_FFT;
      analyser.smoothingTimeConstant = MIC_LEVEL_ANALYSER_SMOOTHING;
      source.connect(analyser);
      previewAnalyserRef.current = analyser;
      setPreviewAnalyserReady(true);
    } catch (e) {
      console.warn('[Audio] mic level preview unavailable', e);
      stopMicPreviewStream();
    }
  }, [stopMicPreviewStream]);

  const commitCommandCapture = useCallback(() => {
    forwardChunksRef.current = false;
    if (!commandStreamActiveRef.current || commandAudioEndSentRef.current) return;
    commandAudioEndSentRef.current = true;
    sendRealtimeMessage({ type: 'command_audio_end' });
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    forwardChunksRef.current = selectShouldForwardAudioChunks(runtime);
  }, [runtime]);

  useEffect(() => subscribeCommandCaptureCommit(commitCommandCapture), [commitCommandCapture]);

  useEffect(() => {
    const prev = prevStateRef.current;
    if (prev === 'listening' && (state === 'transcribing' || ASSISTANT_BUSY_STATES.includes(state))) {
      commitCommandCapture();
    } else if (
      (ASSISTANT_BUSY_STATES.includes(state) && prev === 'follow_up') ||
      (state === 'follow_up' &&
        ASSISTANT_BUSY_STATES.includes(prev) &&
        !voiceEnrollmentRef.current)
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
    if (state === 'follow_up' && prev !== 'follow_up' && voiceEnrollmentRef.current) {
      rearmIntroductionCapture();
    }
    prevStateRef.current = state;
  }, [state, commitCommandCapture, rearmIntroductionCapture]);

  useEffect(() => {
    if (state === 'listening' || state === 'follow_up') {
      commandAudioEndSentRef.current = false;
    }
  }, [state]);

  useEffect(() => {
    const commandAnalyser = streamAnalyserReady ? analyserRef.current : null;
    const previewAnalyser = previewAnalyserReady ? previewAnalyserRef.current : null;
    const analyser = commandAnalyser ?? previewAnalyser;

    if (!analyser) {
      setMicLevel(0);
      return;
    }

    const buf = new Uint8Array(analyser.fftSize);
    const meterFromCommand = Boolean(commandAnalyser);
    let raf = 0;
    let speechActive = false;

    const tick = () => {
      const level = computeMicLevelFromAnalyser(analyser, buf);
      setMicLevel(level);

      if (meterFromCommand) {
        const inCapture =
          stateRef.current === 'listening' || stateRef.current === 'follow_up';
        if (inCapture) {
          const speaking = level >= FOLLOW_UP_SPEECH_RMS;
          if (speaking && !speechActive && stateRef.current === 'follow_up') {
            notifyVoiceSpeechActivity();
          }
          speechActive = speaking;
        } else {
          speechActive = false;
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [streamAnalyserReady, previewAnalyserReady, state]);

  const onWakeWordDetected = useCallback(
    (_timestampMs: number, wakeWord: WakeWordLabel) => {
      if (permissionsGateOpen) return;
      if (tutorialEngaged && !tutorial?.wakeWordEnabled) {
        return;
      }
      if (
        stateRef.current === 'transcribing' ||
        stateRef.current === 'thinking' ||
        stateRef.current === 'responding' ||
        stateRef.current === 'locked'
      ) {
        return;
      }
      // armWakeListening sends command_audio_wake before claim.
      console.debug(
        `[Voice][Wake] detected ${wakeWord} — entering listening (server will transcribe)`,
      );
      startListening();
    },
    [permissionsGateOpen, startListening, tutorial, tutorialEngaged],
  );

  const stopCommandAudioStream = useCallback(
    (cancel = false) => {
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
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      }
      if (commandStreamActiveRef.current) {
        sendRealtimeMessage({ type: cancel ? 'command_audio_cancel' : 'command_audio_end' });
      }
      commandStreamActiveRef.current = false;
      commandStreamReadyRef.current = false;
      lastCommandStartAttemptMsRef.current = 0;

      if (micPreviewRequestsRef.current > 0) {
        setPreviewSettingsEpoch(e => e + 1);
      }
    },
    [],
  );

  const ensureCommandSessionStarted = useCallback((nowMs: number, force = false) => {
    if (!commandStreamActiveRef.current) return;
    if (commandStreamReadyRef.current) return;
    if (!force && nowMs - lastCommandStartAttemptMsRef.current < COMMAND_START_RETRY_MS) return;
    lastCommandStartAttemptMsRef.current = nowMs;
    sendRealtimeMessage({
      type: 'command_audio_start',
      sample_rate: audioSettingsRef.current.sampleRate,
      ...(voiceEnrollmentRef.current ? { introduction_mode: true } : {}),
    });
  }, []);

  const rearmCommandCapture = useCallback(() => {
    commandAudioEndSentRef.current = false;
    commandStreamReadyRef.current = false;
    if (commandStreamActiveRef.current) {
      ensureCommandSessionStarted(Date.now(), true);
    }
  }, [ensureCommandSessionStarted]);

  useEffect(() => subscribeCommandCaptureRearm(rearmCommandCapture), [rearmCommandCapture]);

  const startCommandAudioStream = useCallback(async () => {
    if (commandStreamActiveRef.current) return;
    stopMicPreviewStream();

    const prefs = audioSettingsRef.current;
    const media = await navigator.mediaDevices.getUserMedia({
      audio: buildAudioConstraints(prefs),
    });
    mediaStreamRef.current = media;

    if (ENABLE_LOCAL_WAKE_DETECTOR) {
      const wakeDetector = new OpenWakeWordDetector({ threshold: 0.5 });
      wakeDetector.onWakeWord(onWakeWordDetected);
      try {
        await wakeDetector.start(media);
        wakeDetectorRef.current = wakeDetector;
      } catch (error) {
        if (!wakeDetectorFailureLoggedRef.current) {
          wakeDetectorFailureLoggedRef.current = true;
          console.error('[Audio] wake-word detector start failed; ambient capture continues', error);
        } else {
          console.warn('[Audio] wake-word detector unavailable for this session.');
        }
        wakeDetectorRef.current = null;
      }
    }

    const ctx = new window.AudioContext({ sampleRate: prefs.sampleRate });
    webAudioCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(media);
    sourceNodeRef.current = source;

    const analyserNode = ctx.createAnalyser();
    analyserNode.fftSize = MIC_LEVEL_ANALYSER_FFT;
    analyserNode.smoothingTimeConstant = MIC_LEVEL_ANALYSER_SMOOTHING;
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

    processor.onaudioprocess = event => {
      if (!commandStreamActiveRef.current || !forwardChunksRef.current) return;
      const input = event.inputBuffer.getChannelData(0);
      const downsampled = downsampleToTarget(
        input,
        ctx.sampleRate,
        audioSettingsRef.current.sampleRate,
      );
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
  }, [ensureCommandSessionStarted, onWakeWordDetected, stopMicPreviewStream]);

  useEffect(() => {
    audioSettingsRef.current = audioSettings;
  }, [audioSettings]);

  useEffect(() => {
    const onSettingsChanged = (event: Event) => {
      const detail = (event as CustomEvent<AudioSettings>).detail;
      if (detail) audioSettingsRef.current = detail;
      setPreviewSettingsEpoch(e => e + 1);
      if (!commandStreamActiveRef.current) return;
      stopCommandAudioStream(true);
      void startCommandAudioStream().catch(e => {
        console.error('[Audio] failed to restart stream after settings change', e);
        stopCommandAudioStream(true);
      });
    };
    window.addEventListener(AUDIO_SETTINGS_CHANGED, onSettingsChanged);
    return () => window.removeEventListener(AUDIO_SETTINGS_CHANGED, onSettingsChanged);
  }, [startCommandAudioStream, stopCommandAudioStream]);

  useEffect(() => {
    const off = subscribeRealtimeMessages(msg => {
      if (msg.event === 'command_transcript_ready') {
        commandStreamReadyRef.current = true;
      }
    });
    return off;
  }, []);

  useEffect(() => {
    const shouldListen =
      selectShouldRunAudioPipeline(runtime, sessionId) && !permissionsGateOpen;
    setIsAudioPipelineReady(shouldListen);
  }, [permissionsGateOpen, runtime, sessionId]);

  useEffect(() => {
    const shouldListen =
      selectShouldRunAudioPipeline(runtime, sessionId) && !permissionsGateOpen;
    const shouldStream = shouldListen && selectShouldStreamAudio(runtime);
    if (shouldStream && !commandStreamActiveRef.current) {
      void startCommandAudioStream().catch(e => {
        console.error('[Audio] command stream start failed', e);
        stopCommandAudioStream(true);
      });
    } else if (!shouldStream && commandStreamActiveRef.current) {
      stopCommandAudioStream(true);
    }
  }, [
    permissionsGateOpen,
    runtime,
    sessionId,
    startCommandAudioStream,
    stopCommandAudioStream,
  ]);

  useEffect(() => {
    if (!micPreviewWanted || streamAnalyserReady) {
      stopMicPreviewStream();
      return;
    }
    void startMicPreviewStream();
    return () => stopMicPreviewStream();
  }, [
    micPreviewWanted,
    streamAnalyserReady,
    previewSettingsEpoch,
    startMicPreviewStream,
    stopMicPreviewStream,
  ]);

  useEffect(() => () => {
    stopCommandAudioStream(true);
    stopMicPreviewStream();
  }, [stopCommandAudioStream, stopMicPreviewStream]);

  return (
    <AudioContext.Provider
      value={{ isAudioPipelineReady, micLevel, setMicLevelPreview }}
    >
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) throw new Error('useAudio must be used within AudioProvider');
  return context;
}

/** Enable settings mic meter; shares the same level source as the command mic aura. */
export function useMicLevelPreview(enabled = true): number {
  const ctx = useContext(AudioContext);
  const setPreview = ctx?.setMicLevelPreview;

  useEffect(() => {
    if (!enabled || !setPreview) return;
    setPreview(true);
    return () => setPreview(false);
  }, [enabled, setPreview]);

  return ctx?.micLevel ?? 0;
}
