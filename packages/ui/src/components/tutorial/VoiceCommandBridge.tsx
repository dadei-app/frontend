import { useEffect, useRef } from 'react';
import { useCommand } from '@dadei/ui/contexts/CommandContext';
import { useService } from '@dadei/ui/contexts/ServiceContext';
import { useTutorialContext } from '@dadei/ui/contexts/TutorialContext';
import { isMeetDadeiStep } from '@dadei/ui/lib/tutorial/constants';

/** Auto-starts the tutorial introduction command session on meet_dadei. */
export default function VoiceCommandBridge() {
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
