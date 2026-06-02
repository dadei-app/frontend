const ACCESS_KEY = 'dadei_web_access_token';
const REFRESH_KEY = 'dadei_web_refresh_token';

export const webTokenStore = {
  get(): { accessToken: string; refreshToken: string } | null {
    try {
      const accessToken = localStorage.getItem(ACCESS_KEY);
      const refreshToken = localStorage.getItem(REFRESH_KEY);
      if (!accessToken || !refreshToken) return null;
      return { accessToken, refreshToken };
    } catch {
      return null;
    }
  },

  set(accessToken: string, refreshToken: string): void {
    try {
      localStorage.setItem(ACCESS_KEY, accessToken);
      localStorage.setItem(REFRESH_KEY, refreshToken);
    } catch {
      /* quota / private mode */
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
    } catch {
      /* ignore */
    }
  },
};
