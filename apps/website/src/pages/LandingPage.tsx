import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDown,
  Brain,
  CalendarDays,
  Check,
  Globe,
  Inbox,
  Mail,
  Mic,
  Monitor,
  PhoneCall,
  Terminal,
  WandSparkles,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import FloatingAppMockup from '@/components/FloatingAppMockup';

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

function LaunchConversationIntro() {
  const [isScrollHovered, setIsScrollHovered] = useState(false);
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
      text: 'i\'m too lazy to even update my reminders.',
      appearAt: 4.0,
      readFor: 1.9,
    },
    { side: 'right', text: 'you guys should try dadei', appearAt: 5.9, readFor: 1.5 },
  ] as const;
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

function PluginShowcase() {
  const plugins = [
    {
      icon: Globe,
      name: 'google workspace',
      short: 'calendar + gmail + contacts sync',
      command: 'dadei, pull last conversation context with andrew and prep follow-up.',
      output: ['contact context loaded', 'last thread summarized', 'next-step draft prepared'],
    },
    {
      icon: CalendarDays,
      name: 'google calendar',
      short: 'events + availability + reminders',
      command: 'dadei, schedule 30 min with john tomorrow afternoon and remind me 20 min before.',
      output: ['best slot selected', 'calendar event created', 'reminder queued'],
    },
    {
      icon: Mail,
      name: 'gmail',
      short: 'drafts + triage + follow-through',
      command: 'dadei, draft a short check-in email about next steps from today.',
      output: ['tone matched to prior thread', 'draft generated', 'ready to review/send'],
    },
    {
      icon: PhoneCall,
      name: 'voice assistant mode',
      short: 'hands-free trigger layer',
      command: 'dadei, log this and remind me to follow up tomorrow morning.',
      output: ['moment captured', 'follow-up reminder created', 'task timeline updated'],
    },
  ];
  const [activePlugin, setActivePlugin] = useState(0);
  const selected = plugins[activePlugin];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ duration: 0.5 }}
      className="relative mt-10 overflow-hidden rounded-4xl border border-emerald-300/20 bg-zinc-950/82 p-5 sm:p-8"
    >
      <p className="max-w-2xl text-sm leading-relaxed text-zinc-300 font-secondary">
        each plugin gives dadei a new superpower. pick one, issue a natural command, and watch follow-through
        happen.
      </p>

      <div className="relative mt-7 grid gap-4 lg:grid-cols-[0.9fr_1.2fr_1fr]">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/65 p-3">
          <p className="mb-2 text-[11px] tracking-[0.18em] text-zinc-400 font-secondary">plugin dock</p>
          <div className="space-y-2">
            {plugins.map((plugin, i) => (
              <button
                key={plugin.name}
                type="button"
                onClick={() => setActivePlugin(i)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                  i === activePlugin
                    ? 'border-emerald-200/55 bg-emerald-400/26'
                    : 'border-white/10 bg-zinc-900/75 hover:border-emerald-200/30 hover:bg-zinc-800/75'
                }`}
              >
                <span className="inline-flex items-center gap-2 text-xs text-zinc-100 font-secondary">
                  <plugin.icon className="h-3.5 w-3.5" aria-hidden />
                  {plugin.name}
                </span>
                <p className="mt-1 text-[11px] text-zinc-300/90 font-secondary">{plugin.short}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200/25 bg-zinc-900/60 p-4">
          <p className="text-[11px] tracking-[0.18em] text-zinc-400 font-secondary">live command surface</p>
          <div className="mt-3 rounded-xl border border-white/10 bg-zinc-950/75 p-3">
            <p className="text-[11px] text-zinc-500 font-secondary">active plugin</p>
            <p className="mt-1 inline-flex items-center gap-2 text-sm text-zinc-100 font-secondary">
              <selected.icon className="h-4 w-4" aria-hidden />
              {selected.name}
            </p>
            <p className="mt-3 rounded-lg border border-white/10 bg-zinc-900/70 px-3 py-2 text-sm leading-relaxed text-zinc-200 font-secondary">
              "{selected.command}"
            </p>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-emerald-200/90 font-secondary">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
            </span>
            running plugin workflow
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/65 p-3">
          <p className="mb-2 text-[11px] tracking-[0.18em] text-zinc-400 font-secondary">automation queue</p>
          <div className="space-y-2">
            {selected.output.map((item, i) => (
              <motion.div
                key={item}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.28, delay: i * 0.08 }}
                className="rounded-lg border border-emerald-200/30 bg-emerald-400/18 px-3 py-2 text-xs text-zinc-100 font-secondary"
              >
                <span className="inline-flex items-center gap-2">
                  <Check className="h-3 w-3" aria-hidden />
                  {item}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
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
          <PluginShowcase />
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
