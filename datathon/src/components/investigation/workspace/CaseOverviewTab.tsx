import React from 'react';
import {
  FileText,
  Users,
  Car,
  MapPin,
  Package,
  Microscope,
  Shield,
  Sparkles,
  ArrowRight,
  Activity,
} from 'lucide-react';
import type { InvestigationData } from '../../../services/api';

interface Props {
  data: InvestigationData;
  onNavigateTab: (tab: string) => void;
}

export const CaseOverviewTab: React.FC<Props> = ({ data, onNavigateTab }) => {
  const caseItem = data.case;
  const firsCount = data.firs.length;
  const criminalsCount = data.criminals.length;
  const vehiclesCount = data.vehicles?.length ?? 0;
  const locationsCount = data.locations?.length ?? 0;
  const evidenceCount = data.evidence.length;
  const forensicsCount = data.forensic_reports_count ?? 0;

  const STATS_CARDS = [
    {
      label: 'Linked FIRs',
      count: firsCount,
      tab: 'entities',
      icon: <FileText className="w-4 h-4 text-amber-400" />,
      subtext: firsCount === 1 ? '1 registered FIR' : `${firsCount} registered FIRs`,
    },
    {
      label: 'Persons of Interest',
      count: criminalsCount,
      tab: 'entities',
      icon: <Users className="w-4 h-4 text-blue-400" />,
      subtext: `${criminalsCount} accused / suspects`,
    },
    {
      label: 'Identified Vehicles',
      count: vehiclesCount,
      tab: 'entities',
      icon: <Car className="w-4 h-4 text-purple-400" />,
      subtext: `${vehiclesCount} seized or recorded`,
    },
    {
      label: 'Key Locations',
      count: locationsCount,
      tab: 'entities',
      icon: <MapPin className="w-4 h-4 text-cyan-400" />,
      subtext: `${locationsCount} scenes & stations`,
    },
    {
      label: 'Evidence Vault',
      count: evidenceCount,
      tab: 'evidence',
      icon: <Package className="w-4 h-4 text-emerald-400" />,
      subtext: `${evidenceCount} physical & digital items`,
    },
    {
      label: 'Forensic Reports',
      count: forensicsCount,
      tab: 'forensics',
      icon: <Microscope className="w-4 h-4 text-rose-400" />,
      subtext: `${forensicsCount} laboratory examinations`,
    },
  ];

  return (
    <div className="space-y-6 text-left">
      {/* Entity Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {STATS_CARDS.map((card, idx) => (
          <div
            key={idx}
            onClick={() => onNavigateTab(card.tab)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onNavigateTab(card.tab);
              }
            }}
            className="p-4 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl hover:border-[var(--accent-teal)]/50 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
                {card.icon}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--accent-teal)] transition-transform group-hover:translate-x-0.5" />
            </div>
            <div>
              <div className="text-2xl font-black text-[var(--text-primary)] font-mono">{card.count}</div>
              <div className="text-xs font-semibold text-[var(--text-primary)] mt-0.5">{card.label}</div>
              <div className="text-[10px] text-[var(--text-muted)] truncate mt-1">{card.subtext}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Two Column Layout: Case Narrative & Officer Dossier */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Executive Case Narrative */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl shadow-sm">
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-[var(--text-primary)] flex items-center gap-2 mb-3 border-b border-[var(--border-primary)]/60 pb-3">
              <FileText className="w-4 h-4 text-blue-400" />
              Executive Case Narrative
            </h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
              {caseItem.description || 'No detailed narrative logged for this crime case.'}
            </p>

            {data.firs.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[var(--border-primary)]/50 space-y-3">
                <div className="text-xs font-mono font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Primary Incident Report ({data.firs[0].fir_number})
                </div>
                <div className="p-3 bg-[var(--bg-tertiary)]/40 rounded-lg border border-[var(--border-primary)] text-xs text-[var(--text-secondary)]">
                  <div className="font-semibold text-[var(--text-primary)] mb-1">
                    Complainant: {data.firs[0].complainant_name} {data.firs[0].complainant_contact ? `(${data.firs[0].complainant_contact})` : ''}
                  </div>
                  <p className="italic leading-relaxed line-clamp-3">
                    "{data.firs[0].narrative || 'No FIR narrative statement recorded.'}"
                  </p>
                  <div className="mt-2 text-[10px] text-[var(--accent-teal)] font-mono">
                    Sections: {data.firs[0].sections || 'IPC'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* AI Case Insights Briefing */}
          {data.ai_recommendations.length > 0 && (
            <div className="p-5 bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-tertiary)]/30 border border-[var(--border-primary)] rounded-xl shadow-sm">
              <div className="flex items-center justify-between mb-3 border-b border-[var(--border-primary)]/60 pb-3">
                <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  Investigative Intelligence Leads
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold">
                  AI ASSISTED
                </span>
              </div>
              <div className="space-y-3">
                {data.ai_recommendations.slice(0, 3).map((rec, i) => (
                  <div key={i} className="p-3 bg-[var(--bg-secondary)]/90 border border-[var(--border-primary)] rounded-lg text-xs">
                    <div className="flex items-center justify-between font-semibold text-[var(--text-primary)] mb-1">
                      <span>{rec.title}</span>
                      <span className={`text-[9px] uppercase font-mono px-1.5 py-0.5 rounded ${
                        rec.priority === 'high' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      }`}>
                        {rec.priority}
                      </span>
                    </div>
                    <p className="text-[var(--text-secondary)] leading-relaxed">{rec.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Officer Dossier & Audit Feed */}
        <div className="space-y-6">
          {/* Assigned Officer Card */}
          <div className="p-5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl shadow-sm">
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-[var(--text-primary)] flex items-center gap-2 mb-3 border-b border-[var(--border-primary)]/60 pb-3">
              <Shield className="w-4 h-4 text-emerald-400" />
              Assigned Investigating Officer
            </h3>
            {caseItem.assigned_officer ? (
              <div className="space-y-2.5 text-xs">
                <div>
                  <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Officer Name</div>
                  <div className="font-bold text-sm text-[var(--text-primary)]">{caseItem.assigned_officer.full_name}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-primary)]/40">
                  <div>
                    <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Badge</div>
                    <div className="font-mono font-semibold text-[var(--text-primary)]">{caseItem.assigned_officer.badge_number}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Rank</div>
                    <div className="text-[var(--text-secondary)]">{caseItem.assigned_officer.rank || 'Officer'}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-primary)]/40">
                  <div>
                    <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Station</div>
                    <div className="text-[var(--text-secondary)] truncate">{caseItem.assigned_officer.station || caseItem.station}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">District</div>
                    <div className="text-[var(--text-secondary)] truncate">{caseItem.assigned_officer.district || caseItem.district}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-[var(--text-muted)]">
                No officer currently assigned to lead this case.
              </div>
            )}
          </div>

          {/* Recent Audit / History Feed */}
          <div className="p-5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl shadow-sm">
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-[var(--text-primary)] flex items-center gap-2 mb-3 border-b border-[var(--border-primary)]/60 pb-3">
              <Activity className="w-4 h-4 text-cyan-400" />
              Audit Log & Activity Feed
            </h3>
            {data.history.length === 0 ? (
              <div className="text-center py-4 text-xs text-[var(--text-muted)]">No audit entries recorded.</div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                {data.history.slice(0, 8).map((h, i) => (
                  <div key={i} className="text-xs p-2.5 rounded bg-[var(--bg-tertiary)]/40 border border-[var(--border-primary)]">
                    <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] font-mono">
                      <span>{h.action}</span>
                      <span>{new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {h.details && <div className="text-[var(--text-secondary)] mt-1 truncate">{h.details}</div>}
                    {h.officer_name && (
                      <div className="text-[10px] text-[var(--text-muted)] mt-1 font-mono">By: {h.officer_name}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
