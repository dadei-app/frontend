export async function enumerateMicInputs(skipPermissionProbe = false): Promise<MediaDeviceInfo[]> {
  if (!skipPermissionProbe) {
    try {
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
      probe.getTracks().forEach(t => t.stop());
    } catch {
      // Permission denied — enumerateDevices may still return ids without labels.
    }
  }
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter(d => d.kind === 'audioinput' && d.deviceId.length > 0);
}

export function micDevicesHaveLabels(devices: MediaDeviceInfo[]): boolean {
  return devices.length > 0 && devices.some(d => Boolean(d.label?.trim()));
}
