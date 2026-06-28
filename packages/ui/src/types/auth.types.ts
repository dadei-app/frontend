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
    accept_terms: boolean;
    accept_biometric: boolean;
    terms_version: string;
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
    name: string;
    timezone: string;
    has_password: boolean;
    google_connected: boolean;
    google_granted_scopes: string[];
    google_scopes_stale: boolean;
    providers_needing_reauth: string[];
    primary_mail_provider: string | null;
    primary_calendar_provider: string | null;
    primary_contacts_provider: string | null;
    tutorial_completed: boolean;
    consent_required: boolean;
}

export interface AcceptConsentPayload {
    terms_version: string;
    accept_terms: boolean;
    accept_biometric: boolean;
}

export interface TokenResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
    user: { id: string; email: string };
}