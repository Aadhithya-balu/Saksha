import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FileText,
  History,
  Lock,
  Shield,
  ShieldAlert,
} from 'lucide-react';
import { apiRequest, createReport, generateReportContent } from '../services/api';
import { useAuthStore, type UserRole } from '../store/authStore';
import { useUserScope } from '../hooks/useUserScope';
import { downloadReportFile } from '../utils/downloader';
import {
  ReportBuilder,
  ReportDocumentPreview,
  ReportHistoryPanel,
  ReportTemplateGallery,
  REPORT_TEMPLATES,
  type ReportBuilderConfig,
  type ReportPreviewData,
  type ReportType,
} from '../components/reports';

const ALLOWED_REPORT_ROLES: UserRole[] = ['ADMIN', 'SCRB', 'IO', 'INSPECTOR', 'SP'];

const STORAGE_KEY = 'saksha_report_builder_config';

export const Reports: React.FC = () => {
  const { user } = useAuthStore();
  const userRole = (user?.role ?? 'VIEWER') as UserRole;
  const isAuthorized = ALLOWED_REPORT_ROLES.includes(userRole);

  const { district: userDistrict, canSelectDistrict } = useUserScope();

  // Active top tab: 'studio' | 'archive'
  const [activeTab, setActiveTab] = useState<'studio' | 'archive'>('studio');

  // Builder configuration
  const [config, setConfig] = useState<ReportBuilderConfig>(() => {
    // 1. Initial defaults
    const initial: ReportBuilderConfig = {
      reportType: 'cases',
      district: !canSelectDistrict && userDistrict ? userDistrict : '',
      status: '',
      search: '',
      dateFrom: '',
      dateTo: '',
      sortBy: 'created_at',
      sortOrder: 'desc',
      classification: 'CONFIDENTIAL',
      sections: {
        executiveSummary: true,
        dataTable: true,
        provenanceAudit: true,
        complianceNotice: true,
      },
    };

    // 2. Restore from LocalStorage if valid
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...initial,
          ...parsed,
          district: !canSelectDistrict && userDistrict ? userDistrict : (parsed.district ?? ''),
        };
      }
    } catch {
      // ignore
    }

    return initial;
  });

  // Deep linking: check URL parameters or sessionStorage
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const urlTemplate = searchParams.get('template') as ReportType | null;
    const urlCaseId = searchParams.get('caseId') || searchParams.get('case_id');
    const storedEntityId = sessionStorage.getItem('selected_entity_id');

    const deepId = urlCaseId || storedEntityId;
    if (deepId || urlTemplate) {
      setConfig((prev) => ({
        ...prev,
        reportType: urlTemplate || (deepId ? 'dossier' : prev.reportType),
        search: deepId || prev.search,
      }));
    }
  }, []);

  // Persist config changes to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // ignore
    }
  }, [config]);

  // Sync district if district-bound
  useEffect(() => {
    if (!canSelectDistrict && userDistrict && config.district !== userDistrict) {
      setConfig((prev) => ({ ...prev, district: userDistrict }));
    }
  }, [canSelectDistrict, userDistrict, config.district]);

  // Preview & Export States
  const [previewData, setPreviewData] = useState<ReportPreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Active Template info
  const currentTemplate = useMemo(() => {
    return REPORT_TEMPLATES.find((t) => t.id === config.reportType) || REPORT_TEMPLATES[0];
  }, [config.reportType]);

  // Build query string for API
  const queryParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (config.search) params.search = config.search;
    if (config.status) params.status = config.status;
    if (config.district) params.district = config.district;
    if (config.dateFrom) params.date_from = new Date(config.dateFrom).toISOString();
    if (config.dateTo) params.date_to = new Date(config.dateTo).toISOString();
    params.sort_by = config.sortBy;
    params.sort_order = config.sortOrder;
    params.page_size = '100';
    return params;
  }, [config]);

  const loadPreview = useCallback(async () => {
    if (!isAuthorized) return;
    setLoading(true);
    setError(null);
    try {
      const searchStr = new URLSearchParams(queryParams).toString();
      const res = await apiRequest<ReportPreviewData>(`/reports/${config.reportType}?${searchStr}`);
      setPreviewData(res);
    } catch (err) {
      setPreviewData(null);
      setError(err instanceof Error ? err.message : 'Failed to retrieve report preview');
    } finally {
      setLoading(false);
    }
  }, [config.reportType, queryParams, isAuthorized]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  // Direct export handler (PDF, DOCX, TXT, CSV, XLSX)
  const handleExport = async (format: 'pdf' | 'docx' | 'txt' | 'csv' | 'xlsx') => {
    setExporting(format);
    setError(null);
    try {
      const exportParams = {
        ...queryParams,
        classification: config.classification,
      };
      await downloadReportFile(config.reportType, format, exportParams);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to export ${format.toUpperCase()}`);
    } finally {
      setExporting(null);
    }
  };

  // Save to Managed Lifecycle Report (Draft -> Generated with Snapshot)
  const handleSaveToManaged = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Create Report record
      const draft = await createReport({
        report_type: config.reportType,
        title: `${currentTemplate.title} (${config.district || 'State-Wide'})`,
        district: config.district || undefined,
        format: 'pdf',
      });

      // 2. If preview data is available, populate content snapshot
      if (previewData && previewData.results.length > 0) {
        const headers = previewData.headers;
        const rows = previewData.results.map((r) => headers.map((h) => r[h]));
        await generateReportContent(draft.id, {
          title: draft.title,
          content: { headers, rows },
          require_verified_references: false,
        });
      }

      alert('Report saved to Managed Archive. You can view, review, and finalize it in the Archive tab.');
      setActiveTab('archive');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save managed report');
    } finally {
      setLoading(false);
    }
  };

  // UNAUTHORIZED RESTRICTION VIEW
  if (!isAuthorized) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-rose-500/30 bg-[var(--bg-secondary)] p-8 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <Lock className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">
              Restricted Security Clearance
            </h3>
            <p className="text-xs text-[var(--text-muted)] font-mono">
              ROLE IDENTIFIER: <span className="text-rose-400 font-bold">{userRole}</span>
            </p>
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Access to official law-enforcement report generation, evidence dossiers, and classified data export requires 
            Investigator (IO), Crime Analyst (SCRB), Inspector, or Superintendent (SP) clearance.
          </p>
          <div className="pt-2 text-[10px] font-mono text-[var(--text-muted)] border-t border-border-color">
            Compliance Policy • Karnataka Police Data Governance Manual §4
          </div>
        </div>
      </div>
    );
  }

  const operatorBadge = user?.badgeId || user?.name || 'OPERATOR';

  return (
    <div className="min-h-[86vh] space-y-5 p-2 sm:p-4 bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans">
      {/* Top Header & Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border-color">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-[var(--accent-blue)]" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">
              Karnataka State Police • SCRB Reporting Suite
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-black uppercase tracking-tight text-[var(--text-primary)]">
            Intelligence Reports & Audit Management
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            Official police document generation, cryptographic provenance verification, and tamper-evident lifecycle history
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="inline-flex rounded-xl border border-border-color p-1 bg-[var(--bg-secondary)] shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('studio')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
              activeTab === 'studio'
                ? 'bg-[var(--accent-blue)] text-white shadow-md'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Report Studio & Preview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('archive')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
              activeTab === 'archive'
                ? 'bg-[var(--accent-blue)] text-white shadow-md'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Managed Archive & History</span>
          </button>
        </div>
      </div>

      {/* ERROR ALERT BANNER */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* TAB 1: REPORT STUDIO & LIVE DOCUMENT PREVIEW */}
      {activeTab === 'studio' && (
        <div className="space-y-6">
          {/* Template Gallery */}
          <ReportTemplateGallery
            selectedType={config.reportType}
            onSelect={(type) =>
              setConfig((prev) => ({
                ...prev,
                reportType: type,
                status: '',
                sortBy: 'created_at',
              }))
            }
            userRole={userRole}
          />

          {/* Report Configuration & Parameters */}
          <ReportBuilder
            config={config}
            onChange={setConfig}
            onRefresh={loadPreview}
            onExport={handleExport}
            onSaveManaged={handleSaveToManaged}
            loading={loading}
            exporting={exporting}
            canSelectDistrict={canSelectDistrict}
            userDistrict={userDistrict}
            badgeOrUsername={operatorBadge}
          />

          {/* Official Document Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                Document Render Preview
              </h3>
              <span className="text-[10px] font-mono text-[var(--text-muted)]">
                Visual preview matches exported PDF and Word layouts
              </span>
            </div>

            <ReportDocumentPreview
              data={previewData}
              loading={loading}
              error={error}
              title={currentTemplate.title}
              classification={config.classification}
              operatorBadgeOrUser={operatorBadge}
              district={config.district}
              sections={config.sections}
            />
          </div>
        </div>
      )}

      {/* TAB 2: MANAGED ARCHIVE & AUDIT HISTORY */}
      {activeTab === 'archive' && (
        <ReportHistoryPanel
          userRole={userRole}
          onSelectReport={(report) => {
            console.log('Selected managed report:', report.id);
          }}
        />
      )}
    </div>
  );
};

export default Reports;
