import type { ComponentType } from 'react';
import { Calendar } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import {
  SiApple,
  SiGmail,
  SiGoogle,
  SiGoogledocs,
  SiGoogledrive,
  SiGooglesheets,
  SiGoogletasks,
} from 'react-icons/si';
import { cn } from '@dadei/ui/lib/platform/shared/cn';

/** Google Calendar product mark is too busy at 14px; Lucide reads clearly and tints via currentColor. */
function CalendarLogo({ className, 'aria-hidden': ariaHidden }: IntegrationLogoProps) {
  return <Calendar className={className} strokeWidth={2} aria-hidden={ariaHidden} />;
}

function createSimpleIcon(path: string, hex: string): ComponentType<IntegrationLogoProps> {
  return function SimpleIcon({ className, 'aria-hidden': ariaHidden }: IntegrationLogoProps) {
    return (
      <svg viewBox="0 0 24 24" className={cn('h-4 w-4 shrink-0', className)} aria-hidden={ariaHidden}>
        <path fill={`#${hex}`} d={path} />
      </svg>
    );
  };
}

const OutlookLogo = createSimpleIcon(
  'M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.58.52-.37.2-.87.2t-.85-.2q-.35-.21-.57-.55-.22-.33-.33-.75-.1-.42-.1-.86t.1-.87q.1-.43.34-.76.22-.34.59-.54.36-.2.87-.2t.86.2q.35.21.57.55.22.34.31.77.1.43.1.88zM24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h6.5V2.55q0-.44.3-.75.3-.3.75-.3h12.9q.44 0 .75.3.3.3.3.75V10.85l1.24.72h.01q.1.07.18.18.07.12.07.25zm-6-8.25v3h3v-3zm0 4.5v3h3v-3zm0 4.5v1.83l3.05-1.83zm-5.25-9v3h3.75v-3zm0 4.5v3h3.75v-3zm0 4.5v2.03l2.41 1.5 1.34-.8v-2.73zM9 3.75V6h2l.13.01.12.04v-2.3zM5.98 15.98q.9 0 1.6-.3.7-.32 1.19-.86.48-.55.73-1.28.25-.74.25-1.61 0-.83-.25-1.55-.24-.71-.71-1.24t-1.15-.83q-.68-.3-1.55-.3-.92 0-1.64.3-.71.3-1.2.85-.5.54-.75 1.3-.25.74-.25 1.63 0 .85.26 1.56.26.72.74 1.23.48.52 1.17.81.69.3 1.56.3zM7.5 21h12.39L12 16.08V17q0 .41-.3.7-.29.3-.7.3H7.5zm15-.13v-7.24l-5.9 3.54Z',
  '0078D4',
);

const OneDriveLogo = createSimpleIcon(
  'M19.453 9.95q.961.058 1.787.468.826.41 1.442 1.066.615.657.966 1.512.352.856.352 1.816 0 1.008-.387 1.893-.386.885-1.049 1.547-.662.662-1.546 1.049-.885.387-1.893.387H6q-1.242 0-2.332-.475-1.09-.475-1.904-1.29-.815-.814-1.29-1.903Q0 14.93 0 13.688q0-.985.31-1.887.311-.903.862-1.658.55-.756 1.324-1.325.774-.568 1.711-.861.434-.129.85-.187.416-.06.861-.082h.012q.515-.786 1.207-1.413.691-.627 1.5-1.066.808-.44 1.705-.668.896-.229 1.845-.229 1.278 0 2.456.417 1.177.416 2.144 1.16.967.744 1.658 1.78.692 1.038 1.008 2.28zm-7.265-4.137q-1.325 0-2.52.544-1.195.545-2.04 1.565.446.117.85.299.405.181.792.416l4.78 2.86 2.731-1.15q.27-.117.545-.204.276-.088.58-.147-.293-.937-.855-1.705-.563-.768-1.319-1.318-.755-.551-1.658-.856-.902-.304-1.886-.304zM2.414 16.395l9.914-4.184-3.832-2.297q-.586-.351-1.23-.539-.645-.188-1.325-.188-.914 0-1.722.364-.809.363-1.412.978-.604.616-.955 1.436-.352.82-.352 1.723 0 .703.234 1.423.235.721.68 1.284zm16.711 1.793q.563 0 1.078-.176.516-.176.961-.516l-7.23-4.324-10.301 4.336q.527.328 1.13.504.604.175 1.237.175zm3.012-1.852q.363-.727.363-1.523 0-.774-.293-1.407t-.791-1.072q-.498-.44-1.166-.68-.668-.24-1.406-.24-.422 0-.838.1t-.815.252q-.398.152-.785.334-.386.181-.761.345Z',
  '0078D4',
);

