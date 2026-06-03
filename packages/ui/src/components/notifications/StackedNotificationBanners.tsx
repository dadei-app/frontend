import { AnimatePresence, motion } from 'framer-motion';
import Banner from '@dadei/ui/components/ui/Banner';
import type { BannerItem } from '@dadei/ui/contexts/NotificationContext';

const STACK_PEEK_PX = 11;
const STACK_SCALE_STEP = 0.028;
const STACK_MAX_VISIBLE = 4;

type StackedNotificationBannersProps = {
  banners: BannerItem[];
  onDismiss: (id: string) => void;
  className?: string;
};

/**
 * Front banner (index 0) is interactive; deeper cards peek beneath with blur.
 * New items slot in at the back of the stack (slide under).
 */
export default function StackedNotificationBanners({
  banners,
  onDismiss,
  className = '',
}: StackedNotificationBannersProps) {
  if (banners.length === 0) return null;

  const visible = banners.slice(0, STACK_MAX_VISIBLE);
  const overflow = banners.length - visible.length;
  const stackHeight =
    72 + Math.max(visible.length - 1, 0) * STACK_PEEK_PX + (overflow > 0 ? 18 : 0);

  return (
    <div
      className={`pointer-events-none relative w-full max-w-xl ${className}`}
      style={{ minHeight: stackHeight }}
      aria-live="polite"
    >
      {overflow > 0 ? (
        <p className="pointer-events-none absolute right-0 bottom-0 text-[10px] font-medium tracking-wide text-zinc-500/90 font-secondary">
          +{overflow} more
        </p>
      ) : null}
      <AnimatePresence initial={false}>
        {visible.map((banner, index) => {
          const depth = index;
          const isFront = depth === 0;
          const y = depth * STACK_PEEK_PX;
          const scale = 1 - depth * STACK_SCALE_STEP;
          const stackBlurPx = isFront ? 0 : Math.min(4 + depth * 5, 18);

          return (
            <motion.div
              key={banner.id}
              layout
              className="absolute left-0 w-full"
              style={{
                top: 0,
                zIndex: visible.length - depth,
                transformOrigin: 'top center',
              }}
              initial={{ opacity: 0, y: -28, scale: 0.94, filter: 'blur(10px)' }}
              animate={{
                opacity: 1,
                y,
                scale,
                filter: stackBlurPx > 0 ? `blur(${stackBlurPx}px)` : 'blur(0px)',
              }}
              exit={{
                opacity: 0,
                y: -40,
                scale: scale * 0.96,
                filter: 'blur(12px)',
                transition: { duration: 0.35 },
              }}
              transition={{
                layout: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
                opacity: { duration: 0.35 },
                y: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
                scale: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
                filter: { duration: 0.4 },
              }}
            >
              <Banner
                id={banner.id}
                category={banner.category}
                operation={banner.operation}
                title={banner.title}
                body={banner.body}
                durationMs={banner.durationMs}
                showCountdown={banner.showCountdown}
                countdownEndsAt={banner.countdownEndsAt}
                cancelLabel={banner.cancelLabel}
                onCancel={banner.onCancel}
                onDismiss={() => onDismiss(banner.id)}
                isStackFront={isFront}
                stackDepth={depth}
                queued={banner.queued}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
