import { API_CONFIG } from "@dadei/ui/lib/api/http/constants";

export interface ClientIpAddresses {
    local: string;
    external: string;
}

/**
 * Get client IP addresses (Electron-specific)
 */
export function getClientIpAddresses(): ClientIpAddresses {
    const fallback: ClientIpAddresses = {
        local: '127.0.0.1',
        external: '127.0.0.1',
    };

    // Check if we're in Electron environment
    if (typeof window !== 'undefined' && window.require) {
        try {
            const os = window.require('os');
            const networkInterfaces = os.networkInterfaces();
            let externalIp = '127.0.0.1';

            for (const interfaceName in networkInterfaces) {
                const interfaces = networkInterfaces[interfaceName];
                for (const iface of interfaces) {
                    if (iface.family === 'IPv4' && !iface.internal) {
                        externalIp = iface.address;
                        break;
                    }
                }
                if (externalIp !== '127.0.0.1') break;
            }

            return { local: '127.0.0.1', external: externalIp };
        } catch (error) {
            console.warn('Failed to get IP addresses:', error);
            return fallback;
        }
    }

    return fallback;
}

/**
 * Build endpoint with params replaced
 * Example: buildEndpoint('/users/:userId', { userId: '123' }) -> '/users/123'
 */
export function buildEndpoint(
    endpoint: string,
    params: Record<string, string>
): string {
    let result = endpoint;
    for (const [key, value] of Object.entries(params)) {
        result = result.replace(`:${key}`, encodeURIComponent(value));
    }
    return result;
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>
): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= API_CONFIG.RETRY.MAX_ATTEMPTS; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;

            if (attempt < API_CONFIG.RETRY.MAX_ATTEMPTS) {
                const delay = API_CONFIG.RETRY.BACKOFF_MS * Math.pow(2, attempt - 1);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
}