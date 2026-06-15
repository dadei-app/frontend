import { Trash2 } from 'lucide-react';

import { GlassAlertModal } from '@dadei/ui/components/ui/GlassModal';

type ClearAllConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  confirming?: boolean;
  conversationCount: number;
};

export function ClearAllConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  confirming = false,
  conversationCount,
}: ClearAllConfirmDialogProps) {
  const countLabel =
    conversationCount === 1 ? '1 conversation' : `${conversationCount} conversations`;

  return (
    <GlassAlertModal
      open={open}
      onOpenChange={onOpenChange}
      layer="assistant"
      size="sm"
      variant="destructive"
      icon={Trash2}
      title="Clear all interactions?"
      description={`This permanently removes ${countLabel} and their history. This cannot be undone.`}
      confirmLabel="Clear all"
      confirmingLabel="Clearing…"
      confirming={confirming}
      onConfirm={onConfirm}
    />
  );
}
