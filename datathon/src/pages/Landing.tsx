import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  BookOpen,
  Menu,
  X,
  ChevronDown,
  Crosshair,
  Fingerprint,
  Network,
  FileText,
} from 'lucide-react';
import SecureBackdrop from '../components/auth/SecureBackdrop';

const navFor = (path: string) =>
  `${(import.meta.env.BASE_URL || '/').replace(/\/+$/, '') || ''}${path}`;

/* ─── Theme-adaptive SVG paint tokens ─── */
const LS_STROKE = {
  contour: 'var(--ls-svg-stroke-contour)',
  grid: 'var(--ls-svg-stroke-grid)',
  blue: 'var(--ls-svg-stroke-line-blue)',
  teal: 'var(--ls-svg-stroke-line-teal)',
  dash: 'var(--ls-svg-stroke-dash)',
};
const LS_FILL = {
  primary: 'var(--ls-svg-fill-primary)',
  teal: 'var(--ls-svg-fill-teal)',
  micro: 'var(--ls-svg-fill-micro)',
};

/* ─── Abstract Intelligence Visualization (SVG) ─── */
const IntelligenceVisual: React.FC = () => (
  <svg
    viewBox="0 0 500 420"
    fill="none"
    className="w-full h-auto max-w-[420px] sm:max-w-[460px]"
    aria-hidden="true"
  >
    {/* Faint topographic contour lines */}
    <ellipse cx="250" cy="210" rx="200" ry="170" stroke={LS_STROKE.contour} strokeWidth="0.5" opacity="0.3" />
    <ellipse cx="250" cy="210" rx="160" ry="135" stroke={LS_STROKE.contour} strokeWidth="0.5" opacity="0.25" />
    <ellipse cx="250" cy="210" rx="120" ry="100" stroke={LS_STROKE.contour} strokeWidth="0.5" opacity="0.2" />
    <ellipse cx="250" cy="210" rx="80" ry="65" stroke={LS_STROKE.contour} strokeWidth="0.5" opacity="0.15" />

    {/* Grid lines — extremely faint */}
    {[60, 120, 180, 240, 300, 360, 420].map((x) => (
      <line key={`gv${x}`} x1={x} y1="0" x2={x} y2="420" stroke={LS_STROKE.grid} strokeWidth="0.4" opacity="0.25" />
    ))}
    {[60, 120, 180, 240, 300, 360].map((y) => (
      <line key={`gh${y}`} x1="0" y1={y} x2="500" y2={y} stroke={LS_STROKE.grid} strokeWidth="0.4" opacity="0.25" />
    ))}

    {/* Connection lines between nodes */}
    <line x1="120" y1="140" x2="200" y2="100" stroke={LS_STROKE.blue} strokeWidth="1" opacity="0.18" />
    <line x1="200" y1="100" x2="310" y2="130" stroke={LS_STROKE.blue} strokeWidth="1" opacity="0.15" />
    <line x1="310" y1="130" x2="380" y2="80" stroke={LS_STROKE.blue} strokeWidth="1" opacity="0.12" />
    <line x1="200" y1="100" x2="250" y2="210" stroke={LS_STROKE.teal} strokeWidth="1" opacity="0.16" />
    <line x1="250" y1="210" x2="320" y2="260" stroke={LS_STROKE.blue} strokeWidth="1" opacity="0.14" />
    <line x1="250" y1="210" x2="150" y2="280" stroke={LS_STROKE.teal} strokeWidth="1" opacity="0.15" />
    <line x1="150" y1="280" x2="100" y2="340" stroke={LS_STROKE.blue} strokeWidth="1" opacity="0.12" />
    <line x1="320" y1="260" x2="400" y2="310" stroke={LS_STROKE.blue} strokeWidth="1" opacity="0.1" />
    <line x1="320" y1="260" x2="280" y2="350" stroke={LS_STROKE.teal} strokeWidth="1" opacity="0.13" />
    <line x1="120" y1="140" x2="150" y2="280" stroke={LS_STROKE.blue} strokeWidth="0.8" opacity="0.1" />
    <line x1="380" y1="80" x2="420" y2="160" stroke={LS_STROKE.teal} strokeWidth="0.8" opacity="0.1" />
    <line x1="420" y1="160" x2="400" y2="310" stroke={LS_STROKE.blue} strokeWidth="0.8" opacity="0.08" />
    <line x1="100" y1="340" x2="280" y2="350" stroke={LS_STROKE.contour} strokeWidth="0.6" opacity="0.12" />

    {/* Secondary dashed lines */}
    <line x1="250" y1="210" x2="420" y2="160" stroke={LS_STROKE.dash} strokeWidth="0.5" strokeDasharray="4 4" opacity="0.15" />
    <line x1="120" y1="140" x2="250" y2="210" stroke={LS_STROKE.dash} strokeWidth="0.5" strokeDasharray="4 4" opacity="0.12" />

    {/* Primary nodes */}
    <circle cx="250" cy="210" r="8" fill={LS_FILL.primary} opacity="0.9" />
    <circle cx="250" cy="210" r="14" fill="none" stroke={LS_FILL.primary} strokeWidth="1" opacity="0.25" />
    <circle cx="250" cy="210" r="22" fill="none" stroke={LS_FILL.primary} strokeWidth="0.5" opacity="0.12" />

    {/* Secondary nodes */}
    {[
      { cx: 200, cy: 100, r: 5.5, fill: LS_FILL.primary },
      { cx: 310, cy: 130, r: 5, fill: LS_FILL.primary },
      { cx: 320, cy: 260, r: 5, fill: LS_FILL.primary },
      { cx: 150, cy: 280, r: 5, fill: LS_FILL.teal },
      { cx: 120, cy: 140, r: 4.5, fill: LS_FILL.teal },
      { cx: 380, cy: 80, r: 4, fill: LS_FILL.primary },
      { cx: 420, cy: 160, r: 3.5, fill: LS_FILL.teal },
      { cx: 100, cy: 340, r: 3.5, fill: LS_FILL.primary },
      { cx: 280, cy: 350, r: 4, fill: LS_FILL.teal },
      { cx: 400, cy: 310, r: 3, fill: LS_FILL.primary },
    ].map((n, i) => (
      <React.Fragment key={i}>
        <circle cx={n.cx} cy={n.cy} r={n.r} fill={n.fill} opacity="0.75" />
        <circle cx={n.cx} cy={n.cy} r={n.r + 4} fill="none" stroke={n.fill} strokeWidth="0.5" opacity="0.15" />
      </React.Fragment>
    ))}

    {/* Tertiary micro-nodes */}
    {[
      { cx: 70, cy: 90 }, { cx: 460, cy: 50 }, { cx: 60, cy: 380 },
      { cx: 470, cy: 370 }, { cx: 340, cy: 40 }, { cx: 170, cy: 50 },
      { cx: 440, cy: 240 }, { cx: 80, cy: 220 },
    ].map((p, i) => (
      <circle key={`m${i}`} cx={p.cx} cy={p.cy} r="1.5" fill={LS_FILL.micro} opacity="0.4" />
    ))}

    {/* Pulse ring animation */}
    <circle cx="250" cy="210" r="8" fill="none" stroke={LS_FILL.primary} strokeWidth="1" opacity="0.3">
      <animate attributeName="r" from="10" to="40" dur="3s" repeatCount="indefinite" />
      <animate attributeName="opacity" from="0.3" to="0" dur="3s" repeatCount="indefinite" />
    </circle>
  </svg>
);

