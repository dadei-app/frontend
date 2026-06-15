import type { AssistantState } from '@dadei/ui/types/assistant.types';
import {
  COMMAND_CAPTURE_STATES,
  COMMAND_PROCESSING_STATES,
  selectIsAmbientEnabled,
  selectIsCommandService,
} from '@dadei/ui/lib/assistant/assistantRuntime';
import type { MicAppearance } from '@dadei/ui/lib/assistant/voice/micAppearance';
import { deriveMicAppearanceFromRuntime } from '@dadei/ui/lib/assistant/voice/micAppearance';

export type MicIntentAction = MicAppearance['action'];

export function resolveMicIntentAction(
  runtime: AssistantState,
  options: {
    tutorialActive: boolean;
    permissionsGateBlocked?: boolean;
  },
): MicIntentAction {
  return deriveMicAppearanceFromRuntime(runtime, options).action;
}

export function describeMicIntent(runtime: AssistantState): string {
  if (selectIsCommandService(runtime)) {
    if (COMMAND_PROCESSING_STATES.has(runtime.commandState)) return 'cancel_processing';
    if (COMMAND_CAPTURE_STATES.has(runtime.commandState)) return 'exit_command_service';
    return 'exit_command_service';
  }
  if (selectIsAmbientEnabled(runtime)) return 'toggle_service_off';
  return 'toggle_service_on';
}
