import { useEffect, useRef } from 'react';
import { useCommand } from '@dadei/ui/contexts/CommandContext';
import { useService } from '@dadei/ui/contexts/ServiceContext';
import { isMeetDadeiStep } from './constants';
import { useTutorialContext } from './TutorialContext';

/** Starts the Dadei-led introduction (assistant speaks first, then listens). */
export default function TutorialVoiceCommandBridge() {
  const tutorial = useTutorialContext();
  const { isConnected } = useService();
  const { state, beginTutorialIntroduction } = useCommand();
  const armedRef = useRef(false);

  useEffect(() => {
    if (!tutorial || !isMeetDadeiStep(tutorial.step.id) || tutorial.wakeSessionEnded) {
      armedRef.current = false;
      return;
    }
    if (armedRef.current || !isConnected || state !== 'idle') return;
    armedRef.current = true;
    beginTutorialIntroduction();
  }, [
    tutorial?.step.id,
    tutorial?.wakeSessionEnded,
    tutorial,
    isConnected,
    state,
    beginTutorialIntroduction,
  ]);

  return null;
}