/* ─── Feature Highlight data ─── */
const FEATURES = [
  {
    icon: <Fingerprint className="w-5 h-5" />,
    title: 'Faster Investigations',
    subtitle: 'DATA-DRIVEN INSIGHTS',
    desc: 'Accelerate case resolution with AI-powered analytics and real-time intelligence feeds.',
  },
  {
    icon: <Network className="w-5 h-5" />,
    title: 'Stronger Networks',
    subtitle: 'UNLOCK HIDDEN LINKS',
    desc: 'Map criminal associations and uncover hidden patterns through advanced graph intelligence.',
  },
  {
    icon: <ShieldCheck className="w-5 h-5" />,
    title: 'Safer Communities',
    subtitle: 'INTELLIGENCE IN ACTION',
    desc: 'Transform data into preventive action that protects communities before incidents occur.',
  },
];

/* ─── Navigation Items ─── */
const NAV_ITEMS = ['Analytics', 'Networks', 'Prediction', 'Action'];

/* ─── Landing Page ─── */
export const Landing: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const vizRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Subtle parallax on the intelligence visual (mouse pointer only) */
  useEffect(() => {
    const el = vizRef.current;
    if (!el) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const onMove = (e: MouseEvent) => {
      const x = ((e.clientX / window.innerWidth) - 0.5) * 6;
      const y = ((e.clientY / window.innerHeight) - 0.5) * 4;
      el.style.transform = `translate(${x}px, ${y}px)`;
    };
    if (!reduced) window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  return (
    <div className="landing-root relative flex min-h-[100dvh] w-full flex-col overflow-x-clip font-sans select-none">
      <SecureBackdrop />

      {/* ── Header / Navigation ── */}
      <header
        className="sticky top-0 z-40 w-full transition-all duration-300"
        style={{
          background: scrolled ? 'var(--ls-header-bg)' : 'var(--ls-header-bg-glass)',
          backdropFilter: 'blur(16px) saturate(150%)',
          WebkitBackdropFilter: 'blur(16px) saturate(150%)',
          borderBottom: '1px solid var(--ls-border)',
          boxShadow: scrolled ? 'var(--ls-card-shadow)' : 'none',
        }}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand */}
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border"
              style={{ background: 'var(--ls-brand-accent-bg)', borderColor: 'var(--ls-brand-accent-border)' }}
            >
              <img
                src="/logo.svg"
                alt="SAKSHA emblem"
                className="h-[60%] w-[60%]"
                draggable={false}
              />
            </div>
            <div className="hidden sm:block leading-none">
              <span
                className="block font-extrabold uppercase tracking-[0.18em]"
                style={{ color: 'var(--ls-text-hero)', fontSize: 13 }}
              >
                SAKSHA
              </span>
              <span
                className="block font-mono uppercase tracking-[0.2em]"
                style={{ color: 'var(--ls-text-muted)', fontSize: 8.5 }}
              >
                CRIME INTELLIGENCE
              </span>
            </div>
          </div>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-5 lg:gap-7 md:flex">
            {NAV_ITEMS.map((item) => (
              <span
                key={item}
                className="cursor-pointer text-[11.5px] font-semibold uppercase tracking-[0.12em] transition-colors duration-200 hover:opacity-100"
                style={{ color: 'var(--ls-text-nav)' }}
              >
                {item}
              </span>
            ))}
          </nav>

          {/* Status + auth */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Secure Node indicator */}
            <span
              className="hidden items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] xl:inline-flex"
              style={{ color: 'var(--ls-text-nav)' }}
            >
              <span
                className="inline-block h-[6px] w-[6px] rounded-full"
                style={{ background: 'var(--ls-text-secure-green)', animation: 'pulse-dot 2.4s ease-in-out infinite' }}
              />
              SECURE NODE ONLINE
            </span>

            {/* Restricted badge */}
            <span
              className="hidden items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.14em] 2xl:inline-flex"
              style={{
                color: 'var(--ls-text-security-red)',
                background: 'var(--ls-text-security-red-bg)',
                borderColor: 'var(--ls-text-security-red-border)',
              }}
            >
              <Lock className="h-2.5 w-2.5" />
              RESTRICTED &middot; LAW ENFORCEMENT INTELLIGENCE
            </span>

            {/* Sign In */}
            <a
              href={navFor('/login')}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-all duration-200 hover:shadow-sm"
              style={{
                color: 'var(--ls-signin-color)',
                background: 'var(--ls-signin-bg)',
                borderColor: 'var(--ls-signin-border)',
              }}
            >
              Sign In <Lock className="h-3 w-3" />
            </a>

            {/* Hamburger */}
            <button
              className="flex h-9 w-9 items-center justify-center rounded-lg border transition-colors duration-200 md:hidden"
              style={{ borderColor: 'var(--ls-hamburger-border)', color: 'var(--ls-hamburger-color)' }}
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div
            className="border-t px-4 py-4 md:hidden"
            style={{ borderColor: 'var(--ls-border)', background: 'var(--ls-bg-mobile-menu)' }}
          >
            <div className="flex flex-col gap-3">
              {NAV_ITEMS.map((item) => (
                <span
                  key={item}
                  className="text-[12px] font-semibold uppercase tracking-[0.1em]"
                  style={{ color: 'var(--ls-text-hero)' }}
                >
                  {item}
                </span>
              ))}
              <span
                className="mt-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em]"
                style={{ color: 'var(--ls-text-security-red)' }}
              >
                <Lock className="h-2.5 w-2.5" />
                RESTRICTED &middot; LAW ENFORCEMENT
              </span>
            </div>
          </div>
        )}
      </header>

      {/* ── Hero Section ── */}
      <section className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[calc(100dvh-56px)] flex-col items-center justify-center py-12 md:flex-row md:gap-10 lg:gap-16 lg:py-16">
          {/* Left: Text content */}
          <div className="flex w-full flex-1 flex-col items-center text-center md:items-start md:text-left md:max-w-xl lg:max-w-2xl">
            {/* Restricted badge */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-6 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em]"
              style={{
                color: 'var(--ls-text-security-red)',
                background: 'var(--ls-text-security-red-bg)',
                borderColor: 'var(--ls-text-security-red-border)',
              }}
            >
              <Crosshair className="h-3 w-3" />
              RESTRICTED &middot; LAW ENFORCEMENT INTELLIGENCE
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.06 }}
              style={{ fontSize: 'clamp(3rem, 6vw, 6rem)', textWrap: 'balance' }}
              className="font-extrabold uppercase leading-[0.95] tracking-tight"
            >
              <span className="block" style={{ color: 'var(--ls-text-hero)' }}>
                Crime Intelligence
              </span>
              <span className="mt-1 block" style={{ color: 'var(--ls-text-hero-accent)' }}>
                Analytical Platform
              </span>
            </motion.h1>

            {/* Supporting text */}
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.12 }}
              className="mt-6 max-w-xl leading-relaxed"
              style={{ color: 'var(--ls-text-body)', fontSize: 'clamp(1rem, 1.5vw, 1.25rem)' }}
            >
              Leverage advanced AI models, data analytics, and criminal network intelligence
              to uncover patterns, identify risks, and strengthen investigations. SAKSHA
              transforms complex crime data into actionable intelligence for safer communities.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.18 }}
              className="mt-8 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-start"
            >
              <a
                href={navFor('/login')}
                className="lp-primary-btn inline-flex items-center justify-center gap-2.5 rounded-xl border px-7 py-3.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition-all duration-200 hover:shadow-lg"
                style={{
                  borderColor: 'var(--ls-cta-primary-border)',
                  background: 'var(--ls-cta-primary-bg)',
                  color: '#ffffff',
                  boxShadow: 'var(--ls-cta-primary-shadow)',
                }}
              >
                Enter Secure Platform <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href={navFor('/docs')}
                className="inline-flex items-center justify-center gap-2 rounded-xl border px-7 py-3.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition-all duration-200 hover:shadow-sm"
                style={{
                  borderColor: 'var(--ls-cta-secondary-border)',
                  background: 'var(--ls-cta-secondary-bg)',
                  color: 'var(--ls-cta-secondary-text)',
                }}
              >
                <BookOpen className="h-4 w-4" style={{ color: 'var(--ls-cta-secondary-icon)' }} />
                Read Documentation
              </a>
            </motion.div>

            {/* Security indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.28 }}
              className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.16em] md:justify-start"
              style={{ color: 'var(--ls-text-muted)' }}
            >
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" style={{ color: 'var(--ls-text-secure-green)' }} /> TLS Encrypted
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" style={{ color: 'var(--ls-signin-color)' }} /> Activity Audited
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Crosshair className="h-3.5 w-3.5" style={{ color: 'var(--lp-amber)' }} /> AI-Grounded Intel
              </span>
            </motion.div>
          </div>

          {/* Right: Intelligence Visualization */}
          <motion.div
            ref={vizRef}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mt-10 w-full max-w-[300px] flex-shrink-0 sm:max-w-[380px] md:mt-0 md:w-auto lg:max-w-[460px]"
          >
            <IntelligenceVisual />
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex flex-col items-center gap-1 pb-6"
        >
          <span
            className="font-mono text-[10px] uppercase tracking-[0.2em]"
            style={{ color: 'var(--ls-text-nav)' }}
          >
            Explore
          </span>
          <ChevronDown className="h-4 w-4 animate-bounce" style={{ color: 'var(--ls-text-nav)' }} />
        </motion.div>
      </section>

      {/* ── Feature Highlights ── */}
      <section className="relative z-10 w-full border-t" style={{ borderColor: 'var(--ls-border-subtle)' }}>
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="group rounded-2xl border p-6 transition-all duration-300"
                style={{
                  background: 'var(--ls-card-bg)',
                  borderColor: 'var(--ls-card-border)',
                  boxShadow: 'var(--ls-card-shadow)',
                }}
              >
                {/* Icon */}
                <div
                  className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border transition-colors duration-200"
                  style={{
                    color: 'var(--ls-card-icon-color)',
                    background: 'var(--ls-card-icon-bg)',
                    borderColor: 'var(--ls-card-icon-border)',
                  }}
                >
                  {f.icon}
                </div>

                {/* Title */}
                <h3
                  className="text-[15px] font-bold uppercase tracking-[0.04em]"
                  style={{ color: 'var(--ls-card-title)' }}
                >
                  {f.title}
                </h3>

                {/* Subtitle */}
                <p
                  className="mt-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em]"
                  style={{ color: 'var(--ls-card-subtitle)' }}
                >
                  {f.subtitle}
                </p>

                {/* Description */}
                <p className="mt-3 text-[13px] leading-relaxed" style={{ color: 'var(--ls-card-desc)' }}>
                  {f.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer Security Indicators ── */}
      <footer className="relative z-10 w-full border-t" style={{ borderColor: 'var(--ls-footer-border)' }}>
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-7 sm:flex-row sm:gap-6">
            {/* Security badges */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4 sm:gap-y-3">
              {[
                {
                  icon: <ShieldCheck className="h-4 w-4" />,
                  title: 'TLS Encrypted',
                  sub: 'END-TO-END SECURITY',
                },
                {
                  icon: <FileText className="h-4 w-4" />,
                  title: 'Activity Audited',
                  sub: 'FULL AUDIT TRAIL',
                },
                {
                  icon: <Fingerprint className="h-4 w-4" />,
                  title: 'AI-Grounded Intel',
                  sub: 'VERIFIED & TRACEABLE',
                },
              ].map((b) => (
                <div key={b.title} className="flex items-center gap-2.5">
                  <span style={{ color: 'var(--ls-footer-icon)' }}>{b.icon}</span>
                  <div>
                    <span
                      className="block text-[11px] font-semibold"
                      style={{ color: 'var(--ls-footer-title)' }}
                    >
                      {b.title}
                    </span>
                    <span
                      className="block font-mono text-[8.5px] uppercase tracking-[0.14em]"
                      style={{ color: 'var(--ls-footer-sub)' }}
                    >
                      {b.sub}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Copyright */}
            <div className="text-center sm:text-right">
              <span
                className="block font-mono text-[10px] uppercase tracking-[0.14em]"
                style={{ color: 'var(--ls-footer-sub)' }}
              >
                SAKSHA v2.0 &middot; Crime Intelligence Platform
              </span>
              <span
                className="block font-mono text-[9px] uppercase tracking-[0.12em]"
                style={{ color: 'var(--ls-footer-copyright)' }}
              >
                &copy; 2026 &middot; Datathon 2026 Challenge 2
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* Inline keyframes for the pulse dot */}
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.82); }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-bounce { animation: none !important; }
        }
      `}</style>
    </div>
  );
};

export default Landing;