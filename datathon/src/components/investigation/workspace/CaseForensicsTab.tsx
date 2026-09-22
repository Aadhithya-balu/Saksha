import React, { useState, useEffect } from 'react';
import {
  Microscope,
  ShieldCheck,
  Download,
  Plus,
  Clock,
  User,
  Building2,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Loader2,
  X,
  Binary,
  Flame,
  Fingerprint,
  Dna,
  FileSearch,
} from 'lucide-react';
import type {
  ForensicReportRecord,
  ForensicReportCreatePayload,
  ForensicReportVerifyPayload,
  InvestigationEvidence,
} from '../../../services/api';
import {
  getCaseForensics,
  createForensicReport,
  verifyForensicReport,
  downloadForensicReportPDF,
} from '../../../services/api';

interface Props {
  caseId: string;
  caseNumber: string;
  evidenceList?: InvestigationEvidence[];
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  digital: <Binary className="w-4 h-4 text-cyan-400" />,
  cyber: <Binary className="w-4 h-4 text-cyan-400" />,
  ballistics: <Flame className="w-4 h-4 text-amber-400" />,
  fingerprint: <Fingerprint className="w-4 h-4 text-purple-400" />,
  dna: <Dna className="w-4 h-4 text-emerald-400" />,
  toxicology: <Microscope className="w-4 h-4 text-rose-400" />,
  chemical: <Microscope className="w-4 h-4 text-rose-400" />,
  document: <FileSearch className="w-4 h-4 text-blue-400" />,
};

