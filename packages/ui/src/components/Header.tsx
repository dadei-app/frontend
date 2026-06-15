import { useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings2, LogOut, Users, Mic } from 'lucide-react';
import { useAuth } from '@dadei/ui/contexts/AuthContext';
import PersonsPanel from '@dadei/ui/components/PersonsPanel';
import Tooltip from '@dadei/ui/components/ui/Tooltip';
import { ToolbarButton, ToolbarDivider, ToolbarShell } from '@dadei/ui/components/ui/Toolbar';
import { useMobileAssistant } from '@dadei/ui/lib/platform/hooks/useMobileAssistant';

function HeaderTooltip({ label, children }: { label: string; children: ReactNode }) {
  const mobile = useMobileAssistant();
  if (mobile) return <>{children}</>;
  return <Tooltip content={label}>{children}</Tooltip>;
}

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
      className="assistant-shell-header relative z-20 flex shrink-0 items-center justify-between border-b border-white/8 bg-zinc-950 px-4 py-4 sm:px-6"
      style={{ minHeight: 'var(--assistant-header-h, 4.75rem)' }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-4 text-lg font-semibold tracking-tight text-emerald-400/95">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900/70 ring-1 ring-white/10">
          <Mic className="h-5 w-5 text-emerald-300" strokeWidth={2} aria-hidden="true" />
        </span>
        <span className="assistant-brand-wordmark select-none font-brand text-2xl font-extrabold tracking-widest sm:text-3xl">
          dadei
        </span>
      </div>

      <ToolbarShell>
        <HeaderTooltip label="Persons">
          <ToolbarButton
            ref={peopleButtonRef}
            variant={isPeoplePanelOpen ? 'active' : 'ghost'}
            icon={Users}
            iconOnly
            aria-label="People"
            onClick={() => setIsPeoplePanelOpen(!isPeoplePanelOpen)}
          />
        </HeaderTooltip>

        <HeaderTooltip label="Settings">
          <ToolbarButton
            variant="ghost"
            icon={Settings2}
            iconOnly
            aria-label="Settings"
            onClick={onOpenSettings}
          />
        </HeaderTooltip>

        <ToolbarDivider />

        <HeaderTooltip label="Sign out">
          <ToolbarButton
            data-tutorial-allow-logout
            variant="destructive"
            icon={LogOut}
            iconOnly
            aria-label="Sign out"
            onClick={async () => {
              await logout();
              navigate('/login', { replace: true });
            }}
          />
        </HeaderTooltip>
      </ToolbarShell>

      <PersonsPanel
        isOpen={isPeoplePanelOpen}
        onClose={() => setIsPeoplePanelOpen(false)}
        excludeElement={peopleButtonRef.current}
      />
    </header>
  );
}
