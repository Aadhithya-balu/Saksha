import React from 'react';

export type MetricTone = 'default' | 'coral' | 'amber' | 'teal' | 'cyan';
export type DeltaDir = 'up' | 'down' | 'flat';

interface MetricProps {
  label: string;
  value: React.ReactNode;
  tone?: MetricTone;
  delta?: React.ReactNode;
  deltaDir?: DeltaDir;
  foot?: React.ReactNode;
  className?: string;
}

export const Metric: React.FC<MetricProps> = ({
  label,
  value,
  tone = 'default',
  delta,
  deltaDir,
  foot,
  className = '',
}) => {
  return (
    <div className={`metric ${className}`}>
      <span className="metric-eyebrow">{label}</span>
      <div className="metric-value" data-tone={tone === 'default' ? undefined : tone}>
        {value}
      </div>
      {delta && (
        <span className="metric-delta" data-dir={deltaDir || 'flat'}>
          {deltaDir === 'up' && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          )}
          {deltaDir === 'down' && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 7l10 10M9 17h8V9" />
            </svg>
          )}
          {deltaDir === 'flat' && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
            </svg>
          )}
          {delta}
        </span>
      )}
      {foot && <span className="metric-foot">{foot}</span>}
    </div>
  );
};

export default Metric;