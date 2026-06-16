import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Loader2, Sparkles } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import { SiApple } from 'react-icons/si';
import { Loading } from '@dadei/ui/components/Loading';
import { useAuth } from '@dadei/ui/contexts/AuthContext';
import { useSystem } from '@dadei/ui/contexts/SystemContext';
import { ASSISTANT_PATH } from '@dadei/ui/lib/platform/runtime/assistantPaths';
import {
  triggerProviderOAuth,
  type OAuthProvider,
} from '@dadei/ui/lib/platform/auth/providerAuth';
import { cn } from '@dadei/ui/lib/platform/shared/cn';
import { getUserErrorMessage } from '@dadei/ui/lib/platform/errors/userMessage';

const veilEase = [0.22, 1, 0.36, 1] as const;

const glassInput =
  'w-full rounded-xl border border-white/10 bg-zinc-900/55 px-3.5 py-2.5 font-primary text-sm text-zinc-100 shadow-inner shadow-black/30 placeholder:text-zinc-500 backdrop-blur-md transition-[border-color,background-color,box-shadow,opacity] duration-200 focus:border-emerald-500/45 focus:bg-zinc-900/75 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40';

type ProviderDef = { id: OAuthProvider; label: string; node: React.ReactNode };

function MicrosoftMark() {
  return (
    <span className="grid h-5 w-5 shrink-0 grid-cols-2 grid-rows-2 gap-[2px]" aria-hidden>
      <span className="bg-[#f25022]" />
      <span className="bg-[#7fba00]" />
      <span className="bg-[#00a4ef]" />
      <span className="bg-[#ffb900]" />
    </span>
  );
}

const OAUTH_PROVIDERS: ProviderDef[] = [
  { id: 'google', label: 'Continue with Google', node: <FcGoogle className="h-5 w-5 shrink-0" aria-hidden /> },
  { id: 'microsoft', label: 'Continue with Microsoft', node: <MicrosoftMark /> },
  { id: 'apple', label: 'Continue with Apple', node: <SiApple className="h-5 w-5 shrink-0 text-zinc-100" aria-hidden /> },
];

function isSafeInternalPath(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) return false;
  if (path.startsWith('/login')) return false;
  return true;
}

