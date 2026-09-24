import React from 'react';
import { Download, FileText, RefreshCw, Search } from 'lucide-react';

export type ReportType =
  | 'cases'
  | 'hotspots'
  | 'interventions'
  | 'network'
  | 'victimology'
  | 'strategic'
  | 'dossier'
  | 'officers'
  | 'evidence'
  | 'criminals';

export interface ReportFiltersValue {
  reportType: ReportType;
  search: string;
  status: string;
  district: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface ReportPreviewData {
  report_type: ReportType;
  headers: string[];
  filters: Record<string, string>;
  total: number;
  page: number;
  page_size: number;
  summary?: {
    status?: Record<string, number>;
    priority?: Record<string, number>;
  } | null;
  results: Array<Record<string, string | number | null>>;
}

const reportLabels: Record<ReportType, string> = {
  cases: 'Case Incident Report',
  hotspots: 'District Hotspot Brief',
  interventions: 'Operational Interventions',
  network: 'Syndicate Network Intelligence',
  victimology: 'Victimology Report',
  strategic: 'Strategic Command Brief',
  dossier: 'Target Intelligence Dossier',
  officers: 'Officer Registry Report',
  criminals: 'Offender Registry Report',
  evidence: 'Forensic Evidence Report',
};

export const StatisticsCards: React.FC<{ stats: Record<string, number> }> = ({ stats }) => (
  <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
    {Object.entries(reportLabels).map(([key, label]) => (
      <div key={key} className="rounded-lg border border-border-color bg-[var(--bg-tertiary)]/55 p-4">
        <p className="text-[9px] uppercase tracking-[0.24em] text-[var(--text-muted)]">{label}</p>
        <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{stats[key] ?? 0}</p>
      </div>
    ))}
  </div>
);

export const ReportCards: React.FC<{ active: ReportType; onSelect: (type: ReportType) => void }> = ({ active, onSelect }) => (
  <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
    {(Object.keys(reportLabels) as ReportType[]).map((type) => (
      <button
        key={type}
        onClick={() => onSelect(type)}
        className={`rounded-lg border p-3 text-left transition-colors ${active === type ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)]/15 text-[var(--text-primary)]' : 'border-border-color bg-[var(--bg-secondary)]/70 text-[var(--text-secondary)] hover:border-[var(--accent-blue)]/50'}`}
      >
        <FileText className="h-4 w-4 text-[#4DA3FF]" />
        <span className="mt-3 block text-[10px] font-bold uppercase tracking-wider">{reportLabels[type]}</span>
      </button>
    ))}
  </div>
);

export const ReportFilters: React.FC<{
  value: ReportFiltersValue;
  onChange: (value: ReportFiltersValue) => void;
  onRefresh: () => void;
}> = ({ value, onChange, onRefresh }) => (
  <div className="grid grid-cols-1 md:grid-cols-5 gap-2 rounded-lg border border-border-color bg-[var(--bg-tertiary)]/35 p-3">
    <label className="relative md:col-span-2">
      <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[var(--text-muted)]" />
      <input value={value.search} onChange={(e) => onChange({ ...value, search: e.target.value })} placeholder="Search records" className="w-full rounded bg-[var(--bg-primary)] border border-border-color py-2 pl-9 pr-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-blue)]" />
    </label>
    <input value={value.status} onChange={(e) => onChange({ ...value, status: e.target.value })} placeholder="Status filter" className="rounded bg-[var(--bg-primary)] border border-border-color px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-blue)]" />
    <input value={value.district} onChange={(e) => onChange({ ...value, district: e.target.value })} placeholder="District filter" className="rounded bg-[var(--bg-primary)] border border-border-color px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-blue)]" />
    <button onClick={onRefresh} className="inline-flex items-center justify-center gap-2 rounded bg-[var(--accent-blue)]/15 border border-[var(--accent-blue)]/35 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
      <RefreshCw className="h-3.5 w-3.5" /> Refresh
    </button>
  </div>
);

export const ExportButton: React.FC<{ label: string; onClick: () => void; disabled?: boolean }> = ({ label, onClick, disabled }) => (
  <button onClick={onClick} disabled={disabled} className="inline-flex items-center justify-center gap-2 rounded bg-[var(--accent-teal)]/15 border border-[var(--accent-teal)]/35 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)] disabled:opacity-40">
    <Download className="h-3.5 w-3.5 text-[var(--accent-teal)]" /> {label}
  </button>
);

export const ExportMenu: React.FC<{ disabled?: boolean; exportingFormat?: string | null; onExport: (format: 'pdf' | 'docx' | 'txt' | 'csv' | 'xlsx') => void }> = ({ disabled, exportingFormat, onExport }) => {
  return (
    <div className="relative inline-block text-left">
      <select
        disabled={disabled}
        value=""
        onChange={(e) => {
          if (e.target.value) {
            onExport(e.target.value as any);
          }
        }}
        className="appearance-none inline-flex items-center justify-center gap-2 rounded bg-[#0E9E78]/15 border border-[#0E9E78]/35 pl-8 pr-6 py-2 text-[10px] font-bold uppercase tracking-wider text-white disabled:opacity-40 cursor-pointer outline-none focus:border-[#0E9E78]"
      >
        <option value="" disabled hidden>{exportingFormat ? `Preparing ${exportingFormat.toUpperCase()}...` : 'Export As...'}</option>
        <option value="pdf" className="bg-[#0A1220] text-white">Export PDF</option>
        <option value="docx" className="bg-[#0A1220] text-white">Export DOCX</option>
        <option value="txt" className="bg-[#0A1220] text-white">Export TXT</option>
        <option value="csv" className="bg-[#0A1220] text-white">Export CSV</option>
        <option value="xlsx" className="bg-[#0A1220] text-white">Export XLSX</option>
      </select>
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2">
        <Download className="h-3.5 w-3.5 text-[#0E9E78]" />
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
        <svg className="h-3 w-3 text-[#0E9E78]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </div>
    </div>
  );
};

export const ReportTable: React.FC<{ data: ReportPreviewData | null; loading: boolean; error: string | null }> = ({ data, loading, error }) => (
  <div className="min-h-[260px] overflow-auto rounded-lg border border-border-color bg-[var(--bg-tertiary)]/25 custom-scrollbar">
    {loading && <div className="p-10 text-center text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Loading live backend report</div>}
    {error && !loading && <div className="p-10 text-center text-[10px] uppercase tracking-widest text-amber-400">{error}</div>}
    {!loading && !error && data && data.results.length === 0 && <div className="p-10 text-center text-[10px] uppercase tracking-widest text-[var(--text-muted)]">No records match the current filters</div>}
    {!loading && !error && data && data.results.length > 0 && (
      <table className="w-full border-collapse text-left text-[10px]">
        <thead className="bg-[var(--bg-primary)] text-[var(--text-muted)] uppercase tracking-wider">
          <tr>{data.headers.map((header) => <th key={header} className="px-3 py-3 whitespace-nowrap">{header.replace(/_/g, ' ')}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-primary)] text-[var(--text-secondary)]">
          {data.results.map((row, index) => (
            <tr key={index} className="hover:bg-[var(--bg-surface-hover)] transition-colors">
              {data.headers.map((header) => <td key={header} className="px-3 py-3 max-w-[280px] truncate">{row[header] ?? ''}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

export const ReportPreview: React.FC<{ data: ReportPreviewData | null }> = ({ data }) => (
  <div className="rounded-lg border border-border-color bg-[var(--bg-secondary)]/70 p-4">
    <p className="text-[9px] uppercase tracking-[0.24em] text-[var(--text-muted)]">Preview</p>
    <p className="mt-2 text-sm font-bold text-[var(--text-primary)]">{data ? `${reportLabels[data.report_type]} - ${data.total} matching records` : 'Select filters to preview a report'}</p>
    <p className="mt-1 text-[10px] text-[var(--text-muted)]">Generated from authenticated backend APIs with the current filter set.</p>
  </div>
);

export * from './ReportTemplateGallery';
export * from './ReportBuilder';
export * from './ReportDocumentPreview';
export * from './ReportHistoryPanel';
export * from './ManagedReportLifecycle';
