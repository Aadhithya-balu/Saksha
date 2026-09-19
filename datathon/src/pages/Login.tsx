import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Delete,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogIn,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useAuthStore, classifyAuthError } from '../store/authStore';
import { showSecureEntry } from '../components/auth/SecureEntryOverlay';

const formatIstClock = (): string =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());

type AuthStatus = 'idle' | 'verifying' | 'granted' | 'initializing';

interface DemoProfile {
  badge: string;
  pin: string;
  title: string;
  rank: string;
  initials: string;
  tone: 'blue' | 'teal' | 'amber' | 'green';
}

const DEMO_PROFILES: DemoProfile[] = [
  { badge: 'admin', pin: '564738', title: 'Administrator', rank: 'System Administration', initials: 'AD', tone: 'blue' },
  { badge: 'SP-0088', pin: '987654', title: 'Superintendent', rank: 'District Command · SP', initials: 'SP', tone: 'amber' },
  { badge: 'IO-3921', pin: '456789', title: 'Investigator', rank: 'Investigation Officer · DSP', initials: 'IO', tone: 'green' },
  { badge: 'SCRB-7740', pin: '123456', title: 'Analyst', rank: 'Intelligence Analyst · SCRB', initials: 'AN', tone: 'teal' },
];

const TONE_STYLES: Record<DemoProfile['tone'], { color: string; bg: string; border: string }> = {
  blue: { color: 'var(--sx-accent)', bg: 'var(--sx-accent-soft)', border: 'rgba(62, 139, 255, 0.3)' },
  teal: { color: 'var(--sx-teal)', bg: 'var(--sx-teal-soft)', border: 'rgba(45, 212, 191, 0.28)' },
  amber: { color: 'var(--sx-amber)', bg: 'var(--sx-amber-soft)', border: 'rgba(232, 197, 143, 0.28)' },
  green: { color: 'var(--sx-green)', bg: 'var(--sx-green-soft)', border: 'rgba(43, 197, 140, 0.28)' },
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

export const Login: React.FC<{ onSuccess?: () => void }> = ({ onSuccess }) => {
  const login = useAuthStore((state) => state.login);

  const [clock, setClock] = useState(formatIstClock);
  const [method, setMethod] = useState<'badge' | 'password'>('badge');

  const [badgeId, setBadgeId] = useState('');
  const [pin, setPin] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [status, setStatus] = useState<AuthStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pinFocused, setPinFocused] = useState(false);
  const [activeProfile, setActiveProfile] = useState<number | null>(null);

  const pinInputRef = useRef<HTMLInputElement>(null);
  const badgeInputRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<AuthStatus>('idle');
  statusRef.current = status;

  useEffect(() => {
    const timer = window.setInterval(() => setClock(formatIstClock()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (method === 'badge') {
      window.setTimeout(() => badgeInputRef.current?.focus(), 60);
    } else {
      window.setTimeout(() => usernameRef.current?.focus(), 60);
    }
  }, [method]);

  const detectedRole = (() => {
    const uc = badgeId.toUpperCase().trim();
    if (uc.startsWith('SCRB')) return 'SCRB';
    if (uc.startsWith('IO')) return 'IO';
    if (uc.startsWith('SP')) return 'SP';
    return null;
  })();

  const grantSession = (id: string) => {
    setStatus('granted');
    const user = useAuthStore.getState().user;
    window.setTimeout(() => {
      setStatus('initializing');
      showSecureEntry(
        user?.badgeId || id,
        CLEARANCE_LABELS[user?.role || ''] || 'AUTHORIZED'
      );
    }, 550);
    window.setTimeout(() => onSuccess?.(), 1150);
  };

  const submit = useCallback(async () => {
    if (statusRef.current !== 'idle') return;

    if (method === 'password') {
      const cleanUser = username.trim();
      if (!cleanUser) {
        setError('Enter the account username to continue.');
        usernameRef.current?.focus();
        return;
      }
      if (!password) {
        setError('Enter the account password to continue.');
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
        grantSession(cleanUser);
      } else {
        setStatus('idle');
        setPassword('');
        setError(useAuthStore.getState().loginError);
        passwordRef.current?.focus();
      }
      return;
    }

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
      grantSession(cleanBadge);
    } else {
      setStatus('idle');
      setPin('');
      setError(useAuthStore.getState().loginError);
      pinInputRef.current?.focus();
    }
  }, [method, badgeId, pin, username, password, login, grantSession]);

  const handlePinInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPin(digits);
    if (error && digits.length > 0 && digits.length < 6) setError(null);
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

  const switchMethod = (next: 'badge' | 'password') => {
    if (next === method || statusRef.current !== 'idle') return;
    setMethod(next);
    setError(null);
  };

  const busy = status !== 'idle';
  const canSubmitBadge = !busy && badgeId.trim().length > 0 && pin.length === 6;
  const canSubmitPassword = !busy && username.trim().length > 0 && password.length > 0;
  const authError = error ? classifyAuthError(error) : null;

  return (
    <div className="sx-root">
      <div className="sx-bg sx-bg-grid" aria-hidden="true" />
      <svg
        className="sx-bg sx-bg-net"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <g fill="none" stroke="#7E92B0" strokeOpacity="0.05" strokeWidth="1">
          <path d="M-30 160 H150 L205 205 H330" />
          <path d="M-30 200 H120 L195 275 H290 V340" />
          <path d="M1200 140 H1030 L960 210 H830" />
          <path d="M1200 680 H1060 L990 615 H870 V560" />
          <path d="M40 760 H175 L225 710 H340" />
          <path d="M-30 640 H110 L180 575 H300" />
        </g>
        <g fill="#7E92B0" fillOpacity="0.07">
          <circle cx="150" cy="160" r="3" />
          <circle cx="330" cy="205" r="3" />
          <circle cx="290" cy="340" r="3" />
          <circle cx="1030" cy="140" r="3" />
          <circle cx="830" cy="210" r="3" />
          <circle cx="870" cy="560" r="3" />
          <circle cx="175" cy="760" r="3" />
          <circle cx="340" cy="710" r="3" />
          <circle cx="180" cy="575" r="3" />
        </g>
      </svg>
      <div className="sx-bg sx-bg-halo" aria-hidden="true" />

      <header className="sx-topbar">
        <div className="sx-topbar-inner">
          <div className="sx-topbar-left">
            <span className="sx-flag">
              <span className="sx-flag-dot" />
              RESTRICTED ACCESS
            </span>
            <span className="sx-sep" />
            <span className="sx-meta">LAW ENFORCEMENT INTELLIGENCE PLATFORM</span>
          </div>
          <div className="sx-topbar-right">
            <span className="sx-live-dot" />
            <span className="sx-meta">SECURE NODE ONLINE</span>
            <span className="sx-sep" />
            <span className="sx-clock">{clock} IST</span>
          </div>
        </div>
      </header>

      <main className="sx-shell">
        {/* ── LEFT · Branding ── */}
        <section className="sx-brand" aria-label="Platform branding">
          <div className="sx-brand-logo">
            <img
              src="/icons/image.png"
              alt="SAKSHA emblem"
              className="sx-brand-logo-img"
              draggable={false}
            />
          </div>
          <div className="sx-brand-name">SAKSHA</div>
          <div className="sx-brand-trail">TRUTH LEAVES A TRAIL</div>
          <div className="sx-brand-tags">SECURE &bull; INVESTIGATE &bull; SOLVE</div>
          <div className="sx-brand-divider" aria-hidden="true">
            <span className="sx-brand-diamond">◆</span>
          </div>
          <div className="sx-brand-desc">
            <div className="sx-brand-desc-l1">Crime Intelligence &amp; Analytical Platform</div>
            <div className="sx-brand-desc-l2">For Secure Digital Investigation</div>
          </div>
        </section>

        {/* ── RIGHT · Authentication ── */}
        <section className="sx-auth" aria-label="Secure authentication">
          <div className="sx-panel">
            <div className="sx-panel-head">
              <div className="sx-panel-head-left">
                <div className="sx-panel-emblem">
                  <img src="/icons/image.png" alt="" className="sx-panel-emblem-img" draggable={false} />
                </div>
                <div>
                  <h2 className="sx-panel-title">Sign In</h2>
                  <p className="sx-panel-sub">Authorized Personnel Only</p>
                </div>
              </div>
              <div className="sx-secure-pill">
                <span className="sx-secure-pill-dot" />
                Secure Connection
              </div>
            </div>

            <div className="sx-toggle" role="tablist" aria-label="Sign-in method">
              <button
                type="button"
                role="tab"
                id="sx-tab-badge"
                aria-selected={method === 'badge'}
                aria-controls="sx-panel-badge"
                disabled={busy}
                onClick={() => switchMethod('badge')}
                className="sx-tab"
              >
                <BadgeCheck className="sx-tab-icon" />
                Badge ID / PIN
              </button>
              <button
                type="button"
                role="tab"
                id="sx-tab-password"
                aria-selected={method === 'password'}
                aria-controls="sx-panel-password"
                disabled={busy}
                onClick={() => switchMethod('password')}
                className="sx-tab"
              >
                <KeyRound className="sx-tab-icon" />
                Username &amp; Password
              </button>
            </div>

            <form
              className="sx-form"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <div aria-live="polite" className="sx-error-slot">
                {authError && (
                  <div
                    className={`sx-error sx-shake ${authError.tone === 'warning' ? 'sx-error-warn' : ''}`}
                  >
                    {authError.tone === 'warning' ? (
                      <AlertTriangle className="sx-error-icon" />
                    ) : (
                      <AlertCircle className="sx-error-icon" />
                    )}
                    <span>{authError.message}</span>
                  </div>
                )}
              </div>

              {method === 'badge' ? (
                <>
                  <div className="sx-field" id="sx-panel-badge" role="tabpanel" aria-labelledby="sx-tab-badge">
                    <label htmlFor="saksha-badge-id" className="sx-label">
                      Police Badge ID
                    </label>
                    <div className="sx-input-wrap">
                      <ShieldCheck className="sx-input-icon" />
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
                        className="sx-input sx-input-badge"
                      />
                      {detectedRole && !busy && (
                        <span className="sx-role-chip">
                          <UserRound className="sx-role-chip-icon" />
                          {detectedRole}
                        </span>
                      )}
                    </div>
                    <div className="sx-fips">
                      <span className="sx-fips-dot" />
                      Connection: FIPS Compliant &amp; Encrypted
                    </div>
                  </div>

                  <div className="sx-field">
                    <div className="sx-pin-head">
                      <label htmlFor="saksha-pin-input" className="sx-label">
                        Authentication PIN
                      </label>
                      <span className="sx-pin-meta">{pin.length}/6</span>
                    </div>

                    <div
                      className="sx-cells-wrap"
                      onClick={() => pinInputRef.current?.focus()}
                      role="group"
                      aria-label="6-digit authentication PIN entry"
                    >
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
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void submit();
                          }
                        }}
                        onFocus={() => setPinFocused(true)}
                        onBlur={() => setPinFocused(false)}
                        className="sx-pin-input-hidden"
                        tabIndex={0}
                      />
                      <div className="sx-cells" aria-hidden="true">
                        {Array.from({ length: 6 }).map((_, i) => {
                          const filled = i < pin.length;
                          const active = i === pin.length && pinFocused && !busy;
                          return (
                            <div
                              key={i}
                              className={`sx-cell ${filled ? 'sx-cell-filled' : ''} ${active ? 'sx-cell-active' : ''}`}
                            >
                              {filled && <span className="sx-cell-dot" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <p className="sx-hint">
                      <BadgeCheck className="sx-hint-icon" />
                      Format: 6-digit numeric PIN (e.g. 123456)
                    </p>
                  </div>

                  <div role="group" aria-label="PIN keypad" className="sx-keypad">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                      <button
                        key={num}
                        type="button"
                        aria-label={`Digit ${num}`}
                        disabled={busy}
                        onClick={() => pressDigit(num)}
                        className="sx-key"
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      type="button"
                      aria-label="Clear PIN"
                      disabled={busy || pin.length === 0}
                      onClick={clearPin}
                      className="sx-key sx-key-util"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      aria-label="Digit 0"
                      disabled={busy}
                      onClick={() => pressDigit(0)}
                      className="sx-key"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      aria-label="Delete last digit"
                      disabled={busy || pin.length === 0}
                      onClick={backspace}
                      className="sx-key sx-key-util"
                    >
                      <Delete className="sx-key-icon" />
                    </button>
                  </div>

                  <div className="sx-profiles">
                    <div className="sx-profiles-title">
                      <span className="sx-profiles-title-text">Authorized Profile Access</span>
                      <span className="sx-profiles-demo">Demo</span>
                      <div className="sx-profiles-rail" />
                    </div>
                    <div className="sx-profiles-grid">
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
                            className={`sx-profile ${selected ? 'sx-profile-active' : ''}`}
                          >
                            <span
                              className="sx-profile-tile"
                              style={{ background: tone.bg, color: tone.color, border: `1px solid ${tone.border}` }}
                            >
                              {profile.initials}
                            </span>
                            <span className="sx-profile-badge">{profile.badge}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="sx-field" id="sx-panel-password" role="tabpanel" aria-labelledby="sx-tab-password">
                    <label htmlFor="saksha-account-username" className="sx-label">
                      Account Username
                    </label>
                    <div className="sx-input-wrap">
                      <UserRound className="sx-input-icon" />
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
                        className="sx-input"
                      />
                    </div>
                  </div>

                  <div className="sx-field">
                    <label htmlFor="saksha-account-password" className="sx-label">
                      Password
                    </label>
                    <div className="sx-input-wrap">
                      <KeyRound className="sx-input-icon" />
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
                        className="sx-input sx-input-pw"
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        disabled={busy}
                        onClick={() => setShowPassword((s) => !s)}
                        className="sx-input-toggle"
                      >
                        {showPassword ? (
                          <EyeOff className="sx-input-toggle-icon" />
                        ) : (
                          <Eye className="sx-input-toggle-icon" />
                        )}
                      </button>
                    </div>
                    <div className="sx-fips">
                      <span className="sx-fips-dot" />
                      Connection: FIPS Compliant &amp; Encrypted
                    </div>
                  </div>

                  <p className="sx-note">
                    For accounts provisioned by an administrator, use the username and
                    temporary password issued at creation. You can change it later from Settings.
                  </p>
                </>
              )}

              <button
                type="submit"
                disabled={method === 'badge' ? !canSubmitBadge : !canSubmitPassword}
                className={`sx-cta ${status === 'granted' ? 'sx-cta-granted' : ''}`}
              >
                {status === 'idle' && (
                  <>
                    {method === 'badge' ? <BadgeCheck className="sx-cta-icon" /> : <LogIn className="sx-cta-icon" />}
                    {method === 'badge' ? 'Authenticate & Enter' : 'Sign In'}
                    {method === 'badge' && <ArrowRight className="sx-cta-icon sx-cta-arrow" />}
                  </>
                )}
                {status === 'verifying' && (
                  <>
                    <Loader2 className="sx-cta-icon sx-cta-spin" />
                    Verifying Credentials&hellip;
                  </>
                )}
                {status === 'granted' && (
                  <>
                    <ShieldCheck className="sx-cta-icon" />
                    Identity Verified
                  </>
                )}
                {status === 'initializing' && (
                  <>
                    <Loader2 className="sx-cta-icon sx-cta-spin" />
                    Secure Session Initializing&hellip;
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="sx-auth-foot">Transitioning manual logs securely online.</p>
        </section>
      </main>
    </div>
  );
};

export default Login;