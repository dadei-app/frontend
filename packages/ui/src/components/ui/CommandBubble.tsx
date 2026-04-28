import { motion } from 'framer-motion';

export interface CommandBubbleProps {
  role: 'assistant' | 'user';
  mode: 'capturing' | 'streaming' | 'done';
  text: string;
  activeToolCall?: string;
  variant?: 'live' | 'history';
}

export default function CommandBubble({
  role,
  mode,
  text,
  activeToolCall,
  variant = 'live',
}: CommandBubbleProps) {
  const isHistory = variant === 'history';
  const isAssistant = role === 'assistant';
  const displayText =
    text.trim() ||
    (mode === 'capturing'
      ? 'Listening...'
      : isAssistant
        ? 'Thinking...'
        : 'Waiting for speech...');

  return (
    <motion.div
      initial={{ opacity: 0, y: 22, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 14, scale: 0.96 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      className={`relative flex w-full ${isAssistant ? 'justify-start' : 'justify-end'}`}
    >
      <div
        className="pointer-events-none absolute -inset-x-6 -inset-y-6 rounded-[2.5rem] bg-[radial-gradient(ellipse_90%_72%_at_50%_18%,rgba(52,211,153,0.28),transparent_70%)] blur-2xl"
        aria-hidden
      />
      <div
        className={`relative w-fit max-w-[78%] overflow-visible rounded-[2.1rem] border px-5 py-4 shadow-[0_22px_65px_rgba(16,185,129,0.3),0_12px_30px_rgba(7,30,42,0.45)] backdrop-blur-xl ${
          isAssistant
            ? 'border-emerald-100/35 bg-[linear-gradient(128deg,rgba(20,184,166,0.2)_0%,rgba(16,185,129,0.22)_22%,rgba(110,231,183,0.13)_42%,rgba(240,253,250,0.22)_58%,rgba(20,184,166,0.2)_100%)] ring-1 ring-emerald-200/35'
            : 'border-cyan-100/25 bg-[linear-gradient(132deg,rgba(14,116,144,0.34),rgba(6,182,212,0.22)_45%,rgba(14,165,233,0.24))] ring-1 ring-cyan-200/20'
        }`}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.1rem]" aria-hidden>
          <div
            className={`absolute inset-0 ${
              isAssistant
                ? 'bg-[radial-gradient(ellipse_130%_96%_at_50%_-35%,rgba(236,253,245,0.55),transparent_42%),radial-gradient(ellipse_80%_65%_at_50%_120%,rgba(16,185,129,0.2),transparent_72%)]'
                : 'bg-[radial-gradient(ellipse_110%_90%_at_50%_-30%,rgba(224,242,254,0.45),transparent_45%),radial-gradient(ellipse_80%_70%_at_45%_120%,rgba(14,165,233,0.22),transparent_72%)]'
            }`}
          />
          {!isHistory && isAssistant ? (
            <motion.div
              className="absolute inset-y-[10%] left-[-32%] w-[28%] transform-gpu rounded-4xl bg-[linear-gradient(90deg,transparent,rgba(236,253,245,0.42),transparent)] will-change-transform"
              animate={{ x: ['0%', '470%'] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.8 }}
            />
          ) : null}
        </div>

        <div className="relative">
          <p
            className={`font-primary text-[15px] leading-relaxed ${
              isAssistant
                ? 'text-emerald-50 drop-shadow-[0_0_10px_rgba(167,243,208,0.15)]'
                : 'text-cyan-50 drop-shadow-[0_0_10px_rgba(125,211,252,0.18)]'
            }`}
          >
            {displayText}
          </p>
          {activeToolCall && isAssistant ? (
            <p className="mt-2 font-secondary text-[11px] font-medium tracking-wide text-emerald-100">
              <span className="inline-block animate-pulse">⚙</span> {activeToolCall}...
            </p>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
