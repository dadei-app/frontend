import { Trash2 } from 'lucide-react';

import { useMobileInteractionsSheet } from '@dadei/ui/components/MobileInteractionsSheet';

import { ToolbarButton } from '@dadei/ui/components/ui/Toolbar';

type MobileInteractionChromeProps = {
  clearAllDisabled: boolean;
  onClearAllRequest: () => void;
};

/** Top cap of the mobile sheet — same height as the app header. */
export function MobileInteractionChrome({
  clearAllDisabled,
  onClearAllRequest,
}: MobileInteractionChromeProps) {
  const { open, bindDragHandle } = useMobileInteractionsSheet();
  const dragHandle = bindDragHandle();

  return (
    <div
      className="relative flex h-[var(--assistant-header-h,4.75rem)] shrink-0 select-none items-center px-4 sm:px-6"
      style={{ touchAction: 'none' }}
    >
      <div className="absolute inset-x-0 top-2 flex justify-center">
        <div
          className="flex cursor-grab items-center justify-center py-1 active:cursor-grabbing"
          aria-expanded={open}
          aria-controls="assistant-mobile-interactions-panel"
          aria-label="Drag to expand interactions"
          {...dragHandle}
        >
          <span aria-hidden className="h-1 w-10 shrink-0 rounded-full bg-white/25" />
        </div>
      </div>

      <div
        className="flex w-full min-w-0 cursor-grab items-center justify-between gap-3 active:cursor-grabbing"
        aria-expanded={open}
        aria-controls="assistant-mobile-interactions-panel"
        {...dragHandle}
      >
        <span className="min-w-0 truncate text-lg font-semibold text-zinc-100">Interactions</span>

        <ToolbarButton
          variant="destructive"
          icon={Trash2}
          label="Clear all"
          disabled={clearAllDisabled}
          onClick={onClearAllRequest}
          onPointerDown={event => event.stopPropagation()}
        />
      </div>
    </div>
  );
}
