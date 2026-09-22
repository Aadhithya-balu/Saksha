import React from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Copy,
  Check,
  Building2,
  Tag,
} from 'lucide-react';
import type { InvestigationCase } from '../../../services/api';

interface Props {
  caseData: InvestigationCase;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  tabCounts: Record<string, number>;
}

export const CaseHeader: React.FC<Props> = ({ caseData, activeTab, onSelectTab, tabCounts }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(caseData.case_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('closed') || s.includes('solved')) {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    }
    if (s.includes('charge') || s.includes('court')) {
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    }
    if (s.includes('investigat')) {
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
    }
    return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  };

  const getPriorityBadge = (priority: string) => {
    const p = priority.toLowerCase();
    if (p === 'critical') return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    if (p === 'high') return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    if (p === 'medium') return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
  };

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'timeline', label: 'Timeline', count: tabCounts.timeline },
    { id: 'entities', label: 'Entities', count: tabCounts.entities },
    { id: 'graph', label: 'Network Graph' },
    { id: 'evidence', label: 'Evidence Vault', count: tabCounts.evidence },
    { id: 'forensics', label: 'Forensics', count: tabCounts.forensics },
    { id: 'alerts', label: 'MO & Related Cases' },
    { id: 'assistant', label: 'AI Copilot' },
  ];

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl shadow-lg overflow-hidden">
      {/* Top Banner & Identifiers */}
      <div className="p-5 md:p-6 border-b border-[var(--border-primary)]/70 bg-gradient-to-r from-[var(--bg-secondary)] via-[var(--bg-tertiary)]/20 to-[var(--bg-secondary)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[10px] font-mono tracking-widest uppercase px-2 py-0.5 rounded bg-[var(--accent-teal)]/10 text-[var(--accent-teal)] border border-[var(--accent-teal)]/20 font-bold">
                KSP SAKSHA WORKSPACE
              </span>
              <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border uppercase ${getStatusBadge(caseData.status)}`}>
                {caseData.status.replace(/_/g, ' ')}
              </span>
              <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border uppercase ${getPriorityBadge(caseData.priority)}`}>
                {caseData.priority} Priority
              </span>
              {caseData.crime_type && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-primary)]">
                  {caseData.crime_type}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-black text-[var(--text-primary)] font-mono tracking-tight">
                {caseData.case_number}
              </h1>
              <button
                onClick={handleCopy}
                title="Copy Case Number"
                className="p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {caseData.description && (
              <p className="text-xs text-[var(--text-secondary)] mt-2 max-w-3xl leading-relaxed line-clamp-2">
                {caseData.description}
              </p>
            )}
          </div>

          {/* Quick Metrics & Progress */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3 min-w-[200px]">
            <div className="w-full sm:w-48 lg:w-48">
              <div className="flex justify-between text-[11px] font-mono mb-1 text-[var(--text-muted)]">
                <span>INVESTIGATION PROGRESS</span>
                <span className="font-bold text-[var(--text-primary)]">{caseData.progress}%</span>
              </div>
              <div className="w-full h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden border border-[var(--border-primary)]">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(5, Math.min(100, caseData.progress))}%` }}
                />
              </div>
            </div>

            <div className="text-[11px] text-[var(--text-muted)] font-mono">
              Last modified: {caseData.updated_at ? new Date(caseData.updated_at).toLocaleDateString() : 'Recent'}
            </div>
          </div>
        </div>

        {/* Structured Case Particulars Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4 pt-4 border-t border-[var(--border-primary)]/50 text-xs">
          <div className="flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <div className="truncate">
              <div className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-mono">Police Station</div>
              <div className="font-medium text-[var(--text-primary)] truncate">{caseData.station || 'Station unassigned'}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <div className="truncate">
              <div className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-mono">District</div>
              <div className="font-medium text-[var(--text-primary)] truncate">{caseData.district || 'Karnataka State'}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <div className="truncate">
              <div className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-mono">Occurred</div>
              <div className="font-medium text-[var(--text-primary)] truncate">
                {caseData.occurred_at ? new Date(caseData.occurred_at).toLocaleDateString() : 'Unknown'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <div className="truncate">
              <div className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-mono">Reported</div>
              <div className="font-medium text-[var(--text-primary)] truncate">
                {caseData.reported_at ? new Date(caseData.reported_at).toLocaleDateString() : 'Unknown'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <div className="truncate">
              <div className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-mono">Lead Officer</div>
              <div className="font-medium text-[var(--text-primary)] truncate">
                {caseData.assigned_officer ? caseData.assigned_officer.full_name : 'Pending assignment'}
              </div>
            </div>
          </div>
        </div>

        {/* Modus Operandi Tags */}
        {caseData.mo_tags && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border-primary)]/30">
            <Tag className="w-3 h-3 text-[var(--accent-coral)] shrink-0" />
            <div className="flex gap-1.5 flex-wrap">
              {caseData.mo_tags.split(',').map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded bg-[var(--bg-tertiary)]/80 text-[10px] text-[var(--text-secondary)] font-mono border border-[var(--border-primary)]"
                >
                  #{tag.trim()}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Primary Tab Navigation Cockpit */}
      <div className="flex items-center px-4 overflow-x-auto custom-scrollbar border-t border-[var(--border-primary)]/40 bg-[var(--bg-primary)]/40">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold whitespace-nowrap transition-all border-b-2 ${
                isActive
                  ? 'border-[var(--accent-teal)] text-[var(--accent-teal)] bg-[var(--accent-teal)]/5'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-primary)]'
              }`}
            >
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    isActive
                      ? 'bg-[var(--accent-teal)]/20 text-[var(--accent-teal)] font-bold'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
