import React from 'react';

interface SectionHeaderProps {
  eyebrow?: string;
  eyebrowRight?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Analytical section header used across intelligence panels:
 * mono uppercase eyebrow ("module · dataset"), display title,
 * optional description and an action rail on the right.
 */
export const SectionHeader: React.FC<SectionHeaderProps> = ({
  eyebrow,
  eyebrowRight,
  title,
  description,
  actions,
  className = '',
}) => {
  return (
    <div className={`sec ${className}`}>
      <div className="sec-block">
        {(eyebrow || eyebrowRight) && (
          <div className="sec-eyebrow">
            <span>{eyebrow}</span>
            {eyebrowRight && <em>{eyebrowRight}</em>}
          </div>
        )}
        <h3 className="sec-title">{title}</h3>
        {description && <p className="sec-desc">{description}</p>}
      </div>
      {actions && <div className="sec-actions">{actions}</div>}
    </div>
  );
};

export default SectionHeader;