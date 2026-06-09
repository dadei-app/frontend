import { lazy, Suspense } from 'react';

const shadersImport = () => import('@paper-design/shaders-react');

const MeshGradient = lazy(() =>
  shadersImport().then(m => ({ default: m.MeshGradient })),
);

/** Warm the lazy shader chunk before settings opens (e.g. during tutorial). */
export function preloadAmbientShader(): void {
  void shadersImport();
}

interface AmbientShaderProps {
  className?: string;
  intensity?: number;
  /** Keep the static gradient until the parent clears this (avoids WebGL + open animation at once). */
  deferGpu?: boolean;
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

export function AmbientShader({
  className,
  intensity = 0.3,
  deferGpu = false,
}: AmbientShaderProps) {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion || deferGpu) {
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
