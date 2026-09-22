import React, { useState } from 'react';
import {
  Package,
  FileDigit,
  ShieldCheck,
  ShieldAlert,
  ArrowRightLeft,
  Eye,
  Download,
  Clock,
  User,
  CheckCircle,
  Loader2,
  X,
  FileText,
  Key,
} from 'lucide-react';
import type {
  InvestigationEvidence,
  EvidenceHashVerification,
  CustodyTransferPayload,
} from '../../../services/api';
import {
  verifyEvidenceHash,
  transferEvidenceCustody,
  downloadEvidencePDF,
} from '../../../services/api';

interface Props {
  evidenceList: InvestigationEvidence[];
  caseNumber: string;
}

export const CaseEvidenceTab: React.FC<Props> = ({ evidenceList, caseNumber }) => {
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [hashResults, setHashResults] = useState<Record<string, EvidenceHashVerification>>({});
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Custody transfer modal state
  const [transferTargetItem, setTransferTargetItem] = useState<InvestigationEvidence | null>(null);
  const [transferPayload, setTransferPayload] = useState<CustodyTransferPayload>({
    to_user: '',
    action: 'Custody Handover',
    to_state: 'In Lab',
    location: 'State Forensic Science Laboratory (SFSL) Madiwala',
    reason: '',
  });
  const [transferring, setTransferring] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState<string | null>(null);

  // Preview modal state
  const [previewItem, setPreviewItem] = useState<InvestigationEvidence | null>(null);

  const handleVerifyHash = async (evidenceId: string) => {
    try {
      setVerifyingId(evidenceId);
      const res = await verifyEvidenceHash(evidenceId);
      setHashResults((prev) => ({ ...prev, [evidenceId]: res }));
    } catch (err: any) {
      console.error('Hash verification failed:', err);
      alert('Failed to complete SHA-256 integrity verification.');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleDownloadPDF = async (evidenceId: string, title?: string) => {
    try {
      setDownloadingId(evidenceId);
      const cleanTitle = (title || 'Evidence').replace(/[^a-zA-Z0-9_-]/g, '_');
      await downloadEvidencePDF(evidenceId, `KSP_${caseNumber}_${cleanTitle}.pdf`);
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to generate official evidence PDF certificate.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferTargetItem) return;
    if (!transferPayload.to_user.trim()) {
      alert('Please specify the recipient officer or laboratory identifier.');
      return;
    }

    try {
      setTransferring(true);
      await transferEvidenceCustody(transferTargetItem.id, transferPayload);
      setTransferSuccess(`Custody successfully transferred to ${transferPayload.to_user}.`);
      setTimeout(() => {
        setTransferSuccess(null);
        setTransferTargetItem(null);
      }, 1800);
    } catch (err: any) {
      console.error('Transfer failed:', err);
      alert('Failed to log custody transfer record.');
    } finally {
      setTransferring(false);
    }
  };

  if (evidenceList.length === 0) {
    return (
      <div className="p-12 text-center bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl text-xs text-[var(--text-muted)] space-y-2">
        <Package className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-50" />
        <p className="font-semibold text-[var(--text-primary)]">Evidence Vault is Empty</p>
        <p>No physical or digital evidence items have been registered for this case record yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left">
      {/* Vault Header Card */}
      <div className="p-4 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-mono uppercase font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-400" />
            Case Evidence Vault ({evidenceList.length} Items)
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Cryptographically sealed repository with SHA-256 integrity checks and formal chain-of-custody ledger.
          </p>
        </div>
        <span className="text-[10px] font-mono px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold uppercase self-start sm:self-auto">
          IMMUTABLE ORIGINALS PRESERVED
        </span>
      </div>

      {/* Evidence Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {evidenceList.map((item) => {
          const isVerifying = verifyingId === item.id;
          const isDownloading = downloadingId === item.id;
          const hashInfo = hashResults[item.id];

          return (
            <div
              key={item.id}
              className="p-5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl shadow-sm space-y-4 hover:border-emerald-500/30 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header & Type */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-emerald-400">
                      <FileDigit className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="font-bold text-sm text-[var(--text-primary)]">
                        {item.description || `Exhibit #${item.id.slice(0, 8)}`}
                      </h4>
                      <span className="text-[10px] font-mono uppercase text-[var(--text-muted)]">
                        Type: {item.evidence_type}
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    Logged
                  </span>
                </div>

                {/* Meta details */}
                <div className="grid grid-cols-2 gap-2 text-xs text-[var(--text-muted)] mt-3 pt-3 border-t border-[var(--border-primary)]/40">
                  <div className="flex items-center gap-1.5 truncate">
                    <User className="w-3 h-3 text-blue-400 shrink-0" />
                    <span className="truncate">Collector: {item.collected_by || 'Investigator'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                    <Clock className="w-3 h-3 text-purple-400 shrink-0" />
                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Real-time Hash Status Display */}
                {hashInfo && (
                  <div
                    className={`mt-3 p-3 rounded-lg border text-xs font-mono space-y-1.5 ${
                      hashInfo.verified
                        ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold uppercase text-[10px]">
                      {hashInfo.verified ? (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>INTEGRITY VERIFIED (SHA-256 MATCH)</span>
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                          <span>INTEGRITY WARNING (MISMATCH)</span>
                        </>
                      )}
                    </div>
                    <div className="text-[10px] truncate text-[var(--text-muted)]">
                      SHA256: {hashInfo.recorded_hash.slice(0, 24)}...
                    </div>
                    <div className="text-[10px] text-[var(--text-secondary)]">{hashInfo.message}</div>
                  </div>
                )}
              </div>

              {/* Action Toolbar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-[var(--border-primary)]/40 text-xs">
                {/* Verify Button */}
                <button
                  onClick={() => handleVerifyHash(item.id)}
                  disabled={isVerifying}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-tertiary)] hover:bg-emerald-500/15 border border-[var(--border-primary)] text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                >
                  {isVerifying ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Key className="w-3.5 h-3.5" />
                  )}
                  <span>{hashInfo?.verified ? 'Re-Verify' : 'Verify Hash'}</span>
                </button>

                {/* Handover / Transfer Button */}
                <button
                  onClick={() => setTransferTargetItem(item)}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-tertiary)] hover:bg-blue-500/15 border border-[var(--border-primary)] text-blue-400 hover:text-blue-300 font-medium transition-colors"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Transfer</span>
                </button>

                {/* Preview Button */}
                <button
                  onClick={() => setPreviewItem(item)}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-tertiary)] hover:bg-purple-500/15 border border-[var(--border-primary)] text-purple-400 hover:text-purple-300 font-medium transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview</span>
                </button>

                {/* Download Certificate Button */}
                <button
                  onClick={() => handleDownloadPDF(item.id, item.description || undefined)}
                  disabled={isDownloading}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-tertiary)] hover:bg-cyan-500/15 border border-[var(--border-primary)] text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                >
                  {isDownloading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>PDF Cert</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Custody Transfer Modal */}
      {transferTargetItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-primary)]/60 pb-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase">
                  Chain of Custody Transfer
                </h3>
              </div>
              <button
                onClick={() => setTransferTargetItem(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {transferSuccess ? (
              <div className="p-4 bg-emerald-950/30 border border-emerald-500/40 rounded-xl text-center text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4" />
                <span>{transferSuccess}</span>
              </div>
            ) : (
              <form onSubmit={handleExecuteTransfer} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
                    Exhibit Description
                  </label>
                  <input
                    type="text"
                    disabled
                    value={transferTargetItem.description || `Exhibit #${transferTargetItem.id.slice(0, 8)}`}
                    className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-secondary)]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
                    Transfer Recipient / Laboratory Officer *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Officer Badge (SP-0088), Name, or Lab Custodian"
                    value={transferPayload.to_user}
                    onChange={(e) => setTransferPayload({ ...transferPayload, to_user: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] focus:border-[var(--accent-teal)] outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
                      Target State
                    </label>
                    <select
                      value={transferPayload.to_state}
                      onChange={(e) => setTransferPayload({ ...transferPayload, to_state: e.target.value })}
                      className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] outline-none"
                    >
                      <option value="In Forensic Lab">In Forensic Lab</option>
                      <option value="Vault Storage">Vault Storage</option>
                      <option value="Court Production">Court Production</option>
                      <option value="Under Inspection">Under Inspection</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
                      Action Type
                    </label>
                    <input
                      type="text"
                      value={transferPayload.action}
                      onChange={(e) => setTransferPayload({ ...transferPayload, action: e.target.value })}
                      className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={transferPayload.location || ''}
                    onChange={(e) => setTransferPayload({ ...transferPayload, location: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
                    Reason & Handover Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Enter formal reason for custody transfer..."
                    value={transferPayload.reason || ''}
                    onChange={(e) => setTransferPayload({ ...transferPayload, reason: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] outline-none resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setTransferTargetItem(null)}
                    className="px-4 py-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-primary)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={transferring}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2"
                  >
                    {transferring && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm Handover</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Browser-Safe Media Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-primary)]/60 pb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Exhibit Preview: {previewItem.description || previewItem.id.slice(0, 8)}
                </h3>
              </div>
              <button onClick={() => setPreviewItem(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[var(--bg-primary)] rounded-xl border border-[var(--border-primary)] min-h-[250px] flex items-center justify-center p-6 text-center">
              {previewItem.file_url ? (
                previewItem.evidence_type.toLowerCase().includes('image') ? (
                  <img
                    src={previewItem.file_url}
                    alt={previewItem.description || 'Evidence preview'}
                    className="max-h-[350px] object-contain rounded-lg shadow"
                  />
                ) : previewItem.evidence_type.toLowerCase().includes('video') ? (
                  <video controls src={previewItem.file_url} className="max-h-[350px] rounded-lg w-full" />
                ) : previewItem.evidence_type.toLowerCase().includes('audio') ? (
                  <audio controls src={previewItem.file_url} className="w-full" />
                ) : (
                  <iframe src={previewItem.file_url} title="Document Preview" className="w-full h-[350px] rounded-lg" />
                )
              ) : (
                <div className="space-y-2 text-xs text-[var(--text-muted)]">
                  <FileText className="w-8 h-8 mx-auto text-[var(--text-muted)] opacity-50" />
                  <p className="font-semibold text-[var(--text-primary)]">Stored in Secure Evidence Vault</p>
                  <p>Exhibit is sealed in local physical/digital archive under custody controls.</p>
                  <p className="font-mono text-[10px] text-cyan-400">ID: {previewItem.id}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => handleDownloadPDF(previewItem.id, previewItem.description || undefined)}
                className="px-4 py-2 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80 text-[var(--text-primary)] border border-[var(--border-primary)] text-xs font-medium flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Certificate</span>
              </button>
              <button
                onClick={() => setPreviewItem(null)}
                className="px-4 py-2 rounded-lg bg-[var(--accent-teal)] text-slate-950 text-xs font-bold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
