import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BadgeCheck, KeyRound, Fingerprint, ShieldCheck, Lock, CheckCircle2 } from 'lucide-react';
import SecureBackdrop from '../components/auth/SecureBackdrop';
import IntelligenceIllustration from '../components/auth/IntelligenceIllustration';
import BadgeLogin from '../components/auth/BadgeLogin';
import PasswordLogin from '../components/auth/PasswordLogin';

const formatIstClock = (): string =>
  `${new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date())}`;

const SECURITY_INDICATORS: { icon: React.ElementType; label: string }[] = [
  { icon: Lock, label: 'Encrypted Access' },
  { icon: CheckCircle2, label: 'Audited Sessions' },
  { icon: ShieldCheck, label: 'Secure Connection' },
];

export const Login: React.FC<{ onSuccess?: () => void }> = ({ onSuccess }) => {
  const [clock, setClock] = useState(formatIstClock);
  const [method, setMethod] = useState<'badge' | 'password'>('badge');

  useEffect(() => {
    const timer = window.setInterval(() => setClock(formatIstClock()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const secure = useMemo(
    () => typeof window !== 'undefined' && window.location.protocol === 'https:',
    []
  );

  return (
    <div className="login-root">
      <SecureBackdrop />

      {/* ── Minimal status bar ── */}
      <header className="lx-bar">
        <div className="lx-bar-inner">
          <div className="lx-bar-group">
            <span className="lx-bar-red">RESTRICTED</span>
            <span className="lx-bar-sep" aria-hidden="true" />
            <span className="lx-bar-text">LAW ENFORCEMENT INTELLIGENCE</span>
          </div>
          <div className="lx-bar-group">
            <span className="lx-status-dot" aria-hidden="true" />
            <span className="lx-bar-text">SECURE NODE ONLINE</span>
            <span className="lx-bar-sep" aria-hidden="true" />
            <span className="lx-bar-clock">{clock} IST</span>
          </div>
        </div>
      </header>

      <main className="lx-shell">
        {/* ── LEFT · Secure authentication ── */}
        <section className="lx-auth" aria-label="Secure access">
          {/* Brand */}
          <div className="lx-brand">
            <div className="lx-brand-mark">
              <img src="/logo.svg" alt="" className="h-[62%] w-[62%]" draggable={false} />
            </div>
            <div className="min-w-0">
              <h1 className="lx-brand-name">SAKSHA</h1>
              <p className="lx-brand-tagline">Crime Intelligence &amp; Analytical Platform</p>
            </div>
          </div>

          {/* Compact core — stacked on mobile */} 
          <div className="lx-core-mobile">
            <div className="lx-core-mobile-canvas">
              <IntelligenceIllustration className="h-full w-full" />
            </div>
          </div>

          {/* Secure access heading */}
          <div className="lx-secure-head">
            <div>
              <span className="lx-eyebrow">SECURE ACCESS</span>
              <p className="lx-eyebrow-sub">AUTHORIZED PERSONNEL ONLY</p>
            </div>
            <span className="lx-live">
              <span className="lx-live-dot" aria-hidden="true" />
              {secure ? 'ENCRYPTED' : 'LOCAL'}
            </span>
          </div>

          {/* Access method toggle */}
          <div className="lx-tabs" role="tablist" aria-label="Sign-in method">
            <button
              type="button"
              role="tab"
              aria-selected={method === 'badge'}
              onClick={() => setMethod('badge')}
              className="lx-tab"
            >
              <BadgeCheck className="h-4 w-4" />
              Badge ID / PIN
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={method === 'password'}
              onClick={() => setMethod('password')}
              className="lx-tab"
            >
              <KeyRound className="h-4 w-4" />
              Username
            </button>
          </div>

          {/* Auth forms */}
          <motion.div
            key={method}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="lx-form-wrap"
          >
            {method === 'badge' ? (
              <BadgeLogin onSuccess={() => onSuccess?.()} />
            ) : (
              <PasswordLogin onSuccess={() => onSuccess?.()} />
            )}
          </motion.div>

          {/* Security indicators */}
          <div className="lx-secure-foot" role="note">
            {SECURITY_INDICATORS.map(({ icon: Icon, label }) => (
              <span key={label} className="lx-secure-chip">
                <Icon className="lx-secure-chip-icon" />
                {label}
              </span>
            ))}
          </div>
        </section>

        {/* ── RIGHT · SAKSHA Intelligence Core ── */}
        <section className="lx-core" aria-hidden="true">
          <div className="lx-core-stage">
            <IntelligenceIllustration className="h-full w-full" />
          </div>
          <div className="lx-core-mark">
            <Fingerprint className="h-3.5 w-3.5" />
            SAKSHA &middot; CRIME INTELLIGENCE &amp; ANALYTICAL PLATFORM
          </div>
        </section>
      </main>
    </div>
  );
};

export default Login;