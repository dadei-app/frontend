import { useId, type SVGProps } from 'react';
import { cn } from '@dadei/ui/lib/platform/shared/cn';

export type DadeiMarkProps = SVGProps<SVGSVGElement> & {
  size?: number | string;
};

export function DadeiMark({ className, size = 100, ...props }: DadeiMarkProps) {
  const gradientId = `em-${useId().replace(/:/g, '')}`;

  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      aria-hidden
      {...props}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="20"
          y1="14"
          x2="80"
          y2="88"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#5cf0b0" />
          <stop offset="0.55" stopColor="#00cc6a" />
          <stop offset="1" stopColor="#00a85a" />
        </linearGradient>
      </defs>
      <path
        d="M34.5 78.85 A31 31 0 1 1 65.5 78.85"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="3.4"
        strokeLinecap="round"
        opacity="0.42"
      />
      <path
        d="M40 69.32 A20 20 0 1 1 60 69.32"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="3.9"
        strokeLinecap="round"
        opacity="0.82"
      />
      <circle cx="50" cy="52" r="8" fill={`url(#${gradientId})`} />
    </svg>
  );
}
