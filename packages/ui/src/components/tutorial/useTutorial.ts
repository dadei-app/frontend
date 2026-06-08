import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@dadei/ui/lib/api/http/client';
import { ENDPOINTS } from '@dadei/ui/lib/api/http/constants';
import { queryKeys } from '@dadei/ui/lib/query/queryKeys';
import { isSettingsTutorialStep } from './constants';
import { useTutorialContext, TutorialProvider } from './TutorialContext';
import type { ActionTrigger } from './types';

export { TutorialProvider };

export function useTutorial() {
  const ctx = useTutorialContext();
  if (!ctx) {
    throw new Error('useTutorial must be used within TutorialProvider');
  }

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const scrollTargetIntoView = useCallback((targetKey: string | null) => {
    if (!targetKey) return;
    const el = document.querySelector(`[data-tutorial-target="${targetKey}"]`);
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, []);

  const completeTutorial = useCallback(async () => {
    await api.post(ENDPOINTS.TUTORIAL_COMPLETE);
    await queryClient.invalidateQueries({ queryKey: queryKeys.authMe });
    navigate('/subscribe', { replace: true });
  }, [navigate, queryClient]);

  const markActionFired = useCallback(
    (trigger: ActionTrigger) => {
      ctx.markActionFired(trigger);
      if (trigger === 'wake-session-ended') {
        void completeTutorial();
      }
    },
    [ctx, completeTutorial],
  );

  useEffect(() => {
    scrollTargetIntoView(ctx.step.targetKey);
    if (isSettingsTutorialStep(ctx.step.id)) {
      ctx.setOpenSettingsForTutorial(true);
    } else if (ctx.openSettingsForTutorial) {
      ctx.setOpenSettingsForTutorial(false);
    }
  }, [ctx.step, scrollTargetIntoView, ctx]);

  useEffect(() => {
    const onSessionEnd = () => {
      markActionFired('wake-session-ended');
    };
    window.addEventListener('tutorial-wake-session-ended', onSessionEnd);
    return () => window.removeEventListener('tutorial-wake-session-ended', onSessionEnd);
  }, [markActionFired]);

  return {
    ...ctx,
    markActionFired,
    completeTutorial,
  };
}
