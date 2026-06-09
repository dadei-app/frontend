import { useRef } from 'react';
import { Mic } from 'lucide-react';
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';

export default function FloatingAppMockup() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const rotateX = useTransform(scrollYProgress, [0, 0.45], reduce ? [0, 0] : [10, -2]);
  const rotateY = useTransform(scrollYProgress, [0, 0.45], reduce ? [0, 0] : [-8, 6]);
  const y = useTransform(scrollYProgress, [0, 0.5], reduce ? [0, 0] : [70, -10]);
  const scale = useTransform(scrollYProgress, [0, 0.35], reduce ? [1, 1] : [0.94, 1.02]);
  const springRotateX = useSpring(rotateX, { stiffness: 85, damping: 24 });
  const springRotateY = useSpring(rotateY, { stiffness: 85, damping: 24 });

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[min(92vw,620px)] perspective-[1600px]">
      <motion.div
        style={{
          rotateX: springRotateX,
          rotateY: springRotateY,
          y,
          scale,
          transformStyle: 'preserve-3d',
        }}
        className="relative rounded-[1.6rem] border border-emerald-300/25 bg-zinc-950/70 p-2 shadow-[0_60px_120px_-35px_rgba(0,0,0,0.8),0_0_0_1px_rgba(16,185,129,0.18)_inset] backdrop-blur-2xl"
      >
        <motion.div
          animate={reduce ? undefined : { y: [0, -8, 0] }}
          transition={
            reduce ? undefined : { duration: 5.2, repeat: Infinity, ease: 'easeInOut' }
          }
          className="relative"
        >
          <div className="absolute -inset-8 -z-10 rounded-4xl bg-linear-to-br from-emerald-500/20 via-teal-400/12 to-violet-500/20 blur-3xl" />
          <div className="flex items-stretch gap-0 overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-zinc-900 via-zinc-900 to-zinc-800/85 shadow-inner">
            <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-10">
              <div className="relative">
                <div className="absolute inset-0 animate-pulse rounded-full bg-emerald-500/35 blur-xl" />
                <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-emerald-200/20 bg-linear-to-br from-emerald-500 to-teal-500 text-white shadow-[0_24px_60px_rgba(16,185,129,0.45)]">
                  <Mic className="h-10 w-10" aria-hidden />
                </div>
              </div>
              <p className="text-center text-xs font-semibold tracking-[0.22em] text-emerald-200/70 font-secondary">
                LISTENING
              </p>
            </div>
            <div className="min-h-[220px] w-[min(52%,240px)] border-l border-white/8 bg-zinc-950/70 p-3">
              <div className="mb-2 flex items-center gap-2 border-b border-white/8 pb-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-[10px] font-semibold text-zinc-400 font-secondary">
                  MOMENTS CAPTURED
                </span>
              </div>
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div
                    key={i}
                    className="rounded-lg border border-white/5 bg-zinc-900/90 px-2 py-2 shadow-sm"
                    style={{ opacity: 1 - i * 0.15 }}
                  >
                    <div className="mb-1 h-1.5 w-3/4 rounded-full bg-zinc-700" />
                    <div className="h-1 w-1/2 rounded-full bg-zinc-800" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="pointer-events-none absolute -right-8 top-1/4 hidden h-24 w-24 rounded-2xl border border-emerald-300/20 bg-zinc-900/80 shadow-xl sm:block md:-right-12 md:h-28 md:w-28" />
          <div
            className="pointer-events-none absolute -left-6 bottom-1/4 hidden h-16 w-16 rounded-xl border border-violet-300/25 bg-zinc-900/90 shadow-lg sm:block"
            style={{ transform: 'translateZ(40px)' }}
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
