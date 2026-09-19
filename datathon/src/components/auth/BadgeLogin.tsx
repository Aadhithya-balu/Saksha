import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldCheck,
  Delete,
  Loader2,
  AlertCircle,
  AlertTriangle,
  UserRound,
  BadgeCheck,
  ArrowRight,
} from 'lucide-react';
import { useAuthStore, classifyAuthError } from '../../store/authStore';
import { showSecureEntry } from './SecureEntryOverlay';

interface BadgeLoginProps {
  onSuccess: () => void;
}

type AuthStatus = 'idle' | 'verifying' | 'granted' | 'initializing';

interface DemoProfile {
  badge: string;
  pin: string;
  title: string;
  rank: string;
  initials: string;
  tone: 'blue' | 'teal' | 'amber' | 'green';
}

/* Demo access profiles — always shown on the login card so reviewers can
   sign in instantly with the seeded demo users. They work in any environment,
   including deployed production builds, because the seed users are part of
   the app. */
const DEMO_PROFILES: DemoProfile[] = [
  { badge: 'admin', pin: '564738', title: 'Administrator', rank: 'System Administration', initials: 'AD', tone: 'blue' },
  { badge: 'SP-0088', pin: '987654', title: 'Superintendent', rank: 'District Command · SP', initials: 'SP', tone: 'amber' },
  { badge: 'IO-3921', pin: '456789', title: 'Investigator', rank: 'Investigation Officer · DSP', initials: 'IO', tone: 'green' },
  { badge: 'SCRB-7740', pin: '123456', title: 'Analyst', rank: 'Intelligence Analyst · SCRB', initials: 'AN', tone: 'teal' },
];

const TONE_STYLES: Record<DemoProfile['tone'], { color: string; bg: string; border: string }> = {
  blue: { color: 'var(--lx-accent-hi)', bg: 'var(--lx-accent-soft)', border: 'var(--lx-border-strong)' },
  teal: { color: 'var(--lx-teal)', bg: 'var(--lx-teal-soft)', border: 'rgba(20, 184, 166, 0.3)' },
  amber: { color: 'var(--lp-amber)', bg: 'var(--lp-amber-soft)', border: 'rgba(245, 158, 11, 0.3)' },
  green: { color: 'var(--lx-success)', bg: 'var(--lp-green-soft)', border: 'rgba(16, 185, 129, 0.3)' },
};

const CLEARANCE_LABELS: Record<string, string> = {
  ADMIN: 'SYSTEM ADMINISTRATOR',
  SP: 'SUPERINTENDENT OF POLICE',
  INSPECTOR: 'POLICE INSPECTOR',
  IO: 'INVESTIGATION OFFICER',
  SCRB: 'INTELLIGENCE ANALYST',
  FORENSIC: 'FORENSIC SERVICES',
  VIEWER: 'OBSERVER ACCESS',
};

export const BadgeLogin: React.FC<BadgeLoginProps> = ({ onSuccess }) => {
  const login = useAuthStore((state) => state.login);

  const [badgeId, setBadgeId] = useState('');
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState<AuthStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pinFocused, setPinFocused] = useState(false);
  const [activeProfile, setActiveProfile] = useState<number | null>(null);

  const pinInputRef = useRef<HTMLInputElement>(null);
  const badgeInputRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<AuthStatus>('idle');
  statusRef.current = status;

  /* Role hint while typing a badge id */
  const detectedRole = (() => {
    const uc = badgeId.toUpperCase().trim();
    if (uc.startsWith('SCRB')) return 'SCRB';
    if (uc.startsWith('IO')) return 'IO';
    if (uc.startsWith('SP')) return 'SP';
    return null;
  })();

  const submit = useCallback(async () => {
    if (statusRef.current !== 'idle') return;

    const cleanBadge = badgeId.trim();
    if (!cleanBadge) {
      setError('Enter your authorized Badge ID to continue.');
      badgeInputRef.current?.focus();
      return;
    }
    if (pin.length < 6) {
      setError('Enter the complete 6-digit authentication PIN.');
      pinInputRef.current?.focus();
      return;
    }

    setError(null);
    setStatus('verifying');

    let ok = false;
    try {
      ok = await login(cleanBadge, pin);
    } catch {
      ok = false;
    }

    if (ok) {
      setStatus('granted');
      const user = useAuthStore.getState().user;
      window.setTimeout(() => {
        setStatus('initializing');
        showSecureEntry(
          user?.badgeId || cleanBadge,
          CLEARANCE_LABELS[user?.role || ''] || 'AUTHORIZED'
        );
      }, 550);
      window.setTimeout(() => onSuccess(), 1150);
    } else {
      setStatus('idle');
      setPin('');
      setError(useAuthStore.getState().loginError);
      pinInputRef.current?.focus();
    }
  }, [badgeId, pin, login, onSuccess]);

  /* Preserve legacy behaviour: authenticate automatically once 6 digits are entered. */
  useEffect(() => {
    if (pin.length === 6 && status === 'idle') {
      void submit();
    }
  }, [pin]);

  useEffect(() => {
    badgeInputRef.current?.focus();
  }, []);

  const handlePinInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPin(digits);
    if (error && digits.length > 0 && digits.length < 6) setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void submit();
    }
  };

  const pressDigit = useCallback((digit: number) => {
    if (statusRef.current !== 'idle') return;
    setPin((prev) => (prev.length < 6 ? prev + String(digit) : prev));
    setError(null);
  }, []);

  const backspace = useCallback(() => {
    if (statusRef.current !== 'idle') return;
    setPin((prev) => prev.slice(0, -1));
  }, []);

  const clearPin = useCallback(() => {
    if (statusRef.current !== 'idle') return;
    setPin('');
    pinInputRef.current?.focus();
  }, []);

  const applyProfile = (profile: DemoProfile, index: number) => {
    if (statusRef.current !== 'idle') return;
    setBadgeId(profile.badge);
    setPin('');
    setError(null);
    setActiveProfile(index);
    window.setTimeout(() => setPin(profile.pin), 120);
    window.setTimeout(() => setActiveProfile(null), 1400);
    pinInputRef.current?.focus();
  };

  const busy = status !== 'idle';

  const authError = error ? classifyAuthError(error) : null;

  const cellBorder = (filled: boolean, active: boolean): React.CSSProperties => ({
    background: active ? 'var(--lx-accent-soft)' : 'var(--lx-field)',
    borderColor: filled || active ? 'var(--lx-accent)' : 'var(--lx-border)',
    boxShadow: active ? 'var(--lx-focus)' : 'none',
  });

  return (
    <form className="lx-form flex w-full flex-col text-left" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
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

      {/* Police Badge ID */}
      <div className="lx-field">
        <label htmlFor="saksha-badge-id" className="lx-label">
          Police Badge ID
        </label>
        <div className="lx-input-wrap">
          <ShieldCheck className="lx-input-icon h-[18px] w-[18px]" />
          <input
            ref={badgeInputRef}
            id="saksha-badge-id"
            type="text"
            autoComplete="username"
            spellCheck={false}
            placeholder="Enter authorized badge ID"
            value={badgeId}
            disabled={busy}
            onChange={(e) => {
              setBadgeId(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                pinInputRef.current?.focus();
              }
            }}
            className="lx-input pr-24"
          />
          {detectedRole && !busy && (
            <span className="lx-role-chip">
              <UserRound className="h-3 w-3" />
              {detectedRole}
            </span>
          )}
        </div>
      </div>

      {/* 6-Digit PIN — individual secure cells */}
      <div className="lx-field">
        <div className="lx-field-head">
          <label htmlFor="saksha-pin-input" className="lx-label">
            Authentication PIN
          </label>
          <span className="lx-pin-meta">{pin.length}/6</span>
        </div>

        <div
          className="relative cursor-text"
          onClick={() => pinInputRef.current?.focus()}
          role="group"
          aria-label="6-digit authentication PIN entry"
        >
          {/* Real input captures keyboard, paste and mobile keypads */}
          <input
            ref={pinInputRef}
            id="saksha-pin-input"
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={pin}
            disabled={busy}
            onChange={handlePinInput}
            onKeyDown={handleKeyDown}
            onFocus={() => setPinFocused(true)}
            onBlur={() => setPinFocused(false)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            tabIndex={0}
          />
          <div className="pointer-events-none lx-cells" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => {
              const filled = i < pin.length;
              const active = i === pin.length && pinFocused && !busy;
              return (
                <div
                  key={i}
                  className={`lx-cell ${active ? 'lx-cell-active' : ''}`}
                  style={cellBorder(filled, active)}
                >
                  {filled && <span className="lx-cell-dot" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* PIN format hint */}
      <p className="lx-hint -mt-1">
        <BadgeCheck className="h-3 w-3 shrink-0" style={{ color: 'var(--lx-accent-hi)' }} />
        Format: 6-digit numeric PIN (e.g. 123456)
      </p>

      {/* Secure numeric keypad */}
      <div role="group" aria-label="PIN keypad" className="lx-keypad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            type="button"
            aria-label={`Digit ${num}`}
            disabled={busy}
            onClick={() => pressDigit(num)}
            className="lx-key"
          >
            {num}
          </button>
        ))}

        <button
          type="button"
          aria-label="Clear PIN"
          disabled={busy || pin.length === 0}
          onClick={clearPin}
          className="lx-key lx-key-util"
          style={{ color: 'var(--lx-restricted)' }}
        >
          Clear
        </button>

        <button
          type="button"
          aria-label="Digit 0"
          disabled={busy}
          onClick={() => pressDigit(0)}
          className="lx-key"
        >
          0
        </button>

        <button
          type="button"
          aria-label="Delete last digit"
          disabled={busy || pin.length === 0}
          onClick={backspace}
          className="lx-key lx-key-util"
        >
          <Delete className="h-[18px] w-[18px]" />
        </button>
      </div>

      {/* Primary gateway action */}
      <button
        type="submit"
        disabled={busy || !badgeId.trim() || pin.length < 6}
        className={`lx-cta ${status === 'granted' ? 'lx-cta-granted' : ''}`}
      >
        <span className="flex items-center justify-center gap-2.5">
          {status === 'idle' && (
            <>
              <BadgeCheck className="h-[18px] w-[18px]" strokeWidth={2} />
              Authenticate &amp; Enter
              <ArrowRight className="h-4 w-4" />
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

      {/* Authorized access profiles — seeded demo users, always available */}
      {DEMO_PROFILES.length > 0 && (
        <div className="pt-1">
          <div className="lx-profiles-title">
            <span className="lx-profiles-title-text">Access Profiles</span>
            <span className="lx-profiles-demo">Demo</span>
            <div className="lx-profiles-rail" />
          </div>

          <div className="lx-profiles">
            {DEMO_PROFILES.map((profile, index) => {
              const tone = TONE_STYLES[profile.tone];
              const selected = activeProfile === index;
              return (
                <button
                  key={profile.badge}
                  type="button"
                  disabled={busy}
                  onClick={() => applyProfile(profile, index)}
                  aria-label={`Use demo profile ${profile.title}, ${profile.badge} — ${profile.rank}`}
                  title={`${profile.title} · ${profile.rank}`}
                  className={`lx-profile ${selected ? 'lx-profile-active' : ''}`}
                >
                  <span
                    className="lx-profile-tile"
                    style={{ background: tone.bg, color: tone.color, border: `1px solid ${tone.border}` }}
                  >
                    {profile.initials}
                  </span>
                  <span className="lx-profile-badge">{profile.badge}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </form>
  );
};

export default BadgeLogin;