export const CaseForensicsTab: React.FC<Props> = ({ caseId, caseNumber, evidenceList = [] }) => {
  const [reports, setReports] = useState<ForensicReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Verification modal state
  const [verifyTarget, setVerifyTarget] = useState<ForensicReportRecord | null>(null);
  const [verifyPayload, setVerifyPayload] = useState<ForensicReportVerifyPayload>({
    status: 'verified',
    verification_notes: '',
  });
  const [verifying, setVerifying] = useState(false);
  const [verifySuccess, setVerifySuccess] = useState<string | null>(null);

  // New Report modal state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newPayload, setNewPayload] = useState<ForensicReportCreatePayload>({
    case_id: caseId,
    title: '',
    forensic_type: 'digital',
    examiner_name: 'Dr. C. Rao, Senior Scientific Officer',
    lab_name: 'State Forensic Science Laboratory (SFSL) Madiwala, Bengaluru',
    status: 'submitted',
    findings: '',
    methodology: '',
    ai_assisted: false,
    ai_notes: '',
  });

  const loadReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCaseForensics(caseId);
      setReports(data || []);
    } catch (err: any) {
      console.error('Failed to load forensic reports:', err);
      setError(err?.message || 'Failed to load forensic examination records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (caseId) {
      loadReports();
    }
  }, [caseId]);

  const handleDownloadPDF = async (report: ForensicReportRecord) => {
    try {
      setDownloadingId(report.id);
      const cleanTitle = (report.title || 'Report').replace(/[^a-zA-Z0-9_-]/g, '_');
      await downloadForensicReportPDF(
        report.id,
        `SFSL_Report_${caseNumber}_${cleanTitle}.pdf`
      );
    } catch (err) {
      console.error('Failed to export forensic PDF:', err);
      alert('Failed to generate certified SFSL forensic report PDF.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleExecuteVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyTarget) return;

    try {
      setVerifying(true);
      const updated = await verifyForensicReport(verifyTarget.id, verifyPayload);
      setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setVerifySuccess('Forensic examination successfully verified and certified by officer.');
      setTimeout(() => {
        setVerifySuccess(null);
        setVerifyTarget(null);
      }, 1500);
    } catch (err: any) {
      console.error('Failed to verify forensic report:', err);
      alert('Verification failed: ' + (err?.message || 'Unauthorized or server error.'));
    } finally {
      setVerifying(false);
    }
  };

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPayload.title.trim()) {
      alert('Report title is required.');
      return;
    }

    try {
      setCreating(true);
      const created = await createForensicReport({ ...newPayload, case_id: caseId });
      setReports((prev) => [created, ...prev]);
      setIsNewModalOpen(false);
      setNewPayload({
        case_id: caseId,
        title: '',
        forensic_type: 'digital',
        examiner_name: 'Dr. C. Rao, Senior Scientific Officer',
        lab_name: 'State Forensic Science Laboratory (SFSL) Madiwala, Bengaluru',
        status: 'submitted',
        findings: '',
        methodology: '',
        ai_assisted: false,
        ai_notes: '',
      });
    } catch (err: any) {
      console.error('Failed to create forensic report:', err);
      alert('Failed to create forensic examination: ' + (err?.message || 'Error occurred.'));
    } finally {
      setCreating(false);
    }
  };

  const filteredReports = reports.filter((r) => {
    if (typeFilter === 'all') return true;
    return r.forensic_type.toLowerCase() === typeFilter.toLowerCase();
  });

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('court') || s.includes('verified')) {
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    }
    if (s.includes('progress')) {
      return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    }
    if (s.includes('preliminary')) {
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    }
    return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
  };

  return (
    <div className="space-y-6 text-left">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
              <Microscope className="w-5 h-5 text-rose-400" />
            </span>
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              Forensic Examinations & SFSL Lab Reports
            </h2>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Certified State Forensic Science Laboratory (SFSL) analyses, digital evidence extraction, ballistics, and officer verification records.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Forensic Request</span>
          </button>
        </div>
      </div>

      {/* Forensic Type Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar text-xs">
        {['all', 'digital', 'cyber', 'ballistics', 'fingerprint', 'dna', 'toxicology', 'chemical', 'document'].map(
          (t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg font-medium capitalize whitespace-nowrap transition-all cursor-pointer ${
                typeFilter === t
                  ? 'bg-rose-500 text-white font-bold'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-primary)]'
              }`}
            >
              {t === 'all' ? `All Reports (${reports.length})` : t}
            </button>
          )
        )}
      </div>

      {/* Report Cards / List */}
      {loading ? (
        <div className="p-12 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-rose-400" />
          Loading certified forensic examination dossiers…
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
          {error}
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="p-12 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)] border border-dashed border-[var(--border-primary)] rounded-xl">
          <Microscope className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2 opacity-50" />
          No forensic reports filed for this filter. Click &ldquo;New Forensic Request&rdquo; to log a laboratory analysis.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl shadow-md overflow-hidden hover:border-rose-500/30 transition-all"
            >
              {/* Card Header */}
              <div className="p-4 sm:p-5 border-b border-[var(--border-primary)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[var(--bg-tertiary)]/20">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)] shrink-0">
                    {TYPE_ICONS[report.forensic_type.toLowerCase()] || <Microscope className="w-5 h-5 text-rose-400" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-primary)]">
                        {report.forensic_type} Examination
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase ${getStatusBadge(report.status)}`}>
                        {report.status.replace(/_/g, ' ')}
                      </span>
                      {report.ai_assisted && (
                        <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                          <Sparkles className="w-3 h-3 text-purple-400" />
                          AI-Assisted
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)]">
                      {report.title}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={() => handleDownloadPDF(report)}
                    disabled={downloadingId === report.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)] border border-[var(--border-primary)] text-[var(--text-primary)] transition-all cursor-pointer"
                    title="Export SFSL Certified PDF Report"
                  >
                    {downloadingId === report.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                    ) : (
                      <Download className="w-3.5 h-3.5 text-rose-400" />
                    )}
                    <span>Certified PDF</span>
                  </button>

                  <button
                    onClick={() => {
                      setVerifyTarget(report);
                      setVerifyPayload({
                        status: 'verified',
                        verification_notes: report.verified_by ? `Re-verified by officer.` : 'Examined findings and certified for judicial case diary.',
                      });
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer"
                    title="Sign-off and verify report as certified officer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{report.verified_by ? 'Update Sign-Off' : 'Verify & Sign Off'}</span>
                  </button>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 sm:p-5 space-y-4">
                {/* Officer Human Verification Safeguard Banner */}
                {report.verified_by ? (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <span className="font-semibold">Human Verified & Certified: </span>
                        <span>{report.verified_by}</span>
                        {report.verified_at && (
                          <span className="text-[10px] text-emerald-400/80 ml-2 font-mono">
                            ({new Date(report.verified_at).toLocaleString()})
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/20 font-bold">
                      Court Admissible
                    </span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Pending Certified Officer Sign-Off: </span>
                      <span>
                        Under Section 45 Indian Evidence Act and KSP procedure, preliminary findings and automated inferences require verification by an authorized Inspector or Forensic Officer prior to judicial submission.
                      </span>
                    </div>
                  </div>
                )}

                {/* Laboratory and Examiner Metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-[var(--bg-tertiary)]/50 border border-[var(--border-primary)]/70">
                    <div className="text-[10px] uppercase font-mono text-[var(--text-muted)] flex items-center gap-1.5 mb-1">
                      <Building2 className="w-3 h-3 text-rose-400" /> Examining Laboratory
                    </div>
                    <div className="font-medium text-[var(--text-primary)]">
                      {report.lab_name}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[var(--bg-tertiary)]/50 border border-[var(--border-primary)]/70">
                    <div className="text-[10px] uppercase font-mono text-[var(--text-muted)] flex items-center gap-1.5 mb-1">
                      <User className="w-3 h-3 text-rose-400" /> Scientific Examiner
                    </div>
                    <div className="font-medium text-[var(--text-primary)]">
                      {report.examiner_name}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[var(--bg-tertiary)]/50 border border-[var(--border-primary)]/70">
                    <div className="text-[10px] uppercase font-mono text-[var(--text-muted)] flex items-center gap-1.5 mb-1">
                      <Clock className="w-3 h-3 text-rose-400" /> Examination Date
                    </div>
                    <div className="font-mono text-[var(--text-secondary)]">
                      {new Date(report.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Findings Section */}
                {report.findings && (
                  <div>
                    <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                      Laboratory Findings & Conclusions
                    </h4>
                    <div className="p-3 rounded-lg bg-[var(--bg-tertiary)]/40 border border-[var(--border-primary)] text-xs text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
                      {report.findings}
                    </div>
                  </div>
                )}

                {/* Methodology Section */}
                {report.methodology && (
                  <div>
                    <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                      Examination Methodology & Standards
                    </h4>
                    <div className="p-2.5 rounded-lg bg-[var(--bg-tertiary)]/20 border border-[var(--border-primary)] text-xs text-[var(--text-secondary)] leading-relaxed">
                      {report.methodology}
                    </div>
                  </div>
                )}

                {/* AI-Assisted Disclosure */}
                {report.ai_assisted && report.ai_notes && (
                  <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30 text-xs text-purple-200">
                    <div className="flex items-center gap-1.5 font-bold mb-1 text-purple-300">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      <span>AI Assistance & Automated Extraction Notes</span>
                    </div>
                    <div className="text-[11px] leading-relaxed text-purple-200/90 whitespace-pre-wrap font-mono">
                      {report.ai_notes}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Verification Sign-Off Modal */}
      {verifyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-primary)] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Officer Verification & Sign-Off
                </h3>
              </div>
              <button
                onClick={() => setVerifyTarget(null)}
                className="p-1 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)]">
              Sign off on <strong className="text-[var(--text-primary)]">{verifyTarget.title}</strong>. This records your certified credentials in the immutable audit ledger.
            </p>

            {verifySuccess ? (
              <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs flex items-center gap-2 font-medium">
                <CheckCircle className="w-4 h-4" />
                {verifySuccess}
              </div>
            ) : (
              <form onSubmit={handleExecuteVerification} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
                    Certification Status
                  </label>
                  <select
                    value={verifyPayload.status}
                    onChange={(e) => setVerifyPayload((p) => ({ ...p, status: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] outline-none focus:border-emerald-500"
                  >
                    <option value="verified">Verified by Officer</option>
                    <option value="court_ready">Court Ready (Final SFSL Certified)</option>
                    <option value="in_progress">Return for Further Analysis</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
                    Verification Notes & Observations
                  </label>
                  <textarea
                    rows={3}
                    value={verifyPayload.verification_notes || ''}
                    onChange={(e) =>
                      setVerifyPayload((p) => ({ ...p, verification_notes: e.target.value }))
                    }
                    placeholder="Enter formal sign-off remarks, corroborating physical evidence, and verification protocol..."
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setVerifyTarget(null)}
                    className="px-4 py-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={verifying}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md disabled:opacity-50"
                  >
                    {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    <span>Confirm Sign-Off</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* New Forensic Request Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-[var(--border-primary)] pb-3">
              <div className="flex items-center gap-2">
                <Microscope className="w-5 h-5 text-rose-400" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Log Forensic Examination Report
                </h3>
              </div>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="p-1 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateReport} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
                  Examination / Report Title *
                </label>
                <input
                  type="text"
                  required
                  value={newPayload.title}
                  onChange={(e) => setNewPayload((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Ballistics striation comparison of recovered 7.65mm casing"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
                    Forensic Discipline *
                  </label>
                  <select
                    value={newPayload.forensic_type}
                    onChange={(e) => setNewPayload((p) => ({ ...p, forensic_type: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] outline-none focus:border-rose-500"
                  >
                    <option value="digital">Digital Forensics</option>
                    <option value="cyber">Cyber & Mobile Forensics</option>
                    <option value="ballistics">Ballistics & Firearms</option>
                    <option value="fingerprint">Latent Fingerprints</option>
                    <option value="dna">DNA Profiling</option>
                    <option value="toxicology">Toxicology Analysis</option>
                    <option value="chemical">Chemical Examination</option>
                    <option value="document">Questioned Documents</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
                    Linked Evidence Item (Optional)
                  </label>
                  <select
                    value={newPayload.evidence_id || ''}
                    onChange={(e) =>
                      setNewPayload((p) => ({ ...p, evidence_id: e.target.value || undefined }))
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] outline-none focus:border-rose-500"
                  >
                    <option value="">-- No specific item linked --</option>
                    {evidenceList.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title || ev.description || `Exhibit #${ev.id.slice(0, 8)}`} ({ev.evidence_type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
                    Scientific Examiner
                  </label>
                  <input
                    type="text"
                    value={newPayload.examiner_name || ''}
                    onChange={(e) => setNewPayload((p) => ({ ...p, examiner_name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
                    Laboratory Facility
                  </label>
                  <input
                    type="text"
                    value={newPayload.lab_name || ''}
                    onChange={(e) => setNewPayload((p) => ({ ...p, lab_name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
                  Findings & Expert Conclusions
                </label>
                <textarea
                  rows={3}
                  value={newPayload.findings || ''}
                  onChange={(e) => setNewPayload((p) => ({ ...p, findings: e.target.value }))}
                  placeholder="Detail laboratory test results, matching striations, recovered data fragments..."
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
                  Methodology & Testing Protocols
                </label>
                <input
                  type="text"
                  value={newPayload.methodology || ''}
                  onChange={(e) => setNewPayload((p) => ({ ...p, methodology: e.target.value }))}
                  placeholder="e.g. Comparison microscope examination, ISO 17025 accredited protocol"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] outline-none focus:border-rose-500"
                />
              </div>

              <div className="p-3 rounded-lg bg-[var(--bg-tertiary)]/50 border border-[var(--border-primary)] space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newPayload.ai_assisted || false}
                    onChange={(e) =>
                      setNewPayload((p) => ({ ...p, ai_assisted: e.target.checked }))
                    }
                    className="rounded border-[var(--border-primary)] text-purple-600 focus:ring-0"
                  />
                  <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    Assisted by AI or Automated Extraction Model
                  </span>
                </label>

                {newPayload.ai_assisted && (
                  <textarea
                    rows={2}
                    value={newPayload.ai_notes || ''}
                    onChange={(e) => setNewPayload((p) => ({ ...p, ai_notes: e.target.value }))}
                    placeholder="Specify AI models, confidence scores, or automated extraction parameters..."
                    className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] outline-none focus:border-purple-500 text-xs font-mono"
                  />
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold shadow-md disabled:opacity-50"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span>Log Examination</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
