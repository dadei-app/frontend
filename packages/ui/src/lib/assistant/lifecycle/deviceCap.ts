/** Whether the mic should be blocked because the tier device cap is exhausted. */
export function isDeviceCapBlocked(
  clientIds: readonly string[],
  maxDevices: number | null | undefined,
  selfId: string | null | undefined,
): boolean {
  if (maxDevices == null) return false;

  if (!selfId) {
    // Session id not known yet — only block when clearly over the cap.
    return clientIds.length > maxDevices;
  }

  const others = clientIds.filter(id => id !== selfId);
  return others.length >= maxDevices;
}
