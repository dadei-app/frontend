import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import * as Dialog from '@radix-ui/react-dialog';
import { useNotifications } from '@dadei/ui/contexts/NotificationContext';
import { getUserErrorMessage } from '@dadei/ui/lib/errors/userMessage';
import { encodeFloat32ToWav } from '@dadei/ui/lib/audio/encodeWav';
import { veilEase } from '@dadei/ui/lib/shared/motion';
import {
  settingsInputClass,
  settingsPrimaryButtonClass,
} from '@dadei/ui/components/settings/layout';

const SAMPLE_RATE = 16000;
const MIN_RECORD_SECONDS = 5;

export const VOICE_RETRAIN_PASSAGE =
  'The quick voice profile uses every tone we need. Please read this clearly at a calm pace, with the microphone near you, in a quiet room.';

export type VoiceRetrainDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (wavBuffer: ArrayBuffer) => Promise<void>;
  isSubmitting: boolean;
};

export function VoiceRetrainDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: VoiceRetrainDialogProps) {
  const { showToast } = useNotifications();
  const prefersReducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<'idle' | 'recording' | 'recorded'>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState('');

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const samplesRef = useRef<number[]>([]);
  const recordedSamplesRef = useRef<number[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const overlayTransition = prefersReducedMotion
    ? { duration: 0.12 }
    : { duration: 0.22, ease: veilEase };
  const contentInitial = prefersReducedMotion
    ? { opacity: 0 }
    : { opacity: 0, scale: 0.96, y: 8 };
  const contentAnimate = { opacity: 1, scale: 1, y: 0 };
  const contentExit = prefersReducedMotion
    ? { opacity: 0, transition: { duration: 0.1 } }
    : { opacity: 0, scale: 0.96, y: 8, transition: { duration: 0.16, ease: veilEase } };
  const contentTransition = prefersReducedMotion
    ? { duration: 0.12 }
    : { duration: 0.26, ease: veilEase };

  const cleanupCapture = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    processorRef.current?.disconnect();
    processorRef.current = null;
    ctxRef.current?.close().catch(() => undefined);
    ctxRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    samplesRef.current = [];
    startedAtRef.current = null;
  }, []);

  const clearRecorded = () => {
    recordedSamplesRef.current = [];
  };

  const reset = useCallback(() => {
    cleanupCapture();
    clearRecorded();
    setPhase('idle');
    setElapsedSec(0);
    setError('');
  }, [cleanupCapture]);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  useEffect(() => () => cleanupCapture(), [cleanupCapture]);

  const startRecording = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone access is not available in this environment.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;
      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      samplesRef.current = [];
      processor.onaudioprocess = e => {
        const input = e.inputBuffer.getChannelData(0);
        for (let i = 0; i < input.length; i++) {
          samplesRef.current.push(input[i] ?? 0);
        }
      };
      source.connect(processor);
      processor.connect(ctx.destination);
      startedAtRef.current = Date.now();
      setPhase('recording');
      setElapsedSec(0);
      timerRef.current = setInterval(() => {
        const start = startedAtRef.current;
        if (!start) return;
        setElapsedSec(Math.floor((Date.now() - start) / 1000));
      }, 250);
    } catch (e) {
      console.error('[VoiceRetrain] mic error', e);
      setError(getUserErrorMessage(e, 'Could not access the microphone.'));
      cleanupCapture();
    }
  };

  const stopRecording = () => {
    const durationSec =
      startedAtRef.current != null
        ? (Date.now() - startedAtRef.current) / 1000
        : 0;
    recordedSamplesRef.current = [...samplesRef.current];
    cleanupCapture();
    if (durationSec < MIN_RECORD_SECONDS) {
      clearRecorded();
      setError(`Record at least ${MIN_RECORD_SECONDS} seconds, then try again.`);
      setPhase('idle');
      return;
    }
    setPhase('recorded');
  };

  const handleSubmit = async () => {
    setError('');
    const raw = recordedSamplesRef.current;
    if (raw.length < SAMPLE_RATE * MIN_RECORD_SECONDS) {
      setError(`Record at least ${MIN_RECORD_SECONDS} seconds, then try again.`);
      return;
    }
    const floats = new Float32Array(raw);
    const wav = encodeFloat32ToWav(floats, SAMPLE_RATE);
    try {
      await onSubmit(wav);
      showToast('Voice profile updated', 'success');
      onOpenChange(false);
    } catch (e) {
      console.error('[VoiceRetrain] submit failed', e);
      setError(getUserErrorMessage(e, 'Could not update your voice profile.'));
    }
  };

  const canSubmit = phase === 'recorded' && !isSubmitting;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={overlayTransition}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                className="fixed left-1/2 top-1/2 z-[201] w-[min(100%-2rem,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-zinc-950 p-6 shadow-2xl"
                initial={contentInitial}
                animate={contentAnimate}
                exit={contentExit}
                transition={contentTransition}
              >
                <Dialog.Title className="text-lg font-semibold text-zinc-100">
                  Retrain your voice
                </Dialog.Title>
                <Dialog.Description className="mt-2 text-sm leading-relaxed text-zinc-400 font-secondary">
                  This replaces your stored voice signature entirely. Read the passage below in one
                  take, then submit.
                </Dialog.Description>

                <p
                  className={`${settingsInputClass} mt-4 text-sm leading-relaxed text-zinc-200`}
                  aria-live="polite"
                >
                  {VOICE_RETRAIN_PASSAGE}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {phase === 'idle' && (
                    <button
                      type="button"
                      onClick={() => void startRecording()}
                      disabled={isSubmitting}
                      className={settingsPrimaryButtonClass}
                    >
                      Start recording
                    </button>
                  )}
                  {phase === 'recording' && (
                    <>
                      <span className="text-sm tabular-nums text-emerald-300/90">
                        Recording… {elapsedSec}s
                      </span>
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="rounded-lg border border-rose-500/35 bg-rose-950/40 px-4 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-950/70"
                      >
                        Stop
                      </button>
                    </>
                  )}
                  {phase === 'recorded' && (
                    <>
                      <span className="text-sm text-zinc-400">Recording ready</span>
                      <button
                        type="button"
                        onClick={() => {
                          reset();
                          void startRecording();
                        }}
                        disabled={isSubmitting}
                        className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/5"
                      >
                        Record again
                      </button>
                    </>
                  )}
                </div>

                {error ? (
                  <p className="mt-3 text-sm text-rose-300/90" role="alert">
                    {error}
                  </p>
                ) : null}

                <div className="mt-6 flex justify-end gap-2">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
                    >
                      Cancel
                    </button>
                  </Dialog.Close>
                  <button
                    type="button"
                    disabled={!canSubmit}
                    onClick={() => void handleSubmit()}
                    className={settingsPrimaryButtonClass}
                  >
                    {isSubmitting ? 'Saving…' : 'Save voice profile'}
                  </button>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
