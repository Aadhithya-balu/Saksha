import React from 'react';

export type SignalKind = 'verified' | 'inferred' | 'review';

export interface SignalMeta {
  label: string;
  title: string;
}

const META: Record<SignalKind, SignalMeta> = {
  verified: {
    label: 'Verified',
    title: 'Confirmed against source records',
  },
  inferred: {
    label: 'Inferred',
    title: 'Model/AI inference — shows a confidence score',
  },
  review: {
    label: 'Needs review',
    title: 'Proposed lead — requires human review decision',
  },
};

const SIGNAL_ICONS: Record<SignalKind, React.ReactNode> = {
  verified: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  inferred: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
    </svg>
  ),
  review: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18M5 7l14 10M19 7L5 17" />
    </svg>
  ),
};

interface SignalTagProps {
  kind: SignalKind;
  label?: string;
  icon?: boolean;
  className?: string;
}

export const SignalTag: React.FC<SignalTagProps> = ({ kind, label, icon = true, className = '' }) => {
  const meta = META[kind];
  return (
    <span className={`sig-tag sig-${kind} ${className}`} title={meta.title}>
      {icon && SIGNAL_ICONS[kind]}
      {label ?? meta.label}
    </span>
  );
};

const LEGEND: Record<SignalKind, string> = {
  verified: 'Confirmed against source records',
  inferred: 'AI inference · confidence shown',
  review: 'Proposed lead · review required',
};

export const SignalLegend: React.FC<{ compact?: boolean; className?: string }> = ({ compact, className = '' }) => {
  if (compact) {
    return null;
  }
  return (
    <div className={`flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-[var(--text-muted)] select-none ${className}`}>
      {(Object.keys(LEGEND) as SignalKind[]).map((k) => (
        <span key={k} className="inline-flex items-center gap-1 px-1.5">
          <span className={`w-1.5 h-1.5 rounded-full bg-[var(--${k === 'verified' ? 'sig-verified' : k === 'inferred' ? 'sig-inferred' : 'sig-review'})]`} />
          {LEGEND[k]}
        </span>
      ))}
    </div>
  );
};

export default SignalTag;