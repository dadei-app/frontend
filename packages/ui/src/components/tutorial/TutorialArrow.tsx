import { useLayoutEffect, useState } from 'react';

function edgePoint(
  rect: DOMRect,
  toward: { x: number; y: number },
): { x: number; y: number } {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
    return { x: cx, y: cy };
  }
  const scaleX = dx !== 0 ? rect.width / 2 / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? rect.height / 2 / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);
  return { x: cx + dx * scale, y: cy + dy * scale };
}

function buildLoopPath(
  p0: { x: number; y: number },
  p3: { x: number; y: number },
): string {
  const mx = (p0.x + p3.x) / 2;
  const my = (p0.y + p3.y) / 2;
  const dx = p3.x - p0.x;
  const dy = p3.y - p0.y;
  const len = Math.hypot(dx, dy) || 1;
  const perpX = -dy / len;
  const perpY = dx / len;
  const loopRadius = len * 0.18;
  const c1x = mx + perpX * loopRadius + (p0.x - mx) * 0.3;
  const c1y = my + perpY * loopRadius + (p0.y - my) * 0.3;
  const c2x = mx - perpX * loopRadius + (p3.x - mx) * 0.3;
  const c2y = my - perpY * loopRadius + (p3.y - my) * 0.3;
  return `M ${p0.x} ${p0.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p3.x} ${p3.y}`;
}

export default function TutorialArrow({
  cardRef,
  targetRef,
}: {
  cardRef: React.RefObject<HTMLElement | null>;
  targetRef: HTMLElement | null;
}) {
  const [path, setPath] = useState('');

  useLayoutEffect(() => {
    const update = () => {
      const card = cardRef.current;
      if (!card || !targetRef) {
        setPath('');
        return;
      }
      const cardRect = card.getBoundingClientRect();
      const targetRect = targetRef.getBoundingClientRect();
      const cardCenter = { x: cardRect.left + cardRect.width / 2, y: cardRect.top + cardRect.height / 2 };
      const targetCenter = {
        x: targetRect.left + targetRect.width / 2,
        y: targetRect.top + targetRect.height / 2,
      };
      const p0 = edgePoint(cardRect, targetCenter);
      const p3 = edgePoint(targetRect, cardCenter);
      setPath(buildLoopPath(p0, p3));
    };
    update();
    const ro = new ResizeObserver(update);
    if (cardRef.current) ro.observe(cardRef.current);
    if (targetRef) ro.observe(targetRef);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [cardRef, targetRef]);

  if (!path) return null;

  return (
    <path
      d={path}
      fill="none"
      stroke="#00cc6a"
      strokeWidth={3}
      strokeDasharray="6 8"
      markerEnd="url(#tutorial-arrowhead)"
      className="tutorial-arrow-march"
    />
  );
}
