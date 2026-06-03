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
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium text-zinc-100">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-zinc-500 font-secondary">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}
