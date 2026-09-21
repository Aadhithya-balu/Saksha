import React from 'react';
import { useTitle } from '../../hooks/useTitle';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, icon, actions }) => {
  useTitle(title);
  return (
  <div className="sk-page-head">
    <div className="flex items-center gap-3 min-w-0">
      {icon && (
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-[var(--accent-blue)] bg-[color-mix(in_srgb,var(--accent-blue)_12%,transparent)]">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <h2 className="sk-page-head-title truncate">{title}</h2>
        {subtitle && <p className="text-sm text-[var(--text-muted)] mt-0.5 truncate">{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
    </div>
  );
};

export default PageHeader;
