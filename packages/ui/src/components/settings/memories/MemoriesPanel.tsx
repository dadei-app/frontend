import { useEffect, useMemo, useState } from 'react';
import { useService } from '@dadei/ui/contexts/ServiceContext';
import { useNotifications } from '@dadei/ui/contexts/NotificationContext';
import { getUserErrorMessage } from '@dadei/ui/lib/errors/userMessage';
import type { EpisodicMemory } from '@dadei/ui/types/models.types';
import { MemorySettingsRow } from './MemorySettingsRow';
import { GridTile, SettingsGrid4 } from '@dadei/ui/components/settings/layout';

function MemorySection({
  title,
  hint,
  emptyTitle,
  emptyDetail,
  memories,
  armedMemoryDeleteId,
  deletePending,
  onArm,
  onDisarm,
  onConfirmDelete,
}: {
  title: string;
  hint: string;
  emptyTitle: string;
  emptyDetail: string;
  memories: EpisodicMemory[];
  armedMemoryDeleteId: string | null;
  deletePending: boolean;
  onArm: (id: string) => void;
  onDisarm: () => void;
  onConfirmDelete: (id: string) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 shrink-0">
        <h3 className="text-sm font-medium text-zinc-100">{title}</h3>
        <p className="mt-0.5 text-xs text-zinc-500 font-secondary">{hint}</p>
      </div>
      {memories.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-zinc-950/40 px-4 py-6 text-center">
          <p className="text-sm font-medium text-zinc-400">{emptyTitle}</p>
          <p className="mt-2 max-w-xs text-xs leading-relaxed text-zinc-600 font-secondary">
            {emptyDetail}
          </p>
        </div>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-none pr-0.5">
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
      )}
    </div>
  );
}

export function MemoriesPanel() {
  const { memories, memoriesLoading, deleteMemory, isDeletingMemory } = useService();
  const { showToast } = useNotifications();
  const [armedMemoryDeleteId, setArmedMemoryDeleteId] = useState<string | null>(null);

  const fetchErr = (e: unknown) => getUserErrorMessage(e, 'Something went wrong. Please try again.');

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
    <SettingsGrid4 className="min-h-0 flex-1">
      <GridTile col={1} row={1} colSpan={4} rowSpan={2} className="p-3">
        <MemorySection
          title="Memories"
          hint="Observations and facts the assistant has retained."
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

      <GridTile col={1} row={3} colSpan={4} rowSpan={2} className="p-3">
        <MemorySection
          title="Proposed"
          hint="Unfinished thoughts and intents still being shaped."
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
