import { useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { motion } from 'framer-motion';

const launchMessages = [
  { side: 'left', text: 'i missed my class!', appearAt: 0.2, readFor: 1.4 },
  {
    side: 'left',
    text: 'omg same, yesterday i forgot to wish my mom happy bday!',
    appearAt: 1.6,
    readFor: 2.4,
  },
  {
    side: 'left',
    text: "i'm too lazy to even update my reminders.",
    appearAt: 4.0,
    readFor: 1.9,
  },
  { side: 'right', text: 'you guys should try dadei', appearAt: 5.9, readFor: 1.5 },
] as const;

export default function LaunchConversationIntro() {
  const [isScrollHovered, setIsScrollHovered] = useState(false);
  const finalMessage = launchMessages[launchMessages.length - 1];
  const arrowRevealDelay = finalMessage.appearAt + finalMessage.readFor;

  const scrollToMeet = () => {
    document.getElementById('meet')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-5 sm:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(16,185,129,0.15),transparent_55%)]" />
        <div className="absolute left-1/2 top-1/2 h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-3xl space-y-4">
        {launchMessages.map((message) => (
          <motion.div
            key={message.text}
            initial={{
              opacity: 0,
              y: -120,
              scale: 1.08,
              rotate: message.side === 'left' ? -1 : 1,
            }}
            animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
            transition={{
              delay: message.appearAt,
              type: 'spring',
              stiffness: 520,
              damping: 20,
              mass: 0.68,
            }}
            className={`flex ${message.side === 'left' ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-132 rounded-[1.35rem] border px-5 py-3 text-base leading-relaxed shadow-2xl backdrop-blur-xl font-secondary sm:text-lg ${
                message.side === 'left'
                  ? 'border-zinc-400/30 bg-zinc-800/58 text-zinc-100'
                  : 'border-emerald-200/40 bg-linear-to-r from-emerald-400/56 to-teal-400/52 text-white'
              }`}
            >
              {message.text}
            </div>
          </motion.div>
        ))}
      </div>

      <motion.button
        type="button"
        onClick={scrollToMeet}
        onHoverStart={() => setIsScrollHovered(true)}
        onHoverEnd={() => setIsScrollHovered(false)}
        initial={{ opacity: 0, y: 18, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: arrowRevealDelay, duration: 0.45, ease: 'easeOut' }}
        className="group absolute bottom-10 left-1/2 z-20 -translate-x-1/2 rounded-full border border-emerald-200/60 bg-emerald-300/20 px-6 py-3 text-sm tracking-[0.16em] text-emerald-50 shadow-[0_0_0_1px_rgba(167,243,208,0.3)_inset,0_18px_50px_-18px_rgba(16,185,129,0.95)] backdrop-blur-md transition hover:scale-[1.03] hover:bg-emerald-300/30"
        aria-label="scroll to meet dadei"
      >
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full border border-emerald-200/45"
          animate={
            isScrollHovered
              ? { scale: [1, 1.12, 1], opacity: [0.85, 0.25, 0.85] }
              : { scale: 1, opacity: 0 }
          }
          transition={{ duration: 1.8, repeat: isScrollHovered ? Infinity : 0, ease: 'easeInOut' }}
        />
        <span className="relative flex items-center gap-2 font-secondary">
          <span>scroll down</span>
          <motion.span animate={{ y: [-1, 3, -1] }} transition={{ duration: 1.25, repeat: Infinity, ease: 'easeInOut' }}>
            <ArrowDown className="h-4 w-4" aria-hidden />
          </motion.span>
        </span>
      </motion.button>
    </section>
  );
}