export default function LoginPage() {
  const { isAuthenticated, isLoading, login, register, saveTokens } = useAuth();
  const { isElectron, viewportFillClass } = useSystem();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const nextPath = useMemo(() => {
    const raw = searchParams.get('next');
    if (raw && isSafeInternalPath(raw)) return raw;
    return ASSISTANT_PATH;
  }, [searchParams]);

  const [showProviders, setShowProviders] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<OAuthProvider | null>(null);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const authBlockRef = useRef<HTMLDivElement>(null);
  const [authBlockHeightPx, setAuthBlockHeightPx] = useState<number | null>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate(nextPath, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, nextPath]);

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
  }, [isLoginMode, error, loading, showProviders]);

  const onAuthenticated = () => navigate(nextPath, { replace: true });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLoginMode) {
        await login({ email, password });
        onAuthenticated();
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
      onAuthenticated();
    } catch (err: unknown) {
      setError(
        getUserErrorMessage(err, isLoginMode ? 'Sign in failed. Try again.' : 'Registration failed. Try again.'),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleProviderLogin = async (provider: OAuthProvider) => {
    setError('');
    setPendingProvider(provider);
    if (isElectron && provider === 'google') {
      setLoading(true);
    }
    try {
      await triggerProviderOAuth(provider, {
        saveTokens,
        onSuccess: onAuthenticated,
        onError: (msg) => setError(msg),
        webNextPath: nextPath,
      });
    } finally {
      setPendingProvider(null);
      if (isElectron && provider === 'google') {
        setLoading(false);
      }
    }
  };

  if (isLoading || isAuthenticated) {
    return (
      <Loading
        visible
        subtitleOverride={isAuthenticated ? 'Signing in…' : 'Checking your session…'}
      />
    );
  }

  return (
    <div className={cn('relative flex flex-col overflow-x-hidden', viewportFillClass)}>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 py-6">
        <div className="absolute inset-0 bg-zinc-950" aria-hidden />
        <div className="atmosphere-grain absolute inset-0 assistant-shell-atmosphere opacity-95" aria-hidden />
        <div className="absolute -left-24 top-1/3 h-64 w-64 rounded-full bg-emerald-600/12 blur-[72px]" aria-hidden />
        <div className="absolute -right-20 bottom-1/4 h-72 w-72 rounded-full bg-teal-600/10 blur-[80px]" aria-hidden />

        <div className="relative z-10 mx-auto flex w-full max-w-lg flex-col items-center justify-center">
          <motion.div
            initial={{ y: 18, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            transition={{
              duration: prefersReducedMotion ? 0.16 : 0.36,
              ease: veilEase,
              delay: prefersReducedMotion ? 0 : 0.05,
            }}
            className="relative w-full max-w-[420px] rounded-2xl border border-white/10 bg-zinc-900/55 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-emerald-500/15 backdrop-blur-2xl sm:p-8"
          >
            <div
              className="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-b from-emerald-500/10 via-transparent to-zinc-950/40 opacity-90"
              aria-hidden
            />

            <div className="relative mb-6 text-center sm:mb-8">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 font-primary">Welcome to dadei</h1>
              <p className="mt-2 text-sm text-zinc-500 font-secondary">
                Sign in to your intelligent voice workspace
              </p>
              <p className="mx-auto mt-3 max-w-[340px] font-secondary text-xs leading-relaxed text-zinc-500/85">
                One dadei account, all your services. Sign in with any provider — matching emails link
                automatically. In Settings you can connect other accounts too, even when the email differs.
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
                  {!showProviders ? (
                    <>
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
                          className="mt-2 w-full rounded-xl border border-emerald-500/40 bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition-[background-color,filter] hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
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

                      <p className="mt-5 text-center text-sm text-zinc-500 font-secondary">
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

                      <button
                        type="button"
                        onClick={() => setShowProviders(true)}
                        className="mt-5 w-full text-center font-secondary text-xs text-zinc-500 transition-colors hover:text-emerald-400/90"
                      >
                        Continue with a provider
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2.5">
                        {OAUTH_PROVIDERS.map(p => {
                          const comingSoon = p.id === 'apple';
                          const isPending = pendingProvider === p.id;

                          if (comingSoon) {
                            return (
                              <div key={p.id} className="relative overflow-hidden rounded-xl">
                                <button
                                  type="button"
                                  disabled
                                  aria-label={`${p.label}, coming soon`}
                                  className="relative flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-xl border border-zinc-500/20 bg-zinc-900/40 px-4 py-3 font-primary text-sm font-medium text-zinc-400 shadow-sm backdrop-blur-md"
                                >
                                  {p.node}
                                  <span>{p.label}</span>
                                </button>
                                <div
                                  className="pointer-events-none absolute inset-x-0 top-0 flex justify-center"
                                  aria-hidden
                                >
                                  <div className="flex items-center gap-1.5 rounded-b-xl border border-t-0 border-zinc-400/25 bg-gradient-to-r from-zinc-700/90 via-zinc-500/80 to-zinc-700/90 px-3.5 py-1 shadow-[0_6px_18px_rgba(0,0,0,0.35)]">
                                    <Sparkles className="h-3 w-3 text-zinc-100" />
                                    <span className="font-secondary text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-50">
                                      Coming soon
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <button
                              key={p.id}
                              type="button"
                              disabled={loading || pendingProvider !== null}
                              onClick={() => void handleProviderLogin(p.id)}
                              className="relative flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-zinc-900/50 px-4 py-3 font-primary text-sm font-medium text-zinc-100 shadow-sm backdrop-blur-md transition-[background-color,border-color,box-shadow] hover:border-white/20 hover:bg-zinc-800/60 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isPending ? <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden /> : p.node}
                              <span>{isPending ? 'Connecting…' : p.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowProviders(false)}
                        className="mt-5 w-full text-center font-secondary text-xs text-zinc-500 transition-colors hover:text-emerald-400/90"
                      >
                        Use email and password instead
                      </button>
                    </>
                  )}

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
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
