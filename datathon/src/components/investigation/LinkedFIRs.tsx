import React from 'react';
import { FileText, User, Users, Scale } from 'lucide-react';
import type { InvestigationFIR } from '../../services/api';

interface Props {
  firs: InvestigationFIR[];
}

const navigateTo = (tab: string, targetId?: string) => {
  window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab, targetId } }));
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'closed':
      return <span className="px-1.5 py-0.5 bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 text-[8px] rounded font-bold uppercase">CLOSED</span>;
    case 'in_progress':
      return <span className="px-1.5 py-0.5 bg-amber-950/40 text-amber-400 border border-amber-900/40 text-[8px] rounded font-bold uppercase">ACTIVE</span>;
    default:
      return <span className="px-1.5 py-0.5 bg-blue-950/40 text-blue-400 border border-blue-900/40 text-[8px] rounded font-bold uppercase">REGISTERED</span>;
  }
};

const LinkedFIRs: React.FC<Props> = ({ firs }) => {
  return (
    <div className="p-5 bg-secondary-bg border border-border-color rounded-card">
      <div className="flex justify-between items-center mb-4 border-b border-border-color/60 pb-3">
        <h3 className="text-xs uppercase tracking-wider font-bold text-[var(--text-primary)] flex items-center gap-2">
          <FileText className="w-4 h-4 text-[var(--accent-blue)]" /> Linked FIR Records
        </h3>
        <span className="text-[10px] text-[var(--text-muted)] font-bold">{firs.length} FILED</span>
      </div>

      {firs.length === 0 ? (
        <p className="text-[10px] text-[var(--text-muted)] py-4 text-center uppercase">NO FIRs LINKED TO THIS CASE.</p>
      ) : (
        <div className="space-y-3 max-h-[350px] overflow-y-auto custom-scrollbar pr-1">
          {firs.map((fir) => (
            <button
              key={fir.id}
              onClick={() => navigateTo('fir', fir.id)}
              className="w-full text-left cursor-pointer p-3 bg-[var(--bg-secondary)]/40 border border-border-color/40 rounded hover:border-[var(--accent-blue)]/20 transition-colors"
            >
              {/* FIR Header */}
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="text-[11px] font-bold text-[var(--text-primary)] uppercase">{fir.fir_number}</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <User className="w-3 h-3 text-[var(--text-muted)]" />
                    <span className="text-[9px] text-[var(--text-secondary)]">{fir.complainant_name}</span>
                  </div>
                </div>
                {getStatusBadge(fir.status)}
              </div>

              {/* Sections */}
              {fir.sections && (
                <div className="flex items-center gap-1.5 mt-2">
                  <Scale className="w-3 h-3 text-amber-500" />
                  <span className="text-[8.5px] text-amber-400 font-mono">{fir.sections}</span>
                </div>
              )}

              {/* Linked persons summary */}
              <div className="flex gap-4 mt-2 text-[8px] text-[var(--text-muted)] uppercase">
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3 text-red-400" />
                  <span>{fir.criminals.length} accused</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3 text-blue-400" />
                  <span>{fir.victims.length} victims</span>
                </div>
              </div>

              {/* Narrative excerpt */}
              {fir.narrative && (
                <p className="text-[8.5px] text-[var(--text-muted)] mt-2 line-clamp-2 leading-relaxed border-t border-[var(--border-primary)] pt-2">
                  {fir.narrative}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LinkedFIRs;

