import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@dadei/ui/lib/platform/shared/cn';

const buttonBase =
  'inline-flex shrink-0 items-center justify-center rounded-lg transition-[color,background-color,box-shadow] duration-150 ease-out emerald-glow disabled:cursor-not-allowed disabled:opacity-40';

const variantStyles = {
  ghost: 'text-zinc-500 hover:bg-white/5 hover:text-zinc-200',
  active: 'bg-emerald-500/15 text-emerald-300',
  destructive: 'text-zinc-500 hover:bg-rose-500/8 hover:text-rose-300',
} as const;

type ToolbarButtonVariant = keyof typeof variantStyles;

type ToolbarButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ToolbarButtonVariant;
  icon?: LucideIcon;
  iconClassName?: string;
  label?: string;
  iconOnly?: boolean;
};

export function ToolbarShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center rounded-xl border border-white/8 bg-zinc-900/40 p-1',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ToolbarDivider() {
  return <span className="mx-0.5 h-4 w-px shrink-0 bg-white/8" aria-hidden />;
}

export const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  function ToolbarButton(
    {
      variant = 'ghost',
      icon: Icon,
      iconClassName,
      label,
      iconOnly = false,
      className,
      children,
      type = 'button',
      ...props
    },
    ref,
  ) {
    const showLabel = !iconOnly && (label ?? children);

    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          buttonBase,
          variantStyles[variant],
          iconOnly || (!showLabel && Icon) ? 'h-8 w-8' : 'h-8 gap-1.5 px-2.5 text-xs font-medium',
          className,
        )}
        {...props}
      >
        {Icon ? <Icon className={cn('h-4 w-4 shrink-0', iconClassName)} strokeWidth={2} aria-hidden /> : null}
        {showLabel ? <span>{label ?? children}</span> : null}
      </button>
    );
  },
);
