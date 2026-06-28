import { Link } from 'react-router-dom';
import { logoUrl } from '@dadei/ui/assets/brand';

export function LegalPageShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
      <div className="pointer-events-none fixed inset-0 -z-10 atmosphere-grain">
        <div className="absolute inset-0 assistant-shell-atmosphere opacity-90" />
        <div className="absolute right-0 top-0 h-[420px] w-[420px] translate-x-1/4 rounded-full bg-emerald-600/10 blur-[96px]" />
      </div>

      <header className="border-b border-white/10 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-5 sm:px-8">
          <Link to="/" className="inline-flex items-center gap-3 transition-opacity hover:opacity-90">
            <img
              src={logoUrl}
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 rounded-lg"
              aria-hidden
            />
            <span className="font-brand text-xl tracking-[0.18em] text-zinc-100">dadei</span>
          </Link>
          <Link
            to="/"
            className="font-secondary text-sm text-zinc-400 transition-colors hover:text-emerald-300"
          >
            Home
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <h1 className="font-primary text-3xl tracking-tight text-zinc-50 sm:text-4xl">{title}</h1>
        <article className="mt-8 space-y-6 font-secondary text-sm leading-relaxed text-zinc-300 sm:text-base">
          {children}
        </article>
      </main>
    </div>
  );
}
