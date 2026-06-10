import type { ComponentType } from 'react';
import { Calendar } from 'lucide-react';
import {
  SiGmail,
  SiGoogle,
  SiGoogledocs,
  SiGoogledrive,
  SiGooglesheets,
  SiGoogletasks,
} from 'react-icons/si';
import { cn } from '@dadei/ui/lib/shared/cn';

/** Google Calendar product mark is too busy at 14px; Lucide reads clearly and tints via currentColor. */
function CalendarLogo({ className, 'aria-hidden': ariaHidden }: IntegrationLogoProps) {
  return <Calendar className={className} strokeWidth={2} aria-hidden={ariaHidden} />;
}

export type IntegrationLogoProps = { className?: string; 'aria-hidden'?: boolean };

export type LogoDef = {
  Logo: ComponentType<IntegrationLogoProps>;
};

export function integrationIconTileClass(active: boolean): string {
  return cn(
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
    active
      ? 'border-emerald-500/25 bg-emerald-500/10 shadow-[inset_0_0_18px_rgba(16,185,129,0.08)]'
      : 'border-white/10 bg-zinc-950/80',
  );
}

export const GOOGLE_LOGOS: Record<string, LogoDef> = {
  gmail: { Logo: SiGmail },
  calendar: { Logo: CalendarLogo },
  contacts: { Logo: SiGoogle },
  tasks: { Logo: SiGoogletasks },
  docs: { Logo: SiGoogledocs },
  drive: { Logo: SiGoogledrive },
  sheets: { Logo: SiGooglesheets },
};

export function IntegrationLogo({
  def,
  active,
  iconClassName,
}: {
  def: LogoDef;
  active: boolean;
  /** Override icon color (Simple Icons use currentColor). */
  iconClassName?: string;
}) {
  const { Logo } = def;

  return (
    <div className={integrationIconTileClass(active)}>
      <Logo
        className={
          iconClassName ??
          cn('h-3.5 w-3.5', active ? 'text-emerald-300/90' : 'text-zinc-500')
        }
        aria-hidden
      />
    </div>
  );
}
