import type { ComponentType } from 'react';
import {
  SiGmail,
  SiGooglecalendar,
  SiGoogledocs,
  SiGoogledrive,
  SiGooglesheets,
  SiGoogletasks,
} from 'react-icons/si';
import { FcContacts } from 'react-icons/fc';

export type IntegrationLogoProps = { className?: string; 'aria-hidden'?: boolean };

export type LogoDef = {
  Logo: ComponentType<IntegrationLogoProps>;
  /** Tailwind text-* class for Simple Icons (currentColor). Fc icons ignore this. */
  colorClass?: string;
};

export const GOOGLE_LOGOS: Record<string, LogoDef> = {
  gmail: { Logo: SiGmail, colorClass: 'text-[#EA4335]' },
  calendar: { Logo: SiGooglecalendar, colorClass: 'text-[#4285F4]' },
  contacts: { Logo: FcContacts },
  tasks: { Logo: SiGoogletasks, colorClass: 'text-[#4285F4]' },
  docs: { Logo: SiGoogledocs, colorClass: 'text-[#4285F4]' },
  drive: { Logo: SiGoogledrive, colorClass: 'text-[#4285F4]' },
  sheets: { Logo: SiGooglesheets, colorClass: 'text-[#34A853]' },
};

export function IntegrationLogo({
  def,
  active,
}: {
  def: LogoDef;
  active: boolean;
}) {
  const { Logo, colorClass } = def;

  return (
    <div
      className={
        active
          ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06]'
          : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-zinc-950/80'
      }
    >
      <Logo
        className={
          active
            ? `h-5 w-5 ${colorClass ?? 'text-zinc-200'}`
            : `h-5 w-5 ${colorClass ? `${colorClass} opacity-45` : 'text-zinc-500'}`
        }
        aria-hidden
      />
    </div>
  );
}
