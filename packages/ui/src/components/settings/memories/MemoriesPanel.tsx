import { useEffect, useMemo, useState } from 'react';
import { useService } from '@dadei/ui/contexts/ServiceContext';
import { useNotifications } from '@dadei/ui/contexts/NotificationContext';
import { getUserErrorMessage } from '@dadei/ui/lib/platform/errors/userMessage';
import type { EpisodicMemory } from '@dadei/ui/types/models.types';
import { MemorySettingsRow } from './MemoryRow';
import { GridTile, SettingsGrid4 } from '@dadei/ui/components/settings/layout';

function MemorySection({
  emptyTitle,
  emptyDetail,
  memories,
  armedMemoryDeleteId,
  deletePending,
  onArm,
  onDisarm,
  onConfirmDelete,
}: {
  emptyTitle: string;
  emptyDetail: string;
  memories: EpisodicMemory[];
  armedMemoryDeleteId: string | null;
  deletePending: boolean;
  onArm: (id: string) => void;
  onDisarm: () => void;
  onConfirmDelete: (id: string) => void;
}) {
  if (memories.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-zinc-900/55 px-4 py-6 text-center">
        <p className="text-sm font-medium text-zinc-400">{emptyTitle}</p>
        <p className="mt-2 max-w-xs text-xs leading-relaxed text-zinc-500 font-secondary">
          {emptyDetail}
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {memories.map(m => (
        <MemorySettingsRow
          key={m.id}
          memory={m}
          armed={armedMemoryDeleteId === m.id}
          disabled={deletePending}
          onArm={() => onArm(m.id)}
          onDisarm={onDisarm}
          onConfirm={() => onConfirmDelete(m.id)}
        />
      ))}
    </ul>
  );
}

export function MemoriesPanel() {
  const { memories, memoriesLoading, deleteMemory, isDeletingMemory } = useService();
  const { showToast } = useNotifications();
  const [armedMemoryDeleteId, setArmedMemoryDeleteId] = useState<string | null>(null);

  const { facts, proposed } = useMemo(() => {
    const facts: EpisodicMemory[] = [];
    const proposed: EpisodicMemory[] = [];
    for (const m of memories) {
      if (m.memory_type === 'proposed') proposed.push(m);
      else facts.push(m);
    }
    return { facts, proposed };
  }, [memories]);

  const handleDeleteMemory = async (memoryId: string) => {
    try {
      await deleteMemory(memoryId);
      showToast('Memory deleted', 'success');
    } catch (error) {
      console.error('Failed to delete memory:', error);
      showToast(getUserErrorMessage(error, 'Something went wrong. Please try again.'), 'error');
    } finally {
      setArmedMemoryDeleteId(null);
    }
  };

  useEffect(() => {
    if (!armedMemoryDeleteId) return;
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('[data-split-delete]')) return;
      setArmedMemoryDeleteId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setArmedMemoryDeleteId(null);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [armedMemoryDeleteId]);

  if (memoriesLoading) {
    return <p className="text-sm text-zinc-500 font-secondary">Loading memories…</p>;
  }

  return (
    <SettingsGrid4 layout="memories" className="min-h-0 flex-1">
      <GridTile
        tile="facts"
        title="Memories"
        hint="Observations and facts the assistant has retained."
        scrollable
        bodyClassName="min-h-0 flex-1"
      >
        <MemorySection
          emptyTitle="No memories yet"
          emptyDetail="Saved observations from your conversations will appear here once they are processed."
          memories={facts}
          armedMemoryDeleteId={armedMemoryDeleteId}
          deletePending={isDeletingMemory}
          onArm={setArmedMemoryDeleteId}
          onDisarm={() => setArmedMemoryDeleteId(null)}
          onConfirmDelete={id => void handleDeleteMemory(id)}
        />
      </GridTile>

      <GridTile
        tile="proposed"
        title="Proposed"
        hint="Unfinished thoughts and intents still being shaped."
        scrollable
        bodyClassName="min-h-0 flex-1"
      >
        <MemorySection
          emptyTitle="No proposed memories"
          emptyDetail="This is where unfinished thoughts live — plans and intents that are still accumulating before they become firm memories."
          memories={proposed}
          armedMemoryDeleteId={armedMemoryDeleteId}
          deletePending={isDeletingMemory}
          onArm={setArmedMemoryDeleteId}
          onDisarm={() => setArmedMemoryDeleteId(null)}
          onConfirmDelete={id => void handleDeleteMemory(id)}
        />
      </GridTile>
    </SettingsGrid4>
  );
}
