import React from 'react';

export interface ConfidenceMeterProps {
  value: number;
  label: string;
  tone?: 'high' | 'medium' | 'low';
  className?: string;
}

const toneFor = (value: number): 'high' | 'medium' | 'low' =>
  value >= 0.7 ? 'high' : value >= 0.4 ? 'medium' : 'low';

export const ConfidenceMeter: React.FC<ConfidenceMeterProps> = ({
  value,
  label,
  tone,
  className = '',
}) => {
  const resolved = tone ?? toneFor(value);
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className={`conf-meter ${className}`} data-tone={resolved}>
      <div className="conf-bar">
        <div className="conf-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="conf-label">{label} · {pct}%</span>
    </div>
  );
};

export default ConfidenceMeter;