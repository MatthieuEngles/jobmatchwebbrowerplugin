/**
 * API client for communicating with JobMatch backend
 * Handles authentication, token refresh, and API calls
 */

import type {
  AuthTokens,
  User,
  ApiResponse,
  JobOffer,
  ImportOfferRequest,
  ImportOfferResponse,
  MatchResult,
} from '@/types';
import { getAuthTokens, setAuthTokens, clearAuth, getSettings } from './storage';

// ============================================================================
// API Client Class
// ============================================================================

class ApiClient {
  private refreshPromise: Promise<AuthTokens | null> | null = null;

  private async getBaseUrl(): Promise<string> {
    const settings = await getSettings();
    return settings.apiBaseUrl;
  }

  private async getHeaders(includeAuth: boolean = true): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (includeAuth) {
      const tokens = await this.getValidTokens();
      if (tokens) {
        headers['Authorization'] = `Bearer ${tokens.accessToken}`;
      }
    }

    return headers;
  }

  private async getValidTokens(): Promise<AuthTokens | null> {
    const tokens = await getAuthTokens();
    if (!tokens) return null;

    const now = Date.now();
    const bufferMs = 60 * 1000; // 1 minute buffer

    // If token is still valid, return it
    if (tokens.expiresAt > now + bufferMs) {
      return tokens;
    }

    // Token expired or expiring soon, try to refresh
    return this.refreshTokens(tokens.refreshToken);
  }

  private async refreshTokens(refreshToken: string): Promise<AuthTokens | null> {
    // Prevent multiple simultaneous refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.doRefreshTokens(refreshToken);

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async doRefreshTokens(refreshToken: string): Promise<AuthTokens | null> {
    try {
      const baseUrl = await this.getBaseUrl();
      const response = await fetch(`${baseUrl}/api/auth/token/refresh/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (!response.ok) {
        // Refresh token invalid, clear auth
        await clearAuth();
        return null;
      }

      const data = await response.json();

      const newTokens: AuthTokens = {
        accessToken: data.access,
        refreshToken: data.refresh ?? refreshToken, // Some APIs don't rotate refresh tokens
        expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
      };

      await setAuthTokens(newTokens);
      return newTokens;
    } catch (error) {
      console.error('[API] Token refresh failed:', error);
      await clearAuth();
      return null;
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requireAuth: boolean = true
  ): Promise<ApiResponse<T>> {
    try {
      const baseUrl = await this.getBaseUrl();
      const headers = await this.getHeaders(requireAuth);

      const response = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers: {
          ...headers,
          ...(options.headers ?? {}),
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: `HTTP_${response.status}`,
            message: data.detail ?? data.message ?? 'Une erreur est survenue',
          },
        };
      }

      return {
        success: true,
        data: data as T,
      };
    } catch (error) {
      console.error(`[API] Request failed: ${endpoint}`, error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Erreur réseau',
        },
      };
    }
  }

  // ==========================================================================
  // Authentication Endpoints
  // ==========================================================================

  async login(email: string, password: string): Promise<ApiResponse<{ user: User }>> {
    const baseUrl = await this.getBaseUrl();

    try {
      const response = await fetch(`${baseUrl}/api/auth/token/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: `HTTP_${response.status}`,
            message: data.detail ?? 'Identifiants incorrects',
          },
        };
      }

      // Store tokens
      const tokens: AuthTokens = {
        accessToken: data.access,
        refreshToken: data.refresh,
        expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
      };
      await setAuthTokens(tokens);

      // Fetch user info
      const userResponse = await this.getUser();
      if (!userResponse.success || !userResponse.data) {
        return {
          success: false,
          error: {
            code: 'USER_FETCH_FAILED',
            message: 'Impossible de récupérer les informations utilisateur',
          },
        };
      }

      return {
        success: true,
        data: { user: userResponse.data },
      };
    } catch (error) {
      console.error('[API] Login failed:', error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Impossible de se connecter au serveur',
        },
      };
    }
  }

  async logout(): Promise<void> {
    // Optionally call backend logout endpoint
    try {
      await this.request('/api/auth/logout/', { method: 'POST' });
    } catch {
      // Ignore errors, just clear local auth
    }
    await clearAuth();
  }

  async getUser(): Promise<ApiResponse<User>> {
    return this.request<User>('/api/auth/user/');
  }

  // ==========================================================================
  // Job Offer Endpoints
  // ==========================================================================

  async importOffer(request: ImportOfferRequest): Promise<ApiResponse<ImportOfferResponse>> {
    return this.request<ImportOfferResponse>('/api/offers/import/', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getOffers(): Promise<ApiResponse<JobOffer[]>> {
    return this.request<JobOffer[]>('/api/offers/');
  }

  async getOfferMatch(offerId: number): Promise<ApiResponse<MatchResult>> {
    return this.request<MatchResult>(`/api/offers/${offerId}/match/`);
  }

  async deleteOffer(offerId: number): Promise<ApiResponse<void>> {
    return this.request<void>(`/api/offers/${offerId}/`, {
      method: 'DELETE',
    });
  }

  // ==========================================================================
  // Health Check
  // ==========================================================================

  async healthCheck(): Promise<boolean> {
    try {
      const baseUrl = await this.getBaseUrl();
      const response = await fetch(`${baseUrl}/api/health/`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const api = new ApiClient();
