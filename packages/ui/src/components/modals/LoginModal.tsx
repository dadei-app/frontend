import { useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import { useAuth } from '@dadei/ui/contexts/AuthContext';
import { ASSISTANT_PATH } from '@dadei/ui/lib/assistantPaths';
import { DesktopTitleBarStrip } from '@dadei/ui/components/DesktopWindowChrome';
import { isElectronDesktop } from '@dadei/ui/lib/electronWindowChrome';
import { triggerGoogleOAuth } from '@dadei/ui/lib/googleAuth';

const veilEase = [0.22, 1, 0.36, 1] as const;

const glassInput =
  'w-full rounded-xl border border-white/10 bg-zinc-900/55 px-3.5 py-2.5 font-primary text-sm text-zinc-100 shadow-inner shadow-black/30 placeholder:text-zinc-500 backdrop-blur-md transition-[border-color,background-color,box-shadow,opacity] duration-200 focus:border-emerald-500/45 focus:bg-zinc-900/75 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40';

type LoginOverlayProps = {
  onAuthenticated?: () => void;
  webOAuthNextPath?: string;
};

/** Full-viewport login screen: gradient backdrop and glass auth card. */
export default function LoginOverlay({
  onAuthenticated,
  webOAuthNextPath = ASSISTANT_PATH,
}: LoginOverlayProps) {
  const { login, register, saveTokens } = useAuth();
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const authBlockRef = useRef<HTMLDivElement>(null);
  const [authBlockHeightPx, setAuthBlockHeightPx] = useState<number | null>(null);
  const prefersReducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const el = authBlockRef.current;
    if (!el) return;

    const measure = () => {
      setAuthBlockHeightPx(el.scrollHeight);
    };

    measure();
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(measure);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isLoginMode, error, loading]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLoginMode) {
        await login({ email, password });
        onAuthenticated?.();
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }

      await register({ email, password });
      onAuthenticated?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : isLoginMode ? 'Sign in failed' : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    const isElectron = Boolean(window.electronAPI);
    if (isElectron) {
      setLoading(true);
    }
    try {
      await triggerGoogleOAuth({
        saveTokens,
        onSuccess: onAuthenticated,
        onError: (msg) => setError(msg),
        webNextPath: webOAuthNextPath,
      });
    } finally {
      if (isElectron) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden">
      {isElectronDesktop() ? <DesktopTitleBarStrip /> : null}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 py-6">
        <div className="absolute inset-0 bg-zinc-950" aria-hidden />
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background:
              'radial-gradient(ellipse 100% 70% at 50% 0%, rgba(16,185,129,0.18), transparent 55%), radial-gradient(circle at 100% 30%, rgba(6,182,212,0.1), transparent 50%)',
          }}
          aria-hidden
        />
        <div className="absolute -left-24 top-1/3 h-64 w-64 rounded-full bg-emerald-600/15 blur-[90px]" aria-hidden />
        <div className="absolute -right-20 bottom-1/4 h-72 w-72 rounded-full bg-teal-600/12 blur-[100px]" aria-hidden />
        <div className="absolute inset-0 backdrop-blur-[28px] backdrop-saturate-150" aria-hidden />

        <div className="relative z-10 mx-auto flex w-full max-w-lg flex-col items-center justify-center">
          <motion.div
          initial={{ y: 18, scale: 0.98, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          transition={{
            duration: prefersReducedMotion ? 0.16 : 0.36,
            ease: veilEase,
            delay: prefersReducedMotion ? 0 : 0.05,
          }}
          className="relative w-full max-w-[420px] rounded-2xl border border-white/10 bg-zinc-900/55 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-emerald-500/15 backdrop-blur-2xl"
        >
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-b from-emerald-500/10 via-transparent to-zinc-950/40 opacity-90"
            aria-hidden
          />

          <div className="relative mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 font-primary">Welcome to dadei</h1>
            <p className="mt-2 text-sm text-zinc-500 font-secondary">
              Sign in to your intelligent voice workspace
            </p>
          </div>

          <div className="relative">
            <div
              className="overflow-hidden"
              style={{
                height: authBlockHeightPx === null ? undefined : authBlockHeightPx,
                transitionProperty:
                  prefersReducedMotion || authBlockHeightPx === null ? 'none' : 'height',
                transitionDuration: prefersReducedMotion ? '0.01ms' : '0.42s',
                transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              <div ref={authBlockRef}>
                <motion.form
                  key={isLoginMode ? 'login' : 'register'}
                  initial={{ opacity: 0, y: 10, filter: prefersReducedMotion ? 'none' : 'blur(6px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                  onSubmit={handleSubmit}
                  className="space-y-4"
                >
                  <div>
                    <label
                      htmlFor="auth-email"
                      className="mb-1.5 block text-xs font-medium text-zinc-400 font-secondary"
                    >
                      Email
                    </label>
                    <input
                      id="auth-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                      className={glassInput}
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="auth-password"
                      className="mb-1.5 block text-xs font-medium text-zinc-400 font-secondary"
                    >
                      Password
                    </label>
                    <input
                      id="auth-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className={glassInput}
                      placeholder={isLoginMode ? '••••••••' : 'At least 6 characters'}
                      autoComplete={isLoginMode ? 'current-password' : 'new-password'}
                    />
                  </div>

                  <AnimatePresence initial={false}>
                    {!isLoginMode ? (
                      <motion.div
                        key="confirm"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <label
                          htmlFor="auth-confirm"
                          className="mb-1.5 block text-xs font-medium text-zinc-400 font-secondary"
                        >
                          Confirm password
                        </label>
                        <input
                          id="auth-confirm"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required={!isLoginMode}
                          disabled={loading}
                          className={glassInput}
                          placeholder="Repeat password"
                          autoComplete="new-password"
                        />
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-6 w-full rounded-xl border border-emerald-500/35 bg-linear-to-r from-emerald-600 to-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] drop-shadow-[0_8px_22px_rgba(5,150,105,0.45)] transition-[filter,opacity] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        {isLoginMode ? 'Signing in…' : 'Creating account…'}
                      </span>
                    ) : isLoginMode ? (
                      'Sign in'
                    ) : (
                      'Create account'
                    )}
                  </button>
                </motion.form>

                <AnimatePresence initial={false}>
                  {error ? (
                    <motion.div
                      key="auth-error"
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-start gap-2 rounded-xl border border-rose-500/35 bg-rose-950/50 px-3 py-2.5 text-sm text-rose-100 backdrop-blur-md">
                        <i className="fas fa-exclamation-circle mt-0.5 shrink-0 text-rose-400" aria-hidden />
                        <span>{error}</span>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>

            <p className="mt-6 text-center text-sm text-zinc-500 font-secondary">
              {isLoginMode ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setIsLoginMode(!isLoginMode);
                  setError('');
                }}
                disabled={loading}
                className="font-primary font-semibold text-emerald-400/95 transition-colors hover:text-emerald-300 disabled:opacity-50"
              >
                {isLoginMode ? 'Create one' : 'Sign In'}
              </button>
            </p>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center" aria-hidden>
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="rounded-full border border-white/10 bg-zinc-950/60 px-3 py-1 font-medium text-zinc-500 shadow-sm backdrop-blur-md font-secondary">
                  Or continue with
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="relative pt-1">
                <span
                  className="pointer-events-none absolute right-2 top-[-4px] z-10 rounded-lg border border-sky-400/40 bg-sky-500/30 px-3 py-1 text-xs font-medium leading-none tracking-wide text-sky-50 shadow-md ring-1 ring-sky-300/25 font-secondary"
                  aria-hidden
                >
                  best option
                </span>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="relative flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-zinc-900/50 px-4 py-2.5 text-sm font-medium text-zinc-200 shadow-sm backdrop-blur-md transition-[background-color,border-color,box-shadow] hover:border-white/15 hover:bg-zinc-800/60 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FcGoogle className="h-5 w-5 shrink-0" aria-hidden />
                  {loading ? 'Connecting…' : 'Google'}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
      </div>
    </div>
  );
}
