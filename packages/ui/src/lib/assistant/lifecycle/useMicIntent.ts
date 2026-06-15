import { useCallback, useRef } from 'react';
import { useCommand } from '@dadei/ui/contexts/CommandContext';
import { useService } from '@dadei/ui/contexts/ServiceContext';
import { useAssistantRuntimeState } from '@dadei/ui/contexts/AssistantRuntimeContext';
import { useTutorialEngaged } from '@dadei/ui/contexts/TutorialContext';
import {
  markMicIntentHandled,
  shouldAcceptMicIntent,
} from '@dadei/ui/lib/assistant/lifecycle/assistantLifecycle';
import { resolveMicIntentAction } from '@dadei/ui/lib/assistant/lifecycle/micIntent';

export function useMicIntent() {
  const runtime = useAssistantRuntimeState();
  const runtimeRef = useRef(runtime);
  runtimeRef.current = runtime;

  const tutorialActive = useTutorialEngaged();
  const { toggleService, permissionsGateOpen } = useService();
  const { cancelCommandService, cancelProcessing } = useCommand();

  const submitMicIntent = useCallback(() => {
    if (!shouldAcceptMicIntent()) return;

    const action = resolveMicIntentAction(runtimeRef.current, {
      tutorialActive,
      permissionsGateBlocked: permissionsGateOpen,
    });
    if (action === 'none') return;

    markMicIntentHandled();

    if (action === 'cancel_processing') {
      cancelProcessing();
      return;
    }
    if (action === 'exit_command_service') {
      cancelCommandService();
      return;
    }
    void toggleService();
  }, [
    cancelCommandService,
    cancelProcessing,
    permissionsGateOpen,
    toggleService,
    tutorialActive,
  ]);

  const appearanceAction = resolveMicIntentAction(runtime, {
    tutorialActive,
    permissionsGateBlocked: permissionsGateOpen,
  });

  return {
    submitMicIntent,
    inputsInert: appearanceAction === 'none',
  };
}
