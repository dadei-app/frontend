import type { NetworkAction } from '@dadei/ui/types/models.types';
import type { BannerContentProps } from './types';

export function bannerContentFromAction(action: NetworkAction): BannerContentProps {
  return {
    actionType: action.action_type,
    operation: action.operation ?? undefined,
    title: action.title?.trim() || action.action_type,
    body: undefined,
    toolArgs: action.tool_args ?? undefined,
    startTime: action.start_time,
    endTime: action.end_time,
  };
}
