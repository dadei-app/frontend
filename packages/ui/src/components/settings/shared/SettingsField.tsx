import type { ReactNode } from 'react';

export function SettingsField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative space-y-3">
      <div>
        <p className="text-base font-medium text-zinc-100">{label}</p>
        {hint ? <p className="mt-1 text-sm text-zinc-500 font-secondary">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}
