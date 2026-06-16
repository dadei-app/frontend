import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getRealtimeClientId } from '@dadei/ui/lib/assistant/realtime/realtimeClient';
import { serviceApi } from '@dadei/ui/lib/workspace/api/service';
import { queryKeys } from '@dadei/ui/lib/platform/query/queryKeys';
import { useSubscription } from '@dadei/ui/lib/platform/query/queryHooks';

/** True when this device cannot use the mic affordance due to the free-tier device cap. */
export function useDeviceCapBlocked(enabled = true): boolean {
  const { data: sub } = useSubscription(enabled);
  const { data: clientIds } = useQuery({
    queryKey: queryKeys.serviceClients,
    queryFn: () => serviceApi.listClients(),
    enabled,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  return useMemo(() => {
    const maxDevices = sub?.limits.max_devices;
    if (maxDevices == null) return false;
    const selfId = getRealtimeClientId();
    const others = (clientIds ?? []).filter(id => id !== selfId);
    return others.length >= maxDevices;
  }, [clientIds, sub?.limits.max_devices]);
}
