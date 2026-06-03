
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { api } from '@dadei/ui/lib/api/http/client';
import { authApi } from '@dadei/ui/lib/api/auth';
import { webTokenStore } from '@dadei/ui/lib/auth/webTokenStore';
import { AuthTokens, LoginCredentials, RegisterData, UserMe } from '@dadei/ui/types/auth.types';
import { useQueryClient } from '@tanstack/react-query';
import { clearAssistantSessionCaches } from '@dadei/ui/lib/query/cacheUtils';
import { queryKeys } from '@dadei/ui/lib/query/queryKeys';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserMe | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  saveTokens: (newTokens: AuthTokens) => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function readStoredTokens(): Promise<AuthTokens | null> {
  if (window.electronAPI) {
    const result = await window.electronAPI.getTokens();
    if (result.success && result.tokens?.accessToken && result.tokens?.refreshToken) {
      return {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
      };
    }
    return null;
  }
  return webTokenStore.get();
}

async function persistTokens(accessToken: string, refreshToken: string): Promise<void> {
  if (window.electronAPI) {
    const result = await window.electronAPI.storeTokens(accessToken, refreshToken);
    if (!result.success) {
      throw new Error('Failed to securely store tokens');
    }
  } else {
    webTokenStore.set(accessToken, refreshToken);
  }
}

async function clearAllStoredTokens(): Promise<void> {
  if (window.electronAPI) {
    await window.electronAPI.clearTokens();
  } else {
    webTokenStore.clear();
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<UserMe | null>(null);

  const tokensRef = useRef<AuthTokens | null>(null);
  tokensRef.current = tokens;

  const applyTokens = useCallback((next: AuthTokens | null) => {
    tokensRef.current = next;
    setTokens(next);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await queryClient.fetchQuery({
        queryKey: queryKeys.authMe,
        queryFn: () => authApi.me(),
        staleTime: 0,
      });
      setUser(me);
    } catch {
      setUser(null);
    }
  }, [queryClient]);

  // Setup axios interceptors once; read tokens from tokensRef so Authorization is never stale.
  useEffect(() => {
    const requestIntercept = api.interceptors.request.use(
      (config) => {
        const t = tokensRef.current;
        if (t?.accessToken) {
          config.headers.Authorization = `Bearer ${t.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    const responseIntercept = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        const t = tokensRef.current;

        // If 401 and we haven't retried, try to refresh token
        if (error.response?.status === 401 && !originalRequest._retry && t?.refreshToken) {
          originalRequest._retry = true;

          try {
            // Use authApi to refresh
            const refreshResponse = await authApi.refresh(t.refreshToken);

            const newTokens: AuthTokens = {
              accessToken: refreshResponse.access_token,
              refreshToken: refreshResponse.refresh_token || t.refreshToken,
            };

            await persistTokens(newTokens.accessToken, newTokens.refreshToken);

            applyTokens(newTokens);
            setIsAuthenticated(true);

            // Retry original request with new token
            originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
            return api(originalRequest);
          } catch (_refreshError) {
            // Only clear session when refresh is rejected — not when the API is unreachable.
            const status = isAxiosError(_refreshError) ? _refreshError.response?.status : undefined;
            if (status !== 401 && status !== 403) {
              return Promise.reject(_refreshError);
            }
            console.error('Token refresh failed, logging out');

            await clearAllStoredTokens();

            // Clear state
            applyTokens(null);
            setIsAuthenticated(false);
            setUser(null);
            clearAssistantSessionCaches(queryClient);
            queryClient.removeQueries({ queryKey: queryKeys.authMe });

            return Promise.reject(_refreshError);
          }
        }

        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.request.eject(requestIntercept);
      api.interceptors.response.eject(responseIntercept);
    };
  }, [applyTokens, queryClient]);

  // Initialize auth state on mount - verify tokens with refresh
  useEffect(() => {
    const initAuth = async () => {
      try {
        const stored = await readStoredTokens();

        if (stored?.accessToken && stored.refreshToken) {
          try {
            const refreshResponse = await authApi.refresh(stored.refreshToken);

            const newTokens: AuthTokens = {
              accessToken: refreshResponse.access_token,
              refreshToken: refreshResponse.refresh_token || stored.refreshToken,
            };

            await persistTokens(newTokens.accessToken, newTokens.refreshToken);

            applyTokens(newTokens);
            setIsAuthenticated(true);

            await refreshUser();

            console.log('Authentication verified');
          } catch (_refreshError) {
            const status = isAxiosError(_refreshError) ? _refreshError.response?.status : undefined;
            if (status === 401 || status === 403) {
              console.error('Token verification failed, clearing tokens');
              await clearAllStoredTokens();
              applyTokens(null);
              setIsAuthenticated(false);
              setUser(null);
              clearAssistantSessionCaches(queryClient);
              queryClient.removeQueries({ queryKey: queryKeys.authMe });
            } else {
              console.warn('Token verification skipped (API unreachable); keeping stored session');
              applyTokens(stored);
              setIsAuthenticated(true);
            }
          }
        } else {
          console.log('No stored tokens found');
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [applyTokens, queryClient, refreshUser]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      const response = await authApi.login(credentials);

      const newTokens: AuthTokens = {
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
      };

      await persistTokens(newTokens.accessToken, newTokens.refreshToken);

      applyTokens(newTokens);
      setIsAuthenticated(true);

      await refreshUser();

      console.log('Logged in successfully');
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Login failed');
    }
  }, [applyTokens, refreshUser]);

  const register = useCallback(async (data: RegisterData) => {
    try {
      const response = await authApi.register(data);

      const newTokens: AuthTokens = {
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
      };

      await persistTokens(newTokens.accessToken, newTokens.refreshToken);

      applyTokens(newTokens);
      setIsAuthenticated(true);

      await refreshUser();

      console.log('Registered successfully');
    } catch (error: any) {
      console.error('Registration error:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Registration failed');
    }
  }, [applyTokens, refreshUser]);

  const logout = useCallback(async () => {
    try {
      await clearAllStoredTokens();

      applyTokens(null);
      setIsAuthenticated(false);
      setUser(null);
      clearAssistantSessionCaches(queryClient);
      queryClient.removeQueries({ queryKey: queryKeys.authMe });

      console.log('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [applyTokens, queryClient]);

  const saveTokens = useCallback(async (newTokens: AuthTokens) => {
    await persistTokens(newTokens.accessToken, newTokens.refreshToken);
    applyTokens(newTokens);
    setIsAuthenticated(true);
    await refreshUser();
  }, [applyTokens, refreshUser]);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    return tokens?.accessToken ?? null;
  }, [tokens?.accessToken]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        login,
        register,
        logout,
        saveTokens,
        getAccessToken,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
