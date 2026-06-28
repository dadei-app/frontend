import type { SVGProps } from 'react';
import { cn } from '@dadei/ui/lib/platform/shared/cn';
import { DadeiMark } from './DadeiMark';

export type DadeiLogoProps = {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  markSize?: number | string;
  markProps?: Omit<SVGProps<SVGSVGElement>, 'width' | 'height' | 'className'>;
};

export function DadeiLogo({
  className,
  markClassName,
  textClassName,
  markSize = 44,
  markProps,
}: DadeiLogoProps) {
  return (
    <div className={cn('inline-flex items-center gap-3', className)}>
      <DadeiMark size={markSize} className={markClassName} {...markProps} />
      <span
        className={cn(
          'font-brand text-[1.65rem] leading-none tracking-[0.22em] text-zinc-100',
          textClassName,
        )}
      >
        dadei
      </span>
    </div>
  );
}
