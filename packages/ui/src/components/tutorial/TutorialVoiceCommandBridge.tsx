import { useEffect, useRef } from 'react';
import { useCommand } from '@dadei/ui/contexts/CommandContext';
import { useService } from '@dadei/ui/contexts/ServiceContext';
import { useTutorialContext } from './TutorialContext';

/** Enters assistant command mode directly (no passive service) for the introduction step. */
export default function TutorialVoiceCommandBridge() {
  const tutorial = useTutorialContext();
  const { isConnected } = useService();
  const { state, startListening } = useCommand();
  const armedRef = useRef(false);

  useEffect(() => {
    if (tutorial?.step.id !== 'introduce_yourself') {
      armedRef.current = false;
      return;
    }
    if (armedRef.current || !isConnected || state !== 'idle') return;
    armedRef.current = true;
    startListening();
  }, [tutorial?.step.id, isConnected, state, startListening]);

  return null;
}
