import type { NetworkAction } from '@dadei/ui/types/models.types';
import { isCalendarAction, isMailAction, isTaskAction } from '@dadei/ui/types/models.types';

import { CalendarActionRow } from './CalendarActionRow';
import { MailActionRow } from './MailActionRow';
import { TaskActionRow } from './TaskActionRow';

type WorkspaceActionRowProps = {
  action: NetworkAction;
  armed: boolean;
  disabled: boolean;
  onArm: () => void;
  onDisarm: () => void;
  onConfirm: () => void;
};

export function WorkspaceActionRow(props: WorkspaceActionRowProps) {
  const { action } = props;

  if (isCalendarAction(action)) {
    return <CalendarActionRow {...props} action={action} />;
  }
  if (isTaskAction(action)) {
    return <TaskActionRow {...props} action={action} />;
  }
  if (isMailAction(action)) {
    return <MailActionRow {...props} action={action} />;
  }

  return <CalendarActionRow {...props} />;
}
