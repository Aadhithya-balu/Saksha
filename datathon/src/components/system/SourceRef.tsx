import React from 'react';

interface SourceRefProps {
  kind: string;
  title: string;
  meta?: string;
  destination?: string;
  onClick?: () => void;
  className?: string;
}

/**
 * Provenance chip for pulled-from-source information in AI output
 * and intelligence panels. `kind` is the source type label (e.g.
 * "CASE", "FIR", "CRIMINAL", "EVIDENCE"), `destination` an optional
 * logical target (tab id / entity id) surfaced as a title hint.
 */
export const SourceRef: React.FC<SourceRefProps> = ({
  kind,
  title,
  meta,
  destination,
  onClick,
  className = '',
}) => {
  return (
    <button
      type="button"
      className={`src-ref ${className}`}
      onClick={onClick}
      title={destination ? `Open ${destination}` : title}
    >
      <span className="src-kind">{kind}</span>
      <span className="src-title text-[var(--text-secondary)]">{title}</span>
      {meta && <span className="src-muted">{meta}</span>}
    </button>
  );
};

export default SourceRef;