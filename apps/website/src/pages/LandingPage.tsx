import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Brain, WandSparkles, Waves, type LucideIcon } from 'lucide-react';
import { DadeiLogo } from '@dadei/ui/components/brand/DadeiLogo';
import DesktopMomentum from '@/components/landing/DesktopMomentum';
import FloatingAppMockup from '@/components/landing/FloatingAppMockup';
import IntegrationsShowcase from '@/components/landing/IntegrationsShowcase';
import LaunchConversationIntro from '@/components/landing/LaunchConversationIntro';

function SectionHeading({
  eyebrow,
  title,
  body,
  compact = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  compact?: boolean;
}) {
  return (
    <div className="max-w-4xl">
      <p
        className={`mb-1.5 tracking-[0.22em] text-emerald-300/75 font-secondary ${
          compact ? 'text-xs sm:text-sm' : 'text-xs sm:text-md'
        }`}
      >
        {eyebrow}
      </p>
      <h2
        className={`font-primary leading-tight tracking-tight text-zinc-100 ${
          compact
            ? 'text-2xl sm:text-3xl lg:text-4xl'
            : 'text-2xl sm:text-4xl lg:text-5xl'
        }`}
      >
        {title}
      </h2>
      <p
        className={`leading-relaxed text-zinc-300 font-secondary ${
          compact ? 'mt-3 text-sm sm:mt-4 sm:text-base' : 'mt-4 text-sm sm:mt-5 sm:text-lg'
        }`}
      >
        {body}
      </p>
    </div>
  );
}

