export interface User {
    id: string;
    email: string;
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface RegisterData {
    email: string;
    password: string;
}

export interface AuthResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
    user: {
        id: string;
        email: string;
        is_active: boolean;
    };
}

/** Current user from GET /auth/me */
export interface UserMe {
    id: string;
    email: string;
    has_password: boolean;
    google_connected: boolean;
}