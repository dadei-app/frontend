import { api } from '@dadei/ui/lib/api/http/client';
import {
  LoginCredentials,
  RegisterData,
  AuthResponse,
  TokenResponse,
  UserMe,
} from '../../types/auth.types';
import { ENDPOINTS } from '@dadei/ui/lib/api/http/constants';

export const authApi = {
  /**
   * Login with email and password
   * POST /api/v1/auth/login or /api/v2/... when `BETA=true` (same base as `api` client)
   */
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>(ENDPOINTS.AUTH_LOGIN, {
      email: credentials.email,
      password: credentials.password,
    });
    return data;
  },

  /**
   * Register new user
   * POST /api/v1/auth/register or /api/v2/... when `BETA=true`
   */
  register: async (registerData: RegisterData): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>(ENDPOINTS.AUTH_REGISTER, {
      email: registerData.email,
      password: registerData.password,
    });
    return data;
  },

  /**
   * Refresh access token
   * POST /api/v1/auth/refresh or /api/v2/... when `BETA=true`
   */
  refresh: async (refreshToken: string): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>(ENDPOINTS.AUTH_REFRESH, {
      refresh_token: refreshToken,
    });
    return data;
  },

  /**
   * Get Google OAuth URL
   * GET /api/v1/auth/google/url or /api/v2/... when `BETA=true`
   */
  getGoogleOAuthUrl: async (redirectPort: number = 4280): Promise<{ url: string; state: string }> => {
    const { data } = await api.get<{ url: string; state: string }>(ENDPOINTS.AUTH_GOOGLE_URL, {
      params: { redirect_port: redirectPort },
    });
    return data;
  },

  /**
   * Exchange Google OAuth code for tokens
   * POST /api/v1/auth/google/callback or /api/v2/... when `BETA=true`
   */
  googleCallback: async (code: string, state: string): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>(ENDPOINTS.AUTH_GOOGLE_CALLBACK, {
      code,
      state,
    });
    return data;
  },

  me: async (): Promise<UserMe> => {
    const { data } = await api.get<UserMe>(ENDPOINTS.AUTH_ME);
    return data;
  },

  deleteMe: async (): Promise<void> => {
    await api.delete(ENDPOINTS.AUTH_ME);
  },

  setPassword: async (newPassword: string): Promise<TokenResponse> => {
    const { data } = await api.post<TokenResponse>('/auth/set-password', {
      new_password: newPassword,
    });
    return data;
  },

  changePassword: async (
    currentPassword: string,
    newPassword: string,
  ): Promise<TokenResponse> => {
    const { data } = await api.post<TokenResponse>('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return data;
  },
};