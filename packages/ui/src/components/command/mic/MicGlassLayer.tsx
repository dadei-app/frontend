import { motion } from 'framer-motion';
import { cn } from '@dadei/ui/lib/platform/shared/cn';
import {
  MIC_GLASS,
  MIC_GLASS_CROSSFADE,
  MIC_GLASS_GLOW_TRANSITION,
  MIC_SHELL,
  type MicGlassTone,
} from '@dadei/ui/components/command/mic/micChrome';

type CommandOrbLayers = {
  body: string;
  energyOpacity: number;
  energy: string;
  specularOpacity: number;
  specular: string;
  causticOpacity: number;
  caustic: string;
  boxShadow: string;
};

const COMMAND_ORB_REST: CommandOrbLayers = {
  body: [
    'radial-gradient(circle at 50% 58%, rgba(14,165,233,0.05) 0%, transparent 42%)',
    'radial-gradient(circle at 50% 50%, transparent 48%, rgba(15,23,42,0.18) 100%)',
  ].join(', '),
  energyOpacity: 0,
  energy: 'radial-gradient(circle at 50% 55%, rgba(125,211,252,0.9) 0%, transparent 68%)',
  specularOpacity: 0.08,
  specular:
    'radial-gradient(ellipse 46% 38% at 34% 28%, rgba(255,255,255,0.55) 0%, transparent 72%)',
  causticOpacity: 0,
  caustic:
    'radial-gradient(ellipse 54% 42% at 64% 74%, rgba(56,189,248,0.75) 0%, transparent 70%)',
  boxShadow:
    'inset 0 10px 18px rgba(255,255,255,0.04), inset 0 -16px 28px rgba(15,23,42,0.22), 0 0 18px rgba(37,99,235,0.1), 0 0 36px rgba(14,165,233,0.06)',
};

function commandOrbLayersFromMicLevel(level: number): CommandOrbLayers {
  const clamped = Math.min(1, Math.max(0, level));
  const raw = clamped < 0.02 ? 0 : clamped;
  const t = Math.min(1, Math.pow(raw, 0.82));

  if (t === 0) return COMMAND_ORB_REST;

  const coreStop = 22 + t * 44;
  const midStop = 44 + t * 34;
  const bloomStop = Math.min(92, 62 + t * 30);

  const body = [
    `radial-gradient(circle at 50% 54%, rgba(125,211,252,${0.06 + t * 0.34}) 0%, rgba(14,165,233,${0.04 + t * 0.44}) ${coreStop}%, rgba(37,99,235,${0.03 + t * 0.5}) ${midStop}%, transparent ${bloomStop}%)`,
    `radial-gradient(circle at 50% 50%, transparent ${42 - t * 14}%, rgba(15,23,42,${0.18 + t * 0.16}) 100%)`,
    `radial-gradient(ellipse 90% 70% at 50% 112%, rgba(30,64,175,${0.04 + t * 0.42}) 0%, transparent 62%)`,
  ].join(', ');

  const energy = `radial-gradient(circle at 50% 55%, rgba(186,230,253,${0.42 + t * 0.58}) 0%, rgba(56,189,248,${0.22 + t * 0.56}) ${16 + t * 28}%, rgba(14,165,233,${0.1 + t * 0.46}) ${36 + t * 30}%, transparent ${58 + t * 26}%)`;

  const specular = `radial-gradient(ellipse 46% 38% at 34% 28%, rgba(255,255,255,${0.5 + t * 0.5}) 0%, rgba(186,230,253,${0.14 + t * 0.32}) 34%, transparent 72%)`;

  const caustic = `radial-gradient(ellipse 58% 46% at 64% 74%, rgba(125,211,252,${0.3 + t * 0.62}) 0%, rgba(37,99,235,${0.12 + t * 0.38}) 38%, transparent 72%)`;

  const innerBloom = 14 + t * 86;
  const rimLight = 0.05 + t * 0.32;
  const rimShade = 0.2 + t * 0.2;
  const outerNear = 22 + t * 58;
  const outerFar = 44 + t * 96;
  const outerAlpha = 0.08 + t * 0.48;

  const boxShadow = [
    `inset 0 1px 0 rgba(255,255,255,${rimLight})`,
    `inset 0 -18px 36px -10px rgba(15,23,42,${rimShade})`,
    `inset 0 0 ${innerBloom}px rgba(56,189,248,${0.06 + t * 0.72})`,
    `inset 0 0 ${Math.round(innerBloom * 0.5)}px rgba(37,99,235,${0.04 + t * 0.52})`,
    `0 0 ${outerNear}px rgba(37,99,235,${outerAlpha})`,
    `0 0 ${outerFar}px rgba(14,165,233,${outerAlpha * 0.85})`,
  ].join(', ');

  return {
    body,
    energyOpacity: 0.15 + t * 1.05,
    energy,
    specularOpacity: 0.1 + t * 1,
    specular,
    causticOpacity: t * 0.95,
    caustic,
    boxShadow,
  };
}

const ORB_FILL_TRANSITION = {
  duration: 0.26,
  ease: [0.22, 1, 0.36, 1] as const,
};

function CommandOrbInterior({ layers }: { layers: CommandOrbLayers }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
      <motion.div
        aria-hidden
        className="absolute inset-0 rounded-full"
        initial={false}
        animate={{ background: layers.body }}
        transition={ORB_FILL_TRANSITION}
      />
      <motion.div
        aria-hidden
        className="absolute inset-0 rounded-full mix-blend-screen"
        initial={false}
        animate={{ opacity: layers.energyOpacity, background: layers.energy }}
        transition={ORB_FILL_TRANSITION}
      />
      <motion.div
        aria-hidden
        className="absolute inset-0 rounded-full mix-blend-screen"
        initial={false}
        animate={{ opacity: layers.causticOpacity, background: layers.caustic }}
        transition={ORB_FILL_TRANSITION}
      />
      <motion.div
        aria-hidden
        className="absolute inset-0 rounded-full mix-blend-overlay"
        initial={false}
        animate={{ opacity: layers.specularOpacity, background: layers.specular }}
        transition={ORB_FILL_TRANSITION}
      />
    </div>
  );
}

export interface MicGlassLayerProps {
  tone: MicGlassTone;
  visible: boolean;
  /** Command capture — fill the blue orb from mic level. */
  modulateGlow?: boolean;
  micLevel?: number;
}

export default function MicGlassLayer({
  tone,
  visible,
  modulateGlow = false,
  micLevel = 0,
}: MicGlassLayerProps) {
  const g = MIC_GLASS[tone];
  const liveOrb = modulateGlow && visible ? commandOrbLayersFromMicLevel(micLevel) : null;

  return (
    <motion.div
      aria-hidden
      className={cn(MIC_SHELL, g.shell, !liveOrb && g.fill, !liveOrb && g.glow)}
      initial={false}
      animate={{
        opacity: visible ? 1 : 0,
        ...(liveOrb ? { boxShadow: liveOrb.boxShadow } : {}),
      }}
      transition={{
        opacity: MIC_GLASS_CROSSFADE,
        boxShadow: liveOrb ? ORB_FILL_TRANSITION : MIC_GLASS_GLOW_TRANSITION,
      }}
    >
      {liveOrb ? <CommandOrbInterior layers={liveOrb} /> : null}
    </motion.div>
  );
}
