import React, { useMemo } from 'react';
import {
  Download,
  Filter,
  Lock,
  RefreshCw,
  Search,
  Shield,
  FileCheck,
  AlertTriangle,
} from 'lucide-react';
import type { ReportType } from './index';

export type ClassificationLevel = 'OFFICIAL' | 'RESTRICTED' | 'CONFIDENTIAL';

export interface ReportBuilderConfig {
  reportType: ReportType;
  district: string;
  status: string;
  search: string;
  dateFrom: string;
  dateTo: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  classification: ClassificationLevel;
  sections: {
    executiveSummary: boolean;
    dataTable: boolean;
    provenanceAudit: boolean;
    complianceNotice: boolean;
  };
}

const KARNATAKA_DISTRICTS = [
  'Bengaluru Urban',
  'Bengaluru Rural',
  'Mysuru',
  'Belagavi',
  'Dharwad',
  'Kalaburagi',
  'Vijayapura',
  'Ballari',
  'Bidar',
  'Hassan',
  'Tumkuru',
  'Mandya',
  'Shivamogga',
  'Davanagere',
  'Chitradurga',
  'Kodagu',
  'Chikkamagaluru',
  'Haveri',
  'Gadag',
  'Bagalkote',
  'Kolar',
  'Udupi',
  'Dakshina Kannada',
  'Uttara Kannada',
];

interface ReportBuilderProps {
  config: ReportBuilderConfig;
  onChange: (config: ReportBuilderConfig) => void;
  onRefresh: () => void;
  onExport: (format: 'pdf' | 'docx' | 'txt' | 'csv' | 'xlsx') => void;
  onSaveManaged: () => void;
  loading: boolean;
  exporting: string | null;
  canSelectDistrict: boolean;
  userDistrict: string | null;
  badgeOrUsername: string;
}