const ExcelLogo = createSimpleIcon(
  'M23 1.5q.41 0 .7.3.3.29.3.7v19q0 .41-.3.7-.29.3-.7.3H7q-.41 0-.7-.3-.3-.29-.3-.7V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h5V2.5q0-.41.3-.7.29-.3.7-.3zM6 13.28l1.42 2.66h2.14l-2.38-3.87 2.34-3.8H7.46l-1.3 2.4-.05.08-.04.09-.64-1.28-.66-1.29H2.59l2.27 3.82-2.48 3.85h2.16zM14.25 21v-3H7.5v3zm0-4.5v-3.75H12v3.75zm0-5.25V7.5H12v3.75zm0-5.25V3H7.5v3zm8.25 15v-3h-6.75v3zm0-4.5v-3.75h-6.75v3.75zm0-5.25V7.5h-6.75v3.75zm0-5.25V3h-6.75v3Z',
  '217346',
);

const MicrosoftContactsLogo = createSimpleIcon(
  'M20.625 8.127q-.55 0-1.025-.205-.475-.205-.832-.563-.358-.357-.563-.832Q18 6.053 18 5.502q0-.54.205-1.02t.563-.837q.357-.358.832-.563.474-.205 1.025-.205.54 0 1.02.205t.837.563q.358.357.563.837.205.48.205 1.02 0 .55-.205 1.025-.205.475-.563.832-.357.358-.837.563-.48.205-1.02.205zm0-3.75q-.469 0-.797.328-.328.328-.328.797 0 .469.328.797.328.328.797.328.469 0 .797-.328.328-.328.328-.797 0-.469-.328-.797-.328-.328-.797-.328zM24 10.002v5.578q0 .774-.293 1.46-.293.685-.803 1.194-.51.51-1.195.803-.686.293-1.459.293-.445 0-.908-.105-.463-.106-.85-.329-.293.95-.855 1.729-.563.78-1.319 1.336-.756.557-1.67.861-.914.305-1.898.305-1.148 0-2.162-.398-1.014-.399-1.805-1.102-.79-.703-1.312-1.664t-.674-2.086h-5.8q-.411 0-.704-.293T0 16.881V6.873q0-.41.293-.703t.703-.293h8.59q-.34-.715-.34-1.5 0-.727.275-1.365.276-.639.75-1.114.475-.474 1.114-.75.638-.275 1.365-.275t1.365.275q.639.276 1.114.75.474.475.75 1.114.275.638.275 1.365t-.275 1.365q-.276.639-.75 1.113-.475.475-1.114.75-.638.276-1.365.276-.188 0-.375-.024-.188-.023-.375-.058v1.078h10.875q.469 0 .797.328.328.328.328.797zM12.75 2.373q-.41 0-.78.158-.368.158-.638.434-.27.275-.428.639-.158.363-.158.773 0 .41.158.78.159.368.428.638.27.27.639.428.369.158.779.158.41 0 .773-.158.364-.159.64-.428.274-.27.433-.639.158-.369.158-.779 0-.41-.158-.773-.159-.364-.434-.64-.275-.275-.639-.433-.363-.158-.773-.158zM6.937 9.814h2.25V7.94H2.814v1.875h2.25v6h1.875zm10.313 7.313v-6.75H12v6.504q0 .41-.293.703t-.703.293H8.309q.152.809.556 1.5.405.691.985 1.19.58.497 1.318.779.738.281 1.582.281.926 0 1.746-.352.82-.351 1.436-.966.615-.616.966-1.43.352-.815.352-1.752zm5.25-1.547v-5.203h-3.75v6.855q.305.305.691.452.387.146.809.146.469 0 .879-.176.41-.175.715-.48.304-.305.48-.715t.176-.879Z',
  '6264A7',
);

