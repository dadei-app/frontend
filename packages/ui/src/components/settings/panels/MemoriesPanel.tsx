import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@dadei/ui/contexts/AuthContext';
import { useNotifications } from '@dadei/ui/contexts/NotificationContext';
import { getUserErrorMessage } from '@dadei/ui/lib/errors/userMessage';
import { useDeleteMemoryMutation, useMemoriesQuery } from '@dadei/ui/lib/query/queryHooks';
import { queryKeys } from '@dadei/ui/lib/query/queryKeys';
import type { EpisodicMemory } from '@dadei/ui/types/models.types';
import { MemorySettingsRow } from '@dadei/ui/components/settings/MemorySettingsRow';

export function MemoriesPanel() {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const { showToast } = useNotifications();
  const memoriesQuery = useMemoriesQuery(isAuthenticated);
  const deleteMemoryMutation = useDeleteMemoryMutation();
  const [armedMemoryDeleteId, setArmedMemoryDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.memories });
  }, [isAuthenticated, queryClient]);

  const fetchErr = (e: unknown) => getUserErrorMessage(e, 'Something went wrong. Please try again.');
  const memoryRows = memoriesQuery.data ?? [];

  const handleDeleteMemory = async (memoryId: string) => {
    try {
      await deleteMemoryMutation.mutateAsync(memoryId);
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

  return (
    <div className="conic-border glass-panel rounded-lg p-5">
      {memoriesQuery.isLoading ? (
        <p className="text-sm text-zinc-500 font-secondary">Loading memories…</p>
      ) : memoriesQuery.isError ? (
        <p className="text-sm text-rose-300/90 font-secondary">{fetchErr(memoriesQuery.error)}</p>
      ) : memoryRows.length === 0 ? (
        <p className="text-sm text-zinc-500 font-secondary">
          No episodic memories yet. They appear after conversations are processed.
        </p>
      ) : (
        <ul className="space-y-2">
          {memoryRows.map((m: EpisodicMemory) => (
            <MemorySettingsRow
              key={m.id}
              memory={m}
              armed={armedMemoryDeleteId === m.id}
              disabled={deleteMemoryMutation.isPending}
              onArm={() => setArmedMemoryDeleteId(m.id)}
              onDisarm={() => setArmedMemoryDeleteId(null)}
              onConfirm={() => void handleDeleteMemory(m.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
