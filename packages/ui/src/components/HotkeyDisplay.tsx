import { useHotkey } from '@dadei/ui/contexts/HotkeyContext';

export function HotkeyDisplay({ className }: { className?: string }) {
  const { formatHotkey } = useHotkey();
  return (
    <kbd
      className={
        className ??
        'rounded-md border border-white/10 bg-zinc-900/80 px-4 py-1 font-mono text-base text-zinc-300 shadow-inner shadow-black/40'
      }
    >
      {formatHotkey()}
    </kbd>
  );
}
