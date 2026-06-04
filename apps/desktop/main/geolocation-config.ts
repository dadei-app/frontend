/** Chromium geolocation in Electron uses Google Cloud Geolocation API (not built into Chromium). */
export function configureGeolocationApiKey(): boolean {
  const key = process.env.GOOGLE_API_KEY?.trim();
  if (!key) {
    console.warn(
      '[desktop] GOOGLE_API_KEY is not set. navigator.geolocation will fail in Electron. ' +
        'Add a billed Geolocation API key to frontend/.env — see https://www.electronjs.org/docs/latest/api/environment-variables#google_api_key',
    );
    return false;
  }
  process.env.GOOGLE_API_KEY = key;
  return true;
}

export function isGeolocationApiKeyConfigured(): boolean {
  return Boolean(process.env.GOOGLE_API_KEY?.trim());
}