function MicrosoftTasksLogo({ className, 'aria-hidden': ariaHidden }: IntegrationLogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-4 w-4 shrink-0', className)} aria-hidden={ariaHidden}>
      <path
        fill="#3A96DD"
        d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.2 13.2-3.4-3.4 1.2-1.2 2.2 2.2 5.4-5.4 1.2 1.2-6.6 6.6Z"
      />
    </svg>
  );
}

function MicrosoftLogo({ className, 'aria-hidden': ariaHidden }: IntegrationLogoProps) {
  return (
    <span
      className={cn('grid h-4 w-4 shrink-0 grid-cols-2 grid-rows-2 gap-px', className)}
      aria-hidden={ariaHidden}
    >
      <span className="bg-[#f25022]" />
      <span className="bg-[#7fba00]" />
      <span className="bg-[#00a4ef]" />
      <span className="bg-[#ffb900]" />
    </span>
  );
}

export type IntegrationLogoProps = { className?: string; 'aria-hidden'?: boolean };

export type LogoDef = {
  Logo: ComponentType<IntegrationLogoProps>;
  /** When true, logo keeps its own colors (product / OAuth marks). */
  brand?: boolean;
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
  docs: { Logo: SiGoogledocs, brand: true },
  drive: { Logo: SiGoogledrive, brand: true },
  sheets: { Logo: SiGooglesheets, brand: true },
};

export const MICROSOFT_LOGOS: Record<string, LogoDef> = {
  mail: { Logo: OutlookLogo, brand: true },
  calendar: { Logo: CalendarLogo },
  contacts: { Logo: MicrosoftContactsLogo, brand: true },
  tasks: { Logo: MicrosoftTasksLogo, brand: true },
  onedrive: { Logo: OneDriveLogo, brand: true },
  excel: { Logo: ExcelLogo, brand: true },
};

export const APPLE_LOGOS: Record<string, LogoDef> = {
  calendar: { Logo: SiApple, brand: true },
  contacts: { Logo: SiApple, brand: true },
};

/** OAuth provider marks for settings + marketing surfaces. */
export const PROVIDER_LOGOS: Record<string, LogoDef> = {
  google: { Logo: FcGoogle as ComponentType<IntegrationLogoProps>, brand: true },
  microsoft: { Logo: MicrosoftLogo, brand: true },
  apple: { Logo: SiApple, brand: true },
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
  const { Logo, brand } = def;

  if (brand) {
    return <Logo className={cn('h-5 w-5', iconClassName)} aria-hidden />;
  }

  return (
    <div className={integrationIconTileClass(active)}>
      <Logo
        className={
          iconClassName ?? cn('h-3.5 w-3.5', active ? 'text-emerald-300/90' : 'text-zinc-500')
        }
        aria-hidden
      />
    </div>
  );
}

export function resolveWorkspaceToolLogo(
  toolId: string,
  provider: 'google' | 'microsoft' | 'apple',
): LogoDef | undefined {
  if (provider === 'google') {
    const key =
      toolId === 'gmail' ||
      toolId === 'calendar' ||
      toolId === 'contacts' ||
      toolId === 'tasks' ||
      toolId === 'docs' ||
      toolId === 'drive' ||
      toolId === 'sheets'
        ? toolId
        : null;
    return key ? GOOGLE_LOGOS[key] : undefined;
  }

  if (provider === 'microsoft') {
    const map: Record<string, string> = {
      mail: 'mail',
      calendar: 'calendar',
      contacts: 'contacts',
      tasks: 'tasks',
      files: 'onedrive',
      sheets: 'excel',
    };
    const key = map[toolId];
    return key ? MICROSOFT_LOGOS[key] : undefined;
  }

  if (toolId === 'calendar' || toolId === 'contacts') {
    return APPLE_LOGOS[toolId];
  }

  return undefined;
}
