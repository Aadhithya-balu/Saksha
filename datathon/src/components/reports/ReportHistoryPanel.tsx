import React, { useCallback, useEffect, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  Download,
  Eye,
  History,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  archiveReport,
  deleteReport,
  finalizeReport,
  getReportAudit,
  getReportDetail,
  listReports,
  reviewReport,
  type ReportAuditEntry,
  type ReportDetail,
  type ReportRecord,
} from '../../services/api';
import { downloadExistingManagedReport } from '../../utils/downloader';

interface ReportHistoryPanelProps {
  userRole: string;
  onSelectReport?: (report: ReportDetail) => void;
}

export const ReportHistoryPanel: React.FC<ReportHistoryPanelProps> = ({
  userRole,
  onSelectReport,
}) => {
  const isAdmin = userRole === 'ADMIN';
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<ReportDetail | null>(null);
  const [auditEntries, setAuditEntries] = useState<ReportAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<ReportRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);


  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listReports(1, 100, {
        status: statusFilter || undefined,
        search: searchTerm || undefined,
      });
      setReports(res.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report history');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleOpenDetail = async (reportId: string) => {
    setActionBusy(reportId);
    try {
      const detail = await getReportDetail(reportId);
      setSelectedDetail(detail);
      if (onSelectReport) onSelectReport(detail);

      if (isAdmin) {
        const auditRes = await getReportAudit(reportId, 1, 50);
        setAuditEntries(auditRes.results || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve report detail');
    } finally {
      setActionBusy(null);
    }
  };

  const handleDownload = async (
    reportId: string,
    format: 'pdf' | 'docx' | 'txt' | 'csv' | 'xlsx'
  ) => {
    setActionBusy(`${reportId}_${format}`);
    try {
      await downloadExistingManagedReport(reportId, format);
    } catch (err) {
      alert(err instanceof Error ? err.message : `Failed to download ${format.toUpperCase()}`);
    } finally {
      setActionBusy(null);
    }
  };

  const handleAdvanceStatus = async (
    reportId: string,
    action: 'review' | 'finalize' | 'archive'
  ) => {
    setActionBusy(`${reportId}_${action}`);
    try {
      if (action === 'review') await reviewReport(reportId);
      else if (action === 'finalize') await finalizeReport(reportId);
      else if (action === 'archive') await archiveReport(reportId);

      await fetchReports();
      if (selectedDetail && selectedDetail.id === reportId) {
        const updated = await getReportDetail(reportId);
        setSelectedDetail(updated);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : `Failed to update report status`);
    } finally {
      setActionBusy(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteReport(deleteTarget.id);
      setDeleteTarget(null);
      if (selectedDetail?.id === deleteTarget.id) {
        setSelectedDetail(null);
      }
      await fetchReports();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete report');
    } finally {
      setDeleteLoading(false);
    }
  };

  const statusBadge = (st: string) => {
    const map: Record<string, { bg: string; text: string }> = {
      draft: { bg: 'bg-amber-500/15 border-amber-500/30', text: 'text-amber-300' },
      generating: { bg: 'bg-teal-500/15 border-teal-500/30', text: 'text-teal-300' },
      generated: { bg: 'bg-blue-500/15 border-blue-500/30', text: 'text-blue-300' },
      under_review: { bg: 'bg-purple-500/15 border-purple-500/30', text: 'text-purple-300' },
      final: { bg: 'bg-emerald-500/15 border-emerald-500/30', text: 'text-emerald-300' },
      archived: { bg: 'bg-slate-500/15 border-slate-500/30', text: 'text-slate-400' },
      failed: { bg: 'bg-rose-500/15 border-rose-500/30', text: 'text-rose-400' },
    };
    const s = map[st] || { bg: 'bg-slate-500/15 border-slate-500/30', text: 'text-slate-400' };
    return (
      <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded border ${s.bg} ${s.text}`}>
        {st.replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border-color bg-[var(--bg-secondary)]/80 p-3.5">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search reports by title, type, hash..."
              className="w-full rounded-lg bg-[var(--bg-primary)] border border-border-color py-1.5 pl-9 pr-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-blue)]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg bg-[var(--bg-primary)] border border-border-color px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-blue)]"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="generated">Generated</option>
            <option value="under_review">Under Review</option>
            <option value="final">Finalized</option>
            <option value="archived">Archived</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <button
          type="button"
          onClick={fetchReports}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-border-color hover:border-[var(--accent-blue)] text-xs text-[var(--text-primary)] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[var(--accent-blue)]' : ''}`} />
          <span>Refresh Records</span>
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Reports Directory List */}
      <div className="rounded-xl border border-border-color bg-[var(--bg-secondary)]/50 overflow-hidden">
        {loading && reports.length === 0 ? (
          <div className="p-10 text-center text-xs uppercase font-mono text-[var(--text-muted)] space-y-2">
            <RefreshCw className="w-5 h-5 mx-auto animate-spin text-[var(--accent-blue)]" />
            <p>Loading authenticated report repository...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="p-10 text-center text-xs text-[var(--text-muted)] space-y-2">
            <History className="w-6 h-6 mx-auto opacity-40" />
            <p className="font-semibold text-[var(--text-primary)] uppercase tracking-wider">No Managed Reports Found</p>
            <p className="max-w-md mx-auto">
              Generated reports with cryptographically sealed snapshots and provenance will be archived here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border-color/60">
            {reports.map((report) => (
              <div
                key={report.id}
                className="p-4 hover:bg-[var(--bg-secondary)] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-xs font-bold text-[var(--text-primary)] truncate">
                      {report.title || `${report.report_type.toUpperCase()} Intelligence Report`}
                    </h4>
                    {statusBadge(report.status)}
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-[var(--bg-primary)] border border-border-color text-[var(--text-muted)]">
                      v{report.version}
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      {report.provenance.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--text-muted)] font-mono">
                    <span>TYPE: <strong className="text-[var(--text-secondary)]">{report.report_type}</strong></span>
                    <span>DISTRICT: <strong className="text-[var(--text-secondary)]">{report.district || 'State-Wide'}</strong></span>
                    <span>CREATED: <strong className="text-[var(--text-secondary)]">{new Date(report.created_at).toLocaleDateString()}</strong></span>
                    {report.integrity_hash && (
                      <span title={report.integrity_hash} className="truncate max-w-[140px]">
                        HASH: {report.integrity_hash.slice(0, 10)}...
                      </span>
                    )}
                  </div>
                </div>

                {/* Report Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab: 'ai_chat', targetId: report.id, targetType: 'report' } }))}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 text-xs text-purple-300 transition-colors"
                    title="Ask SAKSHA AI about this report"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Ask AI</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenDetail(report.id)}
                    disabled={actionBusy === report.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-border-color hover:border-[var(--accent-blue)] text-xs text-[var(--text-primary)] transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
                    <span>View Detail</span>
                  </button>

                  {/* Lifecycle status advance */}
                  {report.status === 'generated' && (
                    <button
                      type="button"
                      onClick={() => handleAdvanceStatus(report.id, 'review')}
                      disabled={!!actionBusy}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-500/15 border border-purple-500/30 hover:bg-purple-500/25 text-xs text-purple-300 transition-colors"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Start Review</span>
                    </button>
                  )}

                  {report.status === 'under_review' && (
                    <button
                      type="button"
                      onClick={() => handleAdvanceStatus(report.id, 'finalize')}
                      disabled={!!actionBusy}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25 text-xs text-emerald-300 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Finalize</span>
                    </button>
                  )}

                  {report.status === 'final' && (
                    <button
                      type="button"
                      onClick={() => handleAdvanceStatus(report.id, 'archive')}
                      disabled={!!actionBusy}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-500/15 border border-slate-500/30 hover:bg-slate-500/25 text-xs text-slate-300 transition-colors"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>Archive</span>
                    </button>
                  )}

                  {/* Export Options Dropdown */}
                  <div className="relative inline-block">
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          handleDownload(report.id, e.target.value as any);
                        }
                      }}
                      className="appearance-none inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0E9E78]/15 border border-[#0E9E78]/40 pl-7 pr-6 py-1.5 text-xs font-semibold text-emerald-400 cursor-pointer outline-none hover:bg-[#0E9E78]/25 transition-all"
                    >
                      <option value="" disabled hidden>
                        Download...
                      </option>
                      <option value="pdf" className="bg-[#0A1220] text-white">Download PDF</option>
                      <option value="docx" className="bg-[#0A1220] text-white">Download DOCX</option>
                      <option value="xlsx" className="bg-[#0A1220] text-white">Download XLSX</option>
                      <option value="csv" className="bg-[#0A1220] text-white">Download CSV</option>
                      <option value="txt" className="bg-[#0A1220] text-white">Download TXT</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2">
                      <Download className="h-3.5 w-3.5 text-[#0E9E78]" />
                    </div>
                  </div>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(report)}
                    className="p-1.5 rounded-lg border border-border-color hover:border-rose-500/40 bg-[var(--bg-primary)] hover:bg-rose-500/10 text-[var(--text-muted)] hover:text-rose-400 transition-colors"
                    title="Delete report"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Slide-out / Modal */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl border border-border-color bg-[var(--bg-primary)] p-6 space-y-4 shadow-2xl custom-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-border-color">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  {selectedDetail.title}
                </h3>
                <span className="text-[10px] font-mono text-[var(--text-muted)]">
                  Report ID: {selectedDetail.id}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="p-1 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="p-2 rounded bg-[var(--bg-secondary)]">
                <span className="text-[9px] uppercase text-[var(--text-muted)] block">Status</span>
                <strong className="text-[var(--text-primary)]">{selectedDetail.status}</strong>
              </div>
              <div className="p-2 rounded bg-[var(--bg-secondary)]">
                <span className="text-[9px] uppercase text-[var(--text-muted)] block">Version</span>
                <strong className="text-[var(--text-primary)]">v{selectedDetail.version}</strong>
              </div>
              <div className="p-2 rounded bg-[var(--bg-secondary)]">
                <span className="text-[9px] uppercase text-[var(--text-muted)] block">Provenance</span>
                <strong className="text-emerald-400">{selectedDetail.provenance}</strong>
              </div>
              <div className="p-2 rounded bg-[var(--bg-secondary)]">
                <span className="text-[9px] uppercase text-[var(--text-muted)] block">Records</span>
                <strong className="text-[var(--text-primary)]">{selectedDetail.snapshot_row_count} rows</strong>
              </div>
            </div>

            {selectedDetail.integrity_hash && (
              <div className="p-2.5 rounded-lg border border-border-color bg-[var(--bg-secondary)] text-[11px] font-mono space-y-1">
                <span className="text-[9px] uppercase text-[var(--text-muted)] block">SHA-256 Integrity Seal</span>
                <p className="text-xs text-[var(--accent-blue)] break-all">{selectedDetail.integrity_hash}</p>
              </div>
            )}

            {/* Versions List */}
            {selectedDetail.versions && selectedDetail.versions.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Version History
                </h4>
                <div className="space-y-1 text-xs font-mono">
                  {selectedDetail.versions.map((ver) => (
                    <div key={ver.id} className="p-2 rounded bg-[var(--bg-secondary)]/70 flex justify-between">
                      <span>v{ver.version_number} - {ver.reason || 'Snapshot'}</span>
                      <span className="text-[var(--text-muted)]">{new Date(ver.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Admin Audit History Toggle */}
            {isAdmin && auditEntries.length > 0 && (
              <div className="pt-2 border-t border-border-color space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-2">
                  <History className="w-3.5 h-3.5 text-amber-400" />
                  Administrative Audit Trail ({auditEntries.length} events)
                </h4>
                <div className="max-h-40 overflow-y-auto space-y-1.5 custom-scrollbar text-[11px] font-mono">
                  {auditEntries.map((a) => (
                    <div key={a.id} className="p-2 rounded bg-[var(--bg-secondary)]/50 flex justify-between">
                      <div>
                        <span className="font-semibold text-[var(--text-primary)]">{a.action}</span>
                        <span className="text-[var(--text-muted)] ml-2">{a.user || 'Unknown'}</span>
                      </div>
                      <span className="text-[var(--text-muted)]">{new Date(a.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-border-color">
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="px-4 py-2 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-secondary)]/80 text-xs text-[var(--text-primary)]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-rose-500/40 bg-[var(--bg-primary)] p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Confirm Report Deletion
                </h3>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Permanent removal of report snapshot and history
                </p>
              </div>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Are you sure you want to delete <strong className="text-[var(--text-primary)]">{deleteTarget.title || 'this report'}</strong>? 
              This will permanently delete the report, its cached exports, and cascade-remove linked versions. This action is auditable.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-border-color">
              <button
                type="button"
                disabled={deleteLoading}
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-secondary)]/80 text-xs text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={confirmDelete}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-semibold text-white transition-colors disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting...' : 'Delete Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
