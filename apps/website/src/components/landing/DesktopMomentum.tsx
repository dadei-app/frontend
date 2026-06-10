import { motion } from 'framer-motion';
import { Apple, Download, Monitor, Terminal } from 'lucide-react';

const PLATFORMS = [
  { id: 'macos', label: 'macOS', Icon: Apple },
  { id: 'windows', label: 'Windows', Icon: Monitor },
  { id: 'linux', label: 'Linux', Icon: Terminal },
] as const;

const RELEASE_URL = 'https://github.com/dadei-app/frontend/releases/latest';

export default function DesktopMomentum() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45 }}
      className="mx-auto w-full max-w-[1240px] px-5 pt-14 sm:px-8"
    >
      <div className="glass-panel conic-border relative overflow-hidden rounded-3xl border border-emerald-300/20 bg-zinc-950/45 p-6 sm:p-8">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/15 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-12 h-44 w-44 rounded-full bg-cyan-500/10 blur-3xl"
          aria-hidden
        />

        <div className="relative z-10 flex flex-col gap-6 sm:gap-7">
          <div className="max-w-2xl">
            <p className="text-xs tracking-[0.22em] text-emerald-200/75 font-secondary sm:text-sm">
              desktop first momentum
            </p>
            <h2 className="mt-2 font-primary text-2xl leading-tight text-zinc-50 sm:text-3xl lg:text-4xl">
              keep dadei close on your desktop.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300/90 font-secondary sm:text-base">
              start with desktop if you want dadei one click away — fast capture, reminders, and
              follow-through all day.
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 sm:flex-wrap sm:overflow-visible">
              {PLATFORMS.map((platform) => (
                <div
                  key={platform.id}
                  className="flex shrink-0 items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3.5 py-2 backdrop-blur-md"
                >
                  <platform.Icon className="h-4 w-4 text-emerald-200/90" aria-hidden />
                  <span className="text-sm text-zinc-100 font-secondary">{platform.label}</span>
                </div>
              ))}
            </div>

            <a
              href={RELEASE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="holo-btn holo-btn-primary relative inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-secondary sm:px-5"
            >
              <Download className="relative z-10 h-4 w-4" aria-hidden />
              <span className="relative z-10">download desktop</span>
            </a>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
