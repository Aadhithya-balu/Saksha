import { create } from 'zustand';
import {
  clearStoredTokens,
  getMe,
  getStoredTokens,
  login as loginRequest,
  logout as logoutRequest,
  mapBackendRoleToUiRole,
  refreshSession,
  setStoredTokens,
} from '../services/api';

export type UserRole = 'SCRB' | 'IO' | 'SP' | 'INSPECTOR' | 'FORENSIC' | 'VIEWER' | 'ADMIN';

export type AuthErrorTone = 'error' | 'warning';

export interface AuthErrorBox {
  message: string;
  tone: AuthErrorTone;
}

/** Translate raw backend/store failures into calm, human language and pick a
 *  UI tone. Lockout and attempts-remaining messages pass through as warnings
 *  so operators see the real account state instead of a generic rejection. */
export const classifyAuthError = (raw: string | null): AuthErrorBox => {
  const msg = (raw || '').toLowerCase();
  if (!msg) return { message: 'Authentication failed. Please try again.', tone: 'error' };
  if (
    msg.includes('temporarily unavailable') ||
    msg.includes('offline') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed') ||
    msg.includes('aborted')
  ) {
    return {
      message: 'The secure authentication service is temporarily unavailable. Please try again shortly.',
      tone: 'error',
    };
  }
  if (msg.includes('session expired')) {
    return { message: 'Your session could not be restored. Please authenticate again.', tone: 'error' };
  }
  if (msg.includes('locked') || msg.includes('lockout') || msg.includes('attempt')) {
    return { message: raw as string, tone: 'warning' };
  }
  if (msg.includes('too many requests')) {
    return { message: raw as string, tone: 'warning' };
  }
  return { message: raw || 'Authentication failed. Please try again.', tone: 'error' };
};

export interface UserSession {
  name: string;
  badgeId: string;
  role: UserRole;
  district?: string | null;
  station?: string | null;
}

interface AuthState {
  user: UserSession | null;
  isAuthenticated: boolean;
  loginError: string | null;
  sessionTimeRemaining: number;
  isHydrating: boolean;
  initializeSession: () => Promise<void>;
  login: (badgeId: string, pin: string) => Promise<boolean>;
  logout: (expired?: boolean) => void;
  tickSession: () => void;
  resetSessionTimer: () => void;
  updateUser: (patch: Partial<UserSession>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  loginError: null,
  sessionTimeRemaining: 1800, // 30 minutes
  isHydrating: true,

  initializeSession: async () => {
    const hydrateFromBackendUser = async () => {
      const currentUser = await getMe();
      set({
        user: {
          name: currentUser.full_name,
          badgeId: currentUser.username,
          role: mapBackendRoleToUiRole(currentUser.role),
          district: currentUser.district,
          station: currentUser.station,
        },
        isAuthenticated: true,
        loginError: null,
        sessionTimeRemaining: 1800,
        isHydrating: false,
      });
    };

    const { accessToken, refreshToken } = getStoredTokens();

    if (!accessToken && !refreshToken) {
      set({ user: null, isAuthenticated: false, loginError: null, isHydrating: false });
      return;
    }

    try {
      if (accessToken) {
        await hydrateFromBackendUser();
        return;
      }

      const tokens = await refreshSession(refreshToken);
      setStoredTokens({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
      await hydrateFromBackendUser();
    } catch {
      if (refreshToken) {
        try {
          const tokens = await refreshSession(refreshToken);
          setStoredTokens({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
          await hydrateFromBackendUser();
          return;
        } catch {
          clearStoredTokens();
        }
      } else {
        clearStoredTokens();
      }
      set({ user: null, isAuthenticated: false, loginError: null, isHydrating: false });
    }
  },

  login: async (badgeId: string, pin: string) => {
    // Use the input as-is (case-sensitive DB lookup; seed data uses lowercase 'admin')
    const cleanId = badgeId.trim();
    const cleanPin = pin.trim();

    try {
      const tokens = await loginRequest(cleanId, cleanPin);
      setStoredTokens({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token });

      const currentUser = await getMe();
      set({
        user: {
          name: currentUser.full_name,
          badgeId: currentUser.username,
          role: mapBackendRoleToUiRole(currentUser.role),
          district: currentUser.district,
          station: currentUser.station,
        },
        isAuthenticated: true,
        loginError: null,
        sessionTimeRemaining: tokens.expires_in || 1800,
      });
      return true;
    } catch (error) {
      clearStoredTokens();
      const message = error instanceof Error ? error.message : 'Access Denied: Invalid Badge ID or PIN.';
      set({
        loginError: message.includes('temporarily unavailable')
          ? 'Backend database is offline. Start PostgreSQL and Neo4j, then retry login.'
          : message,
      });
      return false;
    }
  },

  logout: (expired = false) => {
    const { accessToken } = getStoredTokens();
    if (accessToken) {
      void logoutRequest().catch(() => undefined);
    }
    clearStoredTokens();
    set({ user: null, isAuthenticated: false, sessionTimeRemaining: 1800, loginError: expired ? 'Session Expired: Please log in again.' : null });
    // Always navigate to /login so the protected URL is never visible after logout
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:navigate-login'));
    }
  },

  tickSession: () => {
    const current = get().sessionTimeRemaining;
    if (current <= 1) {
      get().logout(true);
    } else {
      set({ sessionTimeRemaining: current - 1 });
    }
  },

  resetSessionTimer: () => {
    if (get().isAuthenticated) {
      set({ sessionTimeRemaining: 1800 });
    }
  },

  updateUser: (patch: Partial<UserSession>) => {
    const current = get().user;
    if (current) set({ user: { ...current, ...patch } });
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('auth:session-expired', () => {
    useAuthStore.getState().logout(true);
  });
}
