import { useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { logoUrl } from '@dadei/ui/assets/brand';
import { useAuth } from '@dadei/ui/contexts/AuthContext';
import { useSystem } from '@dadei/ui/contexts/SystemContext';
import { authApi } from '@dadei/ui/lib/workspace/api/auth';
import { TERMS_VERSION } from '@dadei/ui/lib/platform/legal/constants';
import { getUserErrorMessage } from '@dadei/ui/lib/platform/errors/userMessage';
import { cn } from '@dadei/ui/lib/platform/shared/cn';

export default function ConsentGateScreen() {
  const { refreshUser } = useAuth();
  const { isElectron, viewportFillClass } = useSystem();
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptBiometric, setAcceptBiometric] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const termsHref = isElectron ? 'https://dadei.app/terms' : '/terms';
  const privacyHref = isElectron ? 'https://dadei.app/privacy' : '/privacy';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!acceptTerms || !acceptBiometric) {
      setError('You must accept the Terms of Service and biometric voice consent to continue');
      return;
    }

    setLoading(true);
    try {
      await authApi.acceptConsent({
        terms_version: TERMS_VERSION,
        accept_terms: true,
        accept_biometric: true,
      });
      await refreshUser();
    } catch (err) {
      setError(getUserErrorMessage(err, 'Could not save consent. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col items-center justify-center bg-zinc-950 px-4 py-10 text-zinc-100',
        viewportFillClass,
      )}
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900/55 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex items-center gap-3">
            <img
              src={logoUrl}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-lg"
              aria-hidden
            />
            <span className="font-brand text-2xl tracking-[0.2em] text-zinc-100">dadei</span>
          </div>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
            <ShieldCheck className="h-5 w-5 text-emerald-400" aria-hidden />
          </div>
          <h1 className="font-primary text-xl font-semibold text-zinc-50">Before you continue</h1>
          <p className="mt-2 font-secondary text-sm text-zinc-400">
            Review and accept our terms and biometric voice processing policy to use dadei.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2.5">
            <label className="flex items-start gap-2.5 text-left font-secondary text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                disabled={loading}
                className="mt-0.5 rounded border-white/20 bg-zinc-900/60 text-emerald-500 focus:ring-emerald-500/30"
              />
              <span>
                I agree to the{' '}
                <a
                  href={termsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400/95 underline decoration-emerald-500/30 hover:text-emerald-300"
                >
                  Terms of Service
                </a>{' '}
                and{' '}
                <a
                  href={privacyHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400/95 underline decoration-emerald-500/30 hover:text-emerald-300"
                >
                  Privacy Policy
                </a>
              </span>
            </label>
            <label className="flex items-start gap-2.5 text-left font-secondary text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={acceptBiometric}
                onChange={(e) => setAcceptBiometric(e.target.checked)}
                disabled={loading}
                className="mt-0.5 rounded border-white/20 bg-zinc-900/60 text-emerald-500 focus:ring-emerald-500/30"
              />
              <span>
                I consent to biometric voice processing (wake word detection and speaker recognition)
                as described in the Privacy Policy
              </span>
            </label>
          </div>

          {error ? (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/35 bg-rose-950/50 px-3 py-2.5 text-sm text-rose-100 backdrop-blur-md">
              <i className="fas fa-exclamation-circle mt-0.5 shrink-0 text-rose-400" aria-hidden />
              <span>{error}</span>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl border border-emerald-500/40 bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition-[background-color,filter] hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Saving…
              </span>
            ) : (
              'Continue'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
