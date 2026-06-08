
import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings2, LogOut, Users, Mic } from 'lucide-react';
import { useAuth } from '@dadei/ui/contexts/AuthContext';
import PersonsPanel from '@dadei/ui/components/PersonsPanel';
import { cn } from '@dadei/ui/lib/shared/cn';

interface HeaderProps {
  isPeoplePanelOpen: boolean;
  setIsPeoplePanelOpen: (open: boolean) => void;
  onOpenSettings: () => void;
}

export default function Header({
  isPeoplePanelOpen,
  setIsPeoplePanelOpen,
  onOpenSettings,
}: HeaderProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const peopleButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <header
      className="relative z-20 flex shrink-0 items-center justify-between border-b border-white/8 bg-zinc-950/55 px-6 py-4 backdrop-blur-md"
      style={{ minHeight: 'var(--assistant-header-h, 4.75rem)' }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-4 text-lg font-semibold tracking-tight text-emerald-400/95">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900/70 ring-1 ring-white/10">
          <Mic className="h-5 w-5 text-emerald-300" strokeWidth={2} aria-hidden="true" />
        </span>
        <span className="hidden select-none font-brand text-3xl font-extrabold tracking-widest sm:inline">
          dadei
        </span>
      </div>

      <div className="flex items-center gap-4 sm:gap-6">
        <button
          ref={peopleButtonRef}
          type="button"
          onClick={() => setIsPeoplePanelOpen(!isPeoplePanelOpen)}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg border transition-colors duration-200',
            isPeoplePanelOpen
              ? 'border-emerald-500/45 bg-emerald-500/15 text-emerald-300'
              : 'border-white/10 bg-zinc-900/60 text-zinc-400 hover:border-emerald-500/30 hover:bg-zinc-800/80 hover:text-emerald-300/90'
          )}
          title="Persons"
        >
          <Users className="h-4 w-4" strokeWidth={2} />
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-zinc-900/60 text-zinc-400 transition-colors hover:border-emerald-500/30 hover:text-emerald-300/90"
          title="Settings"
        >
          <Settings2 className="h-4 w-4" strokeWidth={2} />
        </button>

        <button
          type="button"
          data-tutorial-allow-logout
          onClick={async () => {
            await logout();
            navigate('/login', { replace: true });
          }}
          className="flex h-9 px-3 items-center justify-center rounded-lg border border-white/10 bg-zinc-900/60 text-rose-400/90 transition-colors hover:border-rose-500/35 hover:bg-rose-950/40 hover:text-rose-300 text-sm font-display"
          title="Logout"
        >
          Logout
          <LogOut className="ml-2 h-4 w-4" strokeWidth={2} />
        </button>

        <PersonsPanel
          isOpen={isPeoplePanelOpen}
          onClose={() => setIsPeoplePanelOpen(false)}
          excludeElement={peopleButtonRef.current}
        />
      </div>
    </header>
  );
}
