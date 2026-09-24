import React from 'react';
import type { CrimeCaseInsights } from '../../services/api';
import { Shield, ShieldAlert, Activity, AlertTriangle } from 'lucide-react';

interface CrimeInsightsBarProps {
  insights: CrimeCaseInsights | null;
  activeStatus: string;
  activePriority: string;
  onSelectStatus: (status: string) => void;
  onSelectPriority: (priority: string) => void;
  onResetFilters: () => void;
}

/*
 * Compact real-data KPI strip for the Crime Cases workspace.
 * Every value comes from the backend `/crime-cases/insights` endpoint scoped to
 * the operator's district + active filters. No fabricated numbers are shown;
 * when insights have not loaded the cells render "—".
 */
const CrimeInsightsBar: React.FC<CrimeInsightsBarProps> = ({
  insights,
  activeStatus,
  activePriority,
  onSelectStatus,
  onSelectPriority,
  onResetFilters,
}) => {
  const total = insights?.total_cases ?? null;

  const cells = [
    {
      key: 'total',
      label: 'Total Cases',
      value: total,
      icon: Shield,
      tone: 'var(--accent-blue)',
      active: false,
    },
    {
      key: 'open',
      label: 'Open',
      value: insights?.open ?? null,
      icon: ShieldAlert,
      tone: 'var(--accent-coral)',
      active: activeStatus === 'open',
      onClick: () => onSelectStatus(activeStatus === 'open' ? '' : 'open'),
    },
    {
      key: 'investigating',
      label: 'Under Investigation',
      value: insights?.investigating ?? null,
      icon: Activity,
      tone: 'var(--accent-purple)',
      active: activeStatus === 'investigating',
      onClick: () => onSelectStatus(activeStatus === 'investigating' ? '' : 'investigating'),
    },
    {
      key: 'critical',
      label: 'Critical',
      value: insights?.critical ?? null,
      icon: AlertTriangle,
      tone: 'var(--accent-amber)',
      active: activePriority === 'critical',
      onClick: () => onSelectPriority(activePriority === 'critical' ? '' : 'critical'),
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 select-none">
      {cells.map((cell) => {
        const Ic = cell.icon;
        const isButton = !!cell.onClick;
        const inner = (
          <>
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  color: cell.tone,
                  backgroundColor: `color-mix(in srgb, ${cell.tone} 14%, transparent)`,
                }}
              >
                <Ic className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] truncate">
                  {cell.label}
                </div>
                <div className="text-xl font-bold leading-6 text-[var(--text-primary)] font-mono">
                  {cell.value === null ? '—' : cell.value}
                </div>
              </div>
            </div>
            {cell.active && (
              <span
                className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full shrink-0"
                style={{ color: cell.tone, backgroundColor: `color-mix(in srgb, ${cell.tone} 20%, transparent)` }}
              >
                Filtering
              </span>
            )}
          </>
        );
        return isButton ? (
          <button
            key={cell.key}
            type="button"
            onClick={cell.onClick}
            title={`Filter cases by ${cell.label.toLowerCase()}`}
            className={`sk-panel sk-panel-pad !p-3 flex items-center justify-between gap-2 text-left min-w-0 cursor-pointer transition-colors ${
              cell.active ? 'ring-1' : 'hover:ring-1'
            }`}
            style={cell.active ? ({ '--tw-ring-color': cell.tone, borderColor: cell.tone } as React.CSSProperties) : undefined}
          >
            {inner}
          </button>
        ) : (
          <div key={cell.key} className="sk-panel sk-panel-pad !p-3 flex items-center justify-between gap-2 min-w-0">
            {inner}
          </div>
        );
      })}

      {(activeStatus || activePriority) && (
        <button
          type="button"
          onClick={onResetFilters}
          className="lg:col-span-4 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)] hover:text-[var(--accent-coral)] transition-colors cursor-pointer self-end"
        >
          Clear active filters
        </button>
      )}
    </div>
  );
};

export default CrimeInsightsBar;