export default function LandingPage() {
  const [showFloatingDock, setShowFloatingDock] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setShowFloatingDock(window.scrollY > window.innerHeight * 0.9);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#070a10] text-zinc-100 antialiased lowercase">
      <div className="pointer-events-none fixed inset-0 -z-10 atmosphere-grain">
        <div className="absolute inset-0 assistant-shell-atmosphere" />
        <div className="absolute right-0 top-1/4 h-[620px] w-[620px] translate-x-1/3 rounded-full bg-violet-700/14 blur-[96px]" />
        <div className="absolute bottom-0 left-0 h-[520px] w-[520px] -translate-x-1/3 rounded-full bg-emerald-600/14 blur-[96px]" />
      </div>

      <AnimatePresence>
        {showFloatingDock && (
          <motion.div
            initial={{ opacity: 0, y: -28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -28, scale: 0.96 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="pointer-events-auto fixed right-3 top-3 z-[200] sm:right-5 sm:top-4"
          >
            <div className="landing-dock rounded-xl p-1 sm:rounded-2xl sm:p-1.5">
              <div className="flex items-center gap-1 sm:gap-1.5">
                <Link
                  to="/assistant"
                  className="dock-btn dock-btn-primary rounded-lg px-2.5 py-1.5 text-[11px] font-secondary sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm"
                >
                  open assistant
                </Link>
                <a
                  href="https://github.com/dadei-app/frontend/releases/latest"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dock-btn dock-btn-secondary rounded-lg px-2.5 py-1.5 text-[11px] font-secondary sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm"
                >
                  download app
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="pb-20">
        <LaunchConversationIntro />

        <section id="meet" className="mx-auto w-full max-w-[1240px] px-5 py-8 sm:px-8 sm:py-14">
          <div className="mb-8 flex justify-center sm:mb-10">
            <DadeiLogo markSize={52} textClassName="text-3xl tracking-[0.2em] sm:text-4xl" />
          </div>
          <div className="grid items-center gap-6 sm:gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
            <div>
              <SectionHeading
                compact
                eyebrow="Meet dadei"
                title="the assistant you forget about, until you need it."
                body="dadei keeps your context organized across your day, then shows up instantly when you ask for it."
              />
              <p className="mt-4 max-w-2xl rounded-xl border border-white/10 bg-zinc-900/60 px-4 py-3 text-sm leading-relaxed text-zinc-300 font-secondary sm:mt-6 sm:rounded-2xl sm:px-5 sm:py-4 sm:text-base">
                <span className="font-medium text-emerald-200">
                  "who was i just talking to?" "when did i last talk to mark?"
                </span>{' '}
                dadei is built for those moments. trigger it like a voice assistant when you want something
                done fast.
              </p>
            </div>
            <FloatingAppMockup />
          </div>
        </section>

        <section id="story" className="mx-auto w-full max-w-[1240px] px-5 py-14 sm:px-8">
          <div className="relative">
            <div className="pointer-events-none absolute -left-12 top-8 h-40 w-40 rounded-full bg-emerald-500/14 blur-3xl" />
            <div className="pointer-events-none absolute right-0 top-1/2 h-44 w-44 rounded-full bg-teal-500/10 blur-3xl" />

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45 }}
              className="relative z-10"
            >
              <SectionHeading
                eyebrow="why dadei?"
                title="named after my grandmother, dadi."
                body="growing up, she made sure i was fed, happy, and on track. she focused on the things i did not have to think about, because she wanted me to have a better life."
              />

            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, delay: 0.08 }}
              className="relative z-10 mt-10 max-w-5xl text-2xl leading-snug text-zinc-100 font-secondary sm:text-3xl"
            >
              <span className="text-emerald-200/90">"</span>
              <span> dadei carries that same spirit: quiet support, thoughtful reminders, and genuine care behind every nudge. </span>
              <span className="text-emerald-200/90">"</span>
            </motion.p>
          </div>
        </section>

        <section id="how" className="mx-auto w-full max-w-[1240px] px-5 py-8 sm:px-8 sm:py-14">
          <div className="rounded-3xl border border-emerald-300/15 bg-linear-to-br from-zinc-950 to-zinc-900 p-4 sm:rounded-4xl sm:p-10">
            <SectionHeading
              compact
              eyebrow="How it works"
              title="from captured moments to real follow-through."
              body="dadei uses ai to organize context, answer recall questions, and turn your requests into reminders, drafts, and follow-ups."
            />
            <div className="mt-6 grid gap-3 sm:mt-10 sm:gap-5 lg:grid-cols-3">
              {[
                {
                  step: '01',
                  icon: Waves,
                  title: 'capture important moments',
                  body: 'key details are extracted from your day so you don\'t need to manually log everything.',
                },
                {
                  step: '02',
                  icon: Brain,
                  title: 'pull context on demand',
                  body: 'ask things like "who was i just talking to?" or "when did i last talk to jason?"',
                },
                {
                  step: '03',
                  icon: WandSparkles,
                  title: 'let it handle follow-through',
                  body: 'dadei can draft reminders, texts, emails, and act like a voice assistant.',
                },
              ].map((item: { step: string; icon: LucideIcon; title: string; body: string }, i) => (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: i * 0.08 }}
                  whileHover={{ y: -5, scale: 1.01 }}
                  className="relative overflow-hidden rounded-xl border border-white/10 bg-zinc-900/85 p-4 shadow-[0_20px_50px_-30px_rgba(16,185,129,0.65)] sm:rounded-2xl sm:p-6"
                >
                  <div className="pointer-events-none absolute -right-10 -top-10 h-20 w-20 rounded-full bg-emerald-400/20 blur-2xl sm:h-28 sm:w-28" />
                  <span className="text-2xl font-bold text-emerald-300/30 sm:text-4xl">{item.step}</span>
                  <div className="mt-2 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-200 sm:mt-4 sm:h-11 sm:w-11 sm:rounded-xl">
                    <item.icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
                  </div>
                  <h3 className="mt-2 text-base text-zinc-100 sm:mt-4 sm:text-xl">{item.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-zinc-400 font-secondary sm:mt-2 sm:text-sm">{item.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="capabilities" className="mx-auto w-full max-w-[1240px] px-5 py-14 sm:px-8">
          <SectionHeading
            eyebrow="plugins & integrations"
            title="connect your accounts, then let dadei act."
            body="Sign in with Google, Microsoft, or Apple. Link work and personal inboxes, pick defaults for mail and calendar, and use always-on realtime data — no extra setup."
          />
          <IntegrationsShowcase />
        </section>

        <DesktopMomentum />
      </main>

      <footer className="border-t border-white/10 bg-zinc-950/70 py-10">
        <div className="mx-auto flex w-full max-w-[1240px] flex-col items-center justify-between gap-5 px-5 sm:flex-row sm:px-8">
          <div className="flex items-center gap-4 text-zinc-400">
            <DadeiLogo markSize={28} textClassName="text-xl tracking-[0.18em]" />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-zinc-300 font-secondary">
            <Link to="/privacy" className="hover:text-zinc-100">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-zinc-100">
              Terms
            </Link>
            <a
              href="https://github.com/dadei-app/frontend/releases/latest"
              className="hover:text-zinc-100"
              target="_blank"
              rel="noopener noreferrer"
            >
              Download desktop
            </a>
            <a
              href="https://github.com/dadei-app/frontend/issues/new/choose"
              className="hover:text-zinc-100"
              target="_blank"
              rel="noopener noreferrer"
            >
              have a problem
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
