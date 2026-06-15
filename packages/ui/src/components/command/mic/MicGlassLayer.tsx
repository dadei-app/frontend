import { motion } from 'framer-motion';
import { cn } from '@dadei/ui/lib/platform/shared/cn';
import { commandGlassGlowFromMicLevel } from '@dadei/ui/lib/assistant/voice/ui/micGlassGlow';
import {
  MIC_GLASS,
  MIC_GLASS_CROSSFADE,
  MIC_GLASS_GLOW_TRANSITION,
  MIC_SHELL,
  type MicGlassTone,
} from '@dadei/ui/components/command/mic/micChrome';

export interface MicGlassLayerProps {
  tone: MicGlassTone;
  visible: boolean;
  /** Command capture — modulate blue glass glow from mic level. */
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
  const liveGlow = modulateGlow && visible ? commandGlassGlowFromMicLevel(micLevel) : null;

  return (
    <motion.div
      aria-hidden
      className={cn(MIC_SHELL, g.shell, g.fill, !liveGlow && g.glow)}
      style={{ transformOrigin: 'center' }}
      initial={false}
      animate={{
        opacity: visible ? (liveGlow ? liveGlow.opacity : 1) : 0,
        scale: liveGlow ? liveGlow.scale : 1,
        ...(liveGlow ? { boxShadow: liveGlow.boxShadow } : {}),
      }}
      transition={{
        opacity: liveGlow ? MIC_GLASS_GLOW_TRANSITION : MIC_GLASS_CROSSFADE,
        scale: MIC_GLASS_GLOW_TRANSITION,
        boxShadow: MIC_GLASS_GLOW_TRANSITION,
      }}
    />
  );
}
