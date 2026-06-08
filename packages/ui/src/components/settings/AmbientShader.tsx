import { lazy, Suspense } from 'react';

const MeshGradient = lazy(() =>
  import('@paper-design/shaders-react').then(m => ({ default: m.MeshGradient })),
);

interface AmbientShaderProps {
  className?: string;
  intensity?: number;
}

function StaticFallback({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={className}
      style={{
        background:
          'radial-gradient(ellipse 60% 40% at 30% 30%, rgba(16,185,129,0.10), transparent 60%), ' +
          'radial-gradient(ellipse 50% 50% at 70% 70%, rgba(6,182,212,0.10), transparent 60%), ' +
          'black',
      }}
    />
  );
}

export function AmbientShader({ className, intensity = 0.3 }: AmbientShaderProps) {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    return <StaticFallback className={className} />;
  }

  return (
    <Suspense fallback={<StaticFallback className={className} />}>
      <MeshGradient
        className={className}
        speed={0.15}
        colors={['#000000', '#0a1f1a', '#0a1814', '#102b22', '#0d4a3a']}
        style={{ opacity: intensity }}
      />
    </Suspense>
  );
}
