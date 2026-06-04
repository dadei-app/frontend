let quitting = false;

export function setAppQuitting(): void {
  quitting = true;
}

export function isAppQuitting(): boolean {
  return quitting;
}