export const ReportBuilder: React.FC<ReportBuilderProps> = ({
  config,
  onChange,
  onRefresh,
  onExport,
  onSaveManaged,
  loading,
  exporting,
  canSelectDistrict,
  userDistrict,
  badgeOrUsername,
}) => {
  const isDateRangeInvalid = useMemo(() => {
    if (!config.dateFrom || !config.dateTo) return false;
    return new Date(config.dateFrom) > new Date(config.dateTo);
  }, [config.dateFrom, config.dateTo]);

  const watermarkPreview = `${config.classification} - ${badgeOrUsername || 'OPERATOR'}`;

  const classificationColors: Record<ClassificationLevel, { bg: string; text: string; border: string }> = {
    OFFICIAL: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    RESTRICTED: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
    CONFIDENTIAL: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
  };

  return (
    <div className="rounded-xl border border-border-color bg-[var(--bg-secondary)]/80 p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border-color/60">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[var(--accent-blue)]" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
            Report Parameters & Compliance Controls
          </h4>
        </div>

        {/* Security Classification Selector */}
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span className="text-[10px] uppercase font-mono text-[var(--text-muted)]">Classification:</span>
          <div className="inline-flex rounded-lg border border-border-color p-0.5 bg-[var(--bg-primary)]">
            {(['OFFICIAL', 'RESTRICTED', 'CONFIDENTIAL'] as ClassificationLevel[]).map((level) => {
              const active = config.classification === level;
              const clr = classificationColors[level];
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => onChange({ ...config, classification: level })}
                  className={`px-2.5 py-1 text-[9px] font-bold tracking-wider rounded transition-all ${
                    active
                      ? `${clr.bg} ${clr.text} ${clr.border} border shadow-sm`
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {level}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grid of Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* District Jurisdiction */}
        <div>
          <label className="block text-[10px] uppercase font-mono tracking-wider text-[var(--text-muted)] mb-1">
            Jurisdiction District
          </label>
          {canSelectDistrict ? (
            <select
              value={config.district}
              onChange={(e) => onChange({ ...config, district: e.target.value })}
              className="w-full rounded-lg bg-[var(--bg-primary)] border border-border-color px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-blue)]"
            >
              <option value="">All Karnataka Districts (State-Wide)</option>
              {KARNATAKA_DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex items-center justify-between rounded-lg bg-[var(--bg-primary)] border border-border-color/80 px-3 py-2 text-xs text-[var(--text-secondary)]">
              <span className="font-medium text-[var(--text-primary)]">{userDistrict || 'Assigned District'}</span>
              <span className="flex items-center gap-1 text-[9px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                <Lock className="w-2.5 h-2.5" /> Scoped
              </span>
            </div>
          )}
        </div>

        {/* Date From */}
        <div>
          <label className="block text-[10px] uppercase font-mono tracking-wider text-[var(--text-muted)] mb-1">
            Date Range From
          </label>
          <div className="relative">
            <input
              type="date"
              value={config.dateFrom}
              onChange={(e) => onChange({ ...config, dateFrom: e.target.value })}
              className={`w-full rounded-lg bg-[var(--bg-primary)] border px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-blue)] ${
                isDateRangeInvalid ? 'border-rose-500' : 'border-border-color'
              }`}
            />
          </div>
        </div>

        {/* Date To */}
        <div>
          <label className="block text-[10px] uppercase font-mono tracking-wider text-[var(--text-muted)] mb-1">
            Date Range To
          </label>
          <div className="relative">
            <input
              type="date"
              value={config.dateTo}
              onChange={(e) => onChange({ ...config, dateTo: e.target.value })}
              className={`w-full rounded-lg bg-[var(--bg-primary)] border px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-blue)] ${
                isDateRangeInvalid ? 'border-rose-500' : 'border-border-color'
              }`}
            />
          </div>
        </div>

        {/* Keyword Search */}
        <div>
          <label className="block text-[10px] uppercase font-mono tracking-wider text-[var(--text-muted)] mb-1">
            Search Within Records
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[var(--text-muted)]" />
            <input
              type="text"
              value={config.search}
              onChange={(e) => onChange({ ...config, search: e.target.value })}
              placeholder="Case ID, suspect, station..."
              className="w-full rounded-lg bg-[var(--bg-primary)] border border-border-color py-1.5 pl-9 pr-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-blue)]"
            />
          </div>
        </div>
      </div>

      {isDateRangeInvalid && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>Invalid date range: Date From cannot be after Date To. Please adjust the dates.</span>
        </div>
      )}

      {/* Sections and Watermark Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-border-color/40 text-xs">
        <div className="flex items-center gap-4">
          <span className="text-[10px] uppercase font-mono text-[var(--text-muted)]">Include Sections:</span>
          <label className="flex items-center gap-1.5 cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <input
              type="checkbox"
              checked={config.sections.executiveSummary}
              onChange={(e) =>
                onChange({
                  ...config,
                  sections: { ...config.sections, executiveSummary: e.target.checked },
                })
              }
              className="rounded border-border-color text-[var(--accent-blue)] focus:ring-0"
            />
            <span>Executive Summary</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <input
              type="checkbox"
              checked={config.sections.dataTable}
              onChange={(e) =>
                onChange({
                  ...config,
                  sections: { ...config.sections, dataTable: e.target.checked },
                })
              }
              className="rounded border-border-color text-[var(--accent-blue)] focus:ring-0"
            />
            <span>Data Records</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <input
              type="checkbox"
              checked={config.sections.provenanceAudit}
              onChange={(e) =>
                onChange({
                  ...config,
                  sections: { ...config.sections, provenanceAudit: e.target.checked },
                })
              }
              className="rounded border-border-color text-[var(--accent-blue)] focus:ring-0"
            />
            <span>Provenance Chain</span>
          </label>
        </div>

        {/* Watermark Tag */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-mono text-[var(--text-muted)]">Watermark:</span>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[var(--bg-primary)] border border-border-color text-[var(--text-secondary)]">
            {watermarkPreview}
          </span>
        </div>
      </div>

      {/* Action Buttons Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border-color/60">
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading || isDateRangeInvalid}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-border-color hover:border-[var(--accent-blue)] text-xs text-[var(--text-primary)] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[var(--accent-blue)]' : ''}`} />
          <span>Refresh Live Preview</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSaveManaged}
            disabled={loading || isDateRangeInvalid}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[var(--accent-blue)]/15 border border-[var(--accent-blue)]/40 hover:bg-[var(--accent-blue)]/25 text-xs font-semibold text-[var(--text-primary)] transition-all disabled:opacity-50"
          >
            <FileCheck className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
            <span>Save to Managed Archive</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative inline-block">
            <select
              disabled={loading || isDateRangeInvalid || !!exporting}
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  onExport(e.target.value as any);
                }
              }}
              className="appearance-none inline-flex items-center justify-center gap-2 rounded-lg bg-[#0E9E78]/20 border border-[#0E9E78]/50 pl-8 pr-7 py-2 text-xs font-bold uppercase tracking-wider text-emerald-300 disabled:opacity-40 cursor-pointer outline-none hover:bg-[#0E9E78]/30 transition-all"
            >
              <option value="" disabled hidden>
                {exporting ? `Exporting ${exporting.toUpperCase()}...` : 'Export Document As...'}
              </option>
              <option value="pdf" className="bg-[#0A1220] text-white">
                Export PDF (.pdf)
              </option>
              <option value="docx" className="bg-[#0A1220] text-white">
                Export Word (.docx)
              </option>
              <option value="xlsx" className="bg-[#0A1220] text-white">
                Export Excel (.xlsx)
              </option>
              <option value="csv" className="bg-[#0A1220] text-white">
                Export CSV (.csv)
              </option>
              <option value="txt" className="bg-[#0A1220] text-white">
                Export Plaintext (.txt)
              </option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
              <Download className="h-3.5 w-3.5 text-[#0E9E78]" />
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <svg className="h-3.5 w-3.5 text-[#0E9E78]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
