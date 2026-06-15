import { useCallback, useMemo, useRef } from 'react';
import { useCommand } from '@dadei/ui/contexts/CommandContext';
import { useService } from '@dadei/ui/contexts/ServiceContext';
import { useAssistantRuntimeState } from '@dadei/ui/contexts/AssistantRuntimeContext';
import { useTutorialEngaged } from '@dadei/ui/contexts/TutorialContext';
import {
  markMicIntentHandled,
  shouldAcceptMicIntent,
} from '@dadei/ui/lib/assistant/lifecycle/assistantLifecycle';
import { resolveMicIntentAction } from '@dadei/ui/lib/assistant/lifecycle/micIntent';
import { deriveMicAppearanceFromRuntime } from '@dadei/ui/lib/assistant/voice/micAppearance';

export function useMicIntent() {
  const runtime = useAssistantRuntimeState();
  const runtimeRef = useRef(runtime);
  runtimeRef.current = runtime;

  const tutorialActive = useTutorialEngaged();
  const { toggleService, permissionsGateOpen } = useService();
  const { assistantBubbleStatus, cancelCommandService, cancelThinking } = useCommand();

  const submitMicIntent = useCallback(() => {
    if (!shouldAcceptMicIntent()) return;

    const action = resolveMicIntentAction(runtimeRef.current, {
      tutorialActive,
      permissionsGateBlocked: permissionsGateOpen,
      assistantBubbleStatus,
    });
    if (action === 'none') return;

    markMicIntentHandled();

    if (action === 'cancel_thinking') {
      cancelThinking();
      return;
    }
    if (action === 'exit_command_service') {
      cancelCommandService();
      return;
    }
    void toggleService();
  }, [
    cancelCommandService,
    cancelThinking,
    permissionsGateOpen,
    toggleService,
    assistantBubbleStatus,
    tutorialActive,
  ]);

  const appearance = useMemo(
    () =>
      deriveMicAppearanceFromRuntime(runtime, {
        tutorialActive,
        permissionsGateBlocked: permissionsGateOpen,
        assistantBubbleStatus,
      }),
    [assistantBubbleStatus, permissionsGateOpen, runtime, tutorialActive],
  );

  return {
    submitMicIntent,
    inputsInert: appearance.action === 'none',
    appearance,
  };
}
