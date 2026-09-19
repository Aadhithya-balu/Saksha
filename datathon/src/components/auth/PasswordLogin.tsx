import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  UserRound,
  KeyRound,
  Loader2,
  AlertCircle,
  AlertTriangle,
  LogIn,
  ShieldCheck,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuthStore, classifyAuthError } from '../../store/authStore';
import { showSecureEntry } from './SecureEntryOverlay';

interface PasswordLoginProps {
  onSuccess: () => void;
}

type AuthStatus = 'idle' | 'verifying' | 'granted' | 'initializing';

const CLEARANCE_LABELS: Record<string, string> = {
  ADMIN: 'SYSTEM ADMINISTRATOR',
  SP: 'SUPERINTENDENT OF POLICE',
  INSPECTOR: 'POLICE INSPECTOR',
  IO: 'INVESTIGATION OFFICER',
  SCRB: 'INTELLIGENCE ANALYST',
  FORENSIC: 'FORENSIC SERVICES',
  VIEWER: 'OBSERVER ACCESS',
};

export const PasswordLogin: React.FC<PasswordLoginProps> = ({ onSuccess }) => {
  const login = useAuthStore((state) => state.login);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<AuthStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<AuthStatus>('idle');
  statusRef.current = status;

  const submit = useCallback(async () => {
    if (statusRef.current !== 'idle') return;

    const cleanUser = username.trim();
    if (!cleanUser) {
      setError('Enter the account username.');
      usernameRef.current?.focus();
      return;
    }
    if (!password) {
      setError('Enter the account password.');
      passwordRef.current?.focus();
      return;
    }

    setError(null);
    setStatus('verifying');

    let ok = false;
    try {
      ok = await login(cleanUser, password);
    } catch {
      ok = false;
    }

    if (ok) {
      setStatus('granted');
      const user = useAuthStore.getState().user;
      window.setTimeout(() => {
        setStatus('initializing');
        showSecureEntry(
          user?.badgeId || cleanUser,
          CLEARANCE_LABELS[user?.role || ''] || 'AUTHORIZED'
        );
      }, 550);
      window.setTimeout(() => onSuccess(), 1150);
    } else {
      setStatus('idle');
      setPassword('');
      setError(useAuthStore.getState().loginError);
      passwordRef.current?.focus();
    }
  }, [username, password, login, onSuccess]);

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  const busy = status !== 'idle';

  const authError = error ? classifyAuthError(error) : null;

  return (
    <form
      className="lx-form flex w-full flex-col text-left"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {/* Live region for validation / auth errors */}
      <div aria-live="polite" className="lx-error-slot flex items-start">
        {authError && (
          <div
            className={`lx-error lp-shake ${authError.tone === 'warning' ? 'lx-error-warn' : ''} w-full`}
          >
            {authError.tone === 'warning' ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <span>{authError.message}</span>
          </div>
        )}
      </div>

      {/* Account username */}
      <div className="lx-field">
        <label htmlFor="saksha-account-username" className="lx-label">
          Account Username
        </label>
        <div className="lx-input-wrap">
          <UserRound className="lx-input-icon h-[18px] w-[18px]" />
          <input
            ref={usernameRef}
            id="saksha-account-username"
            type="text"
            autoComplete="username"
            spellCheck={false}
            placeholder="Enter account username"
            value={username}
            disabled={busy}
            onChange={(e) => {
              setUsername(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                passwordRef.current?.focus();
              }
            }}
            className="lx-input pr-3"
          />
        </div>
      </div>

      {/* Password */}
      <div className="lx-field">
        <label htmlFor="saksha-account-password" className="lx-label">
          Password
        </label>
        <div className="lx-input-wrap">
          <KeyRound className="lx-input-icon h-[18px] w-[18px]" />
          <input
            ref={passwordRef}
            id="saksha-account-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            spellCheck={false}
            placeholder="Enter account password"
            value={password}
            disabled={busy}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void submit();
              }
            }}
            className="lx-input pr-12"
          />
          <button
            type="button"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            disabled={busy}
            onClick={() => setShowPassword((s) => !s)}
            className="lx-input-toggle"
          >
            {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
          </button>
        </div>
        <p className="lx-hint">
          <KeyRound className="h-3 w-3 shrink-0" style={{ color: 'var(--lx-accent-hi)' }} />
          Format: 8+ characters with letters &amp; number — or a 6-digit numeric PIN
        </p>
      </div>

      {/* Primary gateway action */}
      <button
        type="submit"
        disabled={busy || !username.trim() || !password}
        className={`lx-cta ${status === 'granted' ? 'lx-cta-granted' : ''}`}
      >
        <span className="flex items-center justify-center gap-2.5">
          {status === 'idle' && (
            <>
              <LogIn className="h-[18px] w-[18px]" strokeWidth={2} />
              Sign In
            </>
          )}
          {status === 'verifying' && (
            <>
              <Loader2 className="h-[18px] w-[18px] animate-spin" />
              Verifying Credentials…
            </>
          )}
          {status === 'granted' && (
            <>
              <ShieldCheck className="h-[18px] w-[18px]" />
              Identity Verified
            </>
          )}
          {status === 'initializing' && (
            <>
              <Loader2 className="h-[18px] w-[18px] animate-spin" />
              Secure Session Initializing…
            </>
          )}
        </span>
      </button>

      <p className="lx-hint">
        For accounts provisioned by an administrator, use the username and temporary
        password issued at creation. You can change it later from Settings.
      </p>
    </form>
  );
};

export default PasswordLogin;