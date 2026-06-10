import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Brain,
  Inbox,
  Mic,
  Monitor,
  Terminal,
  WandSparkles,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import FloatingAppMockup from '@/components/landing/FloatingAppMockup';
import IntegrationsShowcase from '@/components/landing/IntegrationsShowcase';
import LaunchConversationIntro from '@/components/landing/LaunchConversationIntro';

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="max-w-4xl">
      <p className="mb-2 text-md tracking-[0.22em] text-emerald-300/75 font-secondary">
        {eyebrow}
      </p>
      <h2 className="font-primary text-3xl leading-tight tracking-tight text-zinc-100 sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      <p className="mt-5 text-base leading-relaxed text-zinc-300 sm:text-lg font-secondary">{body}</p>
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
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_-20%,rgba(16,185,129,0.18),transparent)]" />
        <div className="absolute right-0 top-1/4 h-[620px] w-[620px] translate-x-1/3 rounded-full bg-violet-700/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-[520px] w-[520px] -translate-x-1/3 rounded-full bg-emerald-600/20 blur-3xl" />
      </div>

      <AnimatePresence>
        {showFloatingDock && (
          <motion.div
            initial={{ opacity: 0, y: -28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -28, scale: 0.96 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
              className="fixed right-4 top-4 z-50 rounded-2xl border border-emerald-100/30 bg-white/8 p-2 shadow-[0_20px_54px_-26px_rgba(16,185,129,0.55),0_0_0_1px_rgba(255,255,255,0.08)_inset] backdrop-blur-2xl sm:right-6 sm:top-5"
          >
            <div className="flex items-center gap-2">
              <Link
                to="/assistant"
                  className="rounded-xl border border-emerald-100/35 bg-emerald-300/78 px-3 py-2 text-xs text-zinc-950 font-secondary shadow-[0_10px_24px_-16px_rgba(16,185,129,0.8)] hover:bg-emerald-200/86 sm:text-sm"
              >
                open assistant
              </Link>
              <a
                href="https://github.com/dadei-app/frontend/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
                  className="rounded-xl border border-white/20 bg-white/8 px-3 py-2 text-xs text-zinc-100 font-secondary backdrop-blur-xl hover:bg-white/14 sm:text-sm"
              >
                download app
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="pb-20">
        <LaunchConversationIntro />

        <section id="meet" className="mx-auto w-full max-w-[1240px] px-5 py-14 sm:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <SectionHeading
                eyebrow="Meet dadei"
                title="the assistant you forget about, until you need it."
                body="dadei keeps your context organized across your day, then shows up instantly when you ask for it."
              />
              <p className="mt-8 max-w-2xl rounded-2xl border border-white/10 bg-zinc-900/60 px-5 py-4 text-md leading-relaxed text-zinc-300 font-secondary">
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

        <section id="how" className="mx-auto w-full max-w-[1240px] px-5 py-14 sm:px-8">
          <div className="rounded-4xl border border-emerald-300/15 bg-linear-to-br from-zinc-950 to-zinc-900 p-7 sm:p-10">
            <SectionHeading
              eyebrow="How it works"
              title="from captured moments to real follow-through."
              body="dadei uses ai to organize context, answer recall questions, and turn your requests into reminders, drafts, and follow-ups."
            />
            <div className="mt-12 grid gap-5 lg:grid-cols-3">
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
                  className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/85 p-6 shadow-[0_20px_50px_-30px_rgba(16,185,129,0.65)]"
                >
                  <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-emerald-400/20 blur-2xl" />
                  <span className="text-4xl font-bold text-emerald-300/30">{item.step}</span>
                  <div className="mt-4 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-200">
                    <item.icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-xl text-zinc-100">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400 font-secondary">{item.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="capabilities" className="mx-auto w-full max-w-[1240px] px-5 py-14 sm:px-8">
          <SectionHeading
            eyebrow="plugins & integrations"
            title="dadei plugins turn integrations into action."
            body="connect once, then let dadei use your tools to help with reminders, recall, planning, and follow-through."
          />
          <IntegrationsShowcase />
        </section>

        <section className="mx-auto w-full max-w-[1240px] px-5 pt-14 sm:px-8">
          <div className="overflow-hidden rounded-4xl border border-emerald-300/25 bg-linear-to-r from-emerald-500/12 via-teal-500/10 to-cyan-500/10 p-8 shadow-[0_36px_90px_-45px_rgba(16,185,129,0.95)] sm:p-12">
            <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-md tracking-[0.2em] text-emerald-200/80 font-secondary">
                  Desktop first momentum
                </p>
                <h2 className="mt-2 font-primary text-3xl leading-tight text-zinc-50 sm:text-4xl">
                  Keep dadei close on your desktop.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-200/90 font-secondary">
                  If you are serious about not dropping tasks, start with desktop. It keeps dadei one click
                  away so capturing and acting on reminders stays fast all day.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {['macOS', 'Windows', 'Linux'].map((os) => (
                  <div
                    key={os}
                    className="min-w-[120px] rounded-2xl border border-white/15 bg-zinc-950/65 px-4 py-4 text-center"
                  >
                    {os === 'macOS' ? (
                      <Inbox className="mx-auto mb-2 h-6 w-6 text-zinc-100" aria-hidden />
                    ) : os === 'Windows' ? (
                      <Monitor className="mx-auto mb-2 h-6 w-6 text-zinc-100" aria-hidden />
                    ) : (
                      <Terminal className="mx-auto mb-2 h-6 w-6 text-zinc-100" aria-hidden />
                    )}
                    <p className="text-sm text-zinc-100 font-secondary">{os}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-zinc-950/70 py-10">
        <div className="mx-auto flex w-full max-w-[1240px] flex-col items-center justify-between gap-5 px-5 sm:flex-row sm:px-8">
          <div className="flex items-center gap-4 text-zinc-400">
            <Mic className="h-5 w-5 text-emerald-300" aria-hidden />
            <span className="font-semibold text-zinc-100 text-xl font-brand">dadei</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-zinc-300 font-secondary">
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
