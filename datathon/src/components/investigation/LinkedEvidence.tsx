import React, { useState } from 'react';
import { Package, FileDigit, User, Link as LinkIcon, Clock, Download, FileText, Loader2 } from 'lucide-react';
import { downloadEvidencePDF, type InvestigationEvidence } from '../../services/api';

interface Props {
  evidence: InvestigationEvidence[];
}

const navigateTo = (tab: string, targetId?: string) => {
  window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab, targetId } }));
};

const typeConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  digital: { icon: <FileDigit className="w-3.5 h-3.5" />, color: 'text-cyan-400 bg-cyan-950/40 border-cyan-800/60' },
  physical: { icon: <Package className="w-3.5 h-3.5" />, color: 'text-amber-400 bg-amber-950/40 border-amber-800/60' },
  document: { icon: <FileDigit className="w-3.5 h-3.5" />, color: 'text-blue-400 bg-blue-950/40 border-blue-800/60' },
  biological: { icon: <Package className="w-3.5 h-3.5" />, color: 'text-red-400 bg-red-950/40 border-red-800/60' },
};

const LinkedEvidence: React.FC<Props> = ({ evidence }) => {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (evidenceId: string, customName?: string) => {
    try {
      setDownloadingId(evidenceId);
      const filename = customName ? `${customName.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf` : `KSP_Evidence_${evidenceId.slice(0, 8)}.pdf`;
      await downloadEvidencePDF(evidenceId, filename);
    } catch (err) {
      console.error('Evidence PDF download error:', err);
      alert('Failed to generate and download evidence PDF certificate.');
    } finally {
      setDownloadingId(null);
    }
  };

  if (evidence.length === 0) {
    return (
      <div className="p-5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl text-left">
        <h3 className="text-xs uppercase tracking-wider font-bold text-[var(--text-primary)] flex items-center gap-2 mb-4 border-b border-[var(--border-primary)]/60 pb-3 font-mono">
          <Package className="w-4 h-4 text-emerald-400" /> Evidence Registry
        </h3>
        <p className="text-xs text-[var(--text-muted)] py-4 text-center">No evidence logged for this case.</p>
      </div>
    );
  }

  return (
    <div className="p-5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl text-left">
      <div className="flex justify-between items-center mb-4 border-b border-[var(--border-primary)]/60 pb-3">
        <h3 className="text-xs uppercase tracking-wider font-bold text-[var(--text-primary)] flex items-center gap-2 font-mono">
          <Package className="w-4 h-4 text-emerald-400" /> Evidence Registry
        </h3>
        <span className="text-[10px] text-[var(--text-muted)] font-mono font-bold">{evidence.length} ITEMS</span>
      </div>

      <div className="space-y-3 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
        {evidence.map((item) => {
          const config = typeConfig[item.evidence_type] || typeConfig.document;
          const isDownloading = downloadingId === item.id;

          return (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => navigateTo('evidence', item.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigateTo('evidence', item.id);
                }
              }}
              className="p-3.5 bg-[var(--bg-tertiary)]/30 border border-[var(--border-primary)] rounded-xl hover:border-emerald-800/40 transition-colors cursor-pointer"
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className={`p-1 rounded-md border ${config.color}`}>{config.icon}</span>
                  <span className="text-xs font-bold text-[var(--text-primary)] uppercase">{item.evidence_type}</span>
                </div>
                <span className={`px-2 py-0.5 text-[10px] rounded-md font-semibold uppercase border ${config.color}`}>
                  {item.evidence_type}
                </span>
              </div>

              {/* Description */}
              {item.description && (
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-2.5">{item.description}</p>
              )}

              {/* Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[var(--text-muted)]">
                {item.collected_by && (
                  <div className="flex items-center gap-1.5 truncate">
                    <User className="w-3.5 h-3.5 text-[#1E6FD9] shrink-0" />
                    <span className="truncate">COLLECTED BY: {item.collected_by}</span>
                  </div>
                )}
                {item.created_at && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              {/* Chain of custody */}
              {item.chain_of_custody && (
                <div className="flex items-start gap-1.5 mt-2.5 pt-2 border-t border-[var(--border-primary)]/40 text-[11px] text-[var(--text-muted)]">
                  <LinkIcon className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" />
                  <span className="leading-relaxed">{item.chain_of_custody}</span>
                </div>
              )}

              {/* Certified PDF Evidence Download Button */}
              <div className="mt-2.5 pt-2.5 border-t border-[var(--border-primary)]/50 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-[#1E6FD9] shrink-0" />
                  <span className="text-xs text-[var(--text-primary)] font-mono truncate font-medium">
                    Evidence_Certificate_{item.id.slice(0, 8)}.pdf
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDownload(item.id, `KSP_Evidence_${item.id.slice(0, 8)}`);
                  }}
                  disabled={isDownloading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1E6FD9]/15 hover:bg-[#1E6FD9]/25 text-[#1E6FD9] border border-[#1E6FD9]/40 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 shadow-xs disabled:opacity-50"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Download PDF</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LinkedEvidence;
