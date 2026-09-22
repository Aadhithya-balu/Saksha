import React, { useState } from 'react';
import {
  Clock,
  Filter,
  FileText,
  Package,
  Microscope,
  Shield,
  Activity,
  ArrowUpDown,
  Tag,
} from 'lucide-react';
import type { InvestigationTimelineEvent } from '../../../services/api';

interface Props {
  events: InvestigationTimelineEvent[];
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; badge: string }> = {
  fir: {
    label: 'FIR / Filing',
    icon: <FileText className="w-3.5 h-3.5" />,
    color: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    badge: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
  },
  evidence: {
    label: 'Evidence Vault',
    icon: <Package className="w-3.5 h-3.5" />,
    color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    badge: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
  },
  forensic: {
    label: 'Forensics',
    icon: <Microscope className="w-3.5 h-3.5" />,
    color: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
    badge: 'border-rose-500/30 text-rose-400 bg-rose-500/10',
  },
  custody: {
    label: 'Chain of Custody',
    icon: <Shield className="w-3.5 h-3.5" />,
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
    badge: 'border-blue-500/30 text-blue-400 bg-blue-500/10',
  },
  status: {
    label: 'Case Milestone',
    icon: <Activity className="w-3.5 h-3.5" />,
    color: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
    badge: 'border-purple-500/30 text-purple-400 bg-purple-500/10',
  },
};

export const CaseTimelineTab: React.FC<Props> = ({ events }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const categories = ['all', 'fir', 'evidence', 'custody', 'forensic', 'status'];

  const filteredEvents = events
    .filter((e) => selectedCategory === 'all' || e.category?.toLowerCase().includes(selectedCategory))
    .sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return sortAsc ? timeA - timeB : timeB - timeA;
    });

  return (
    <div className="space-y-4 text-left">
      {/* Control Bar: Filters & Sort */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-[var(--text-muted)] uppercase flex items-center gap-1.5 mr-1">
            <Filter className="w-3.5 h-3.5 text-[var(--accent-teal)]" /> Filter:
          </span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors uppercase font-mono ${
                selectedCategory === cat
                  ? 'bg-[var(--accent-teal)] text-slate-950 font-bold'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-primary)]'
              }`}
            >
              {cat === 'all' ? 'All Events' : CATEGORY_CONFIG[cat]?.label || cat}
            </button>
          ))}
        </div>

        <button
          onClick={() => setSortAsc(!sortAsc)}
          className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-mono"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          <span>{sortAsc ? 'Oldest First' : 'Newest First'}</span>
        </button>
      </div>

      {/* Timeline Stream */}
      {filteredEvents.length === 0 ? (
        <div className="p-12 text-center bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl text-[var(--text-muted)] text-xs">
          No events found matching the selected filter.
        </div>
      ) : (
        <div className="p-6 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl">
          <div className="relative pl-6 border-l-2 border-[var(--border-primary)] space-y-6">
            {filteredEvents.map((event, idx) => {
              const catKey = event.category?.toLowerCase() || 'status';
              const config = CATEGORY_CONFIG[catKey] || CATEGORY_CONFIG.status;
              const isExpanded = expandedIndex === idx;

              return (
                <div key={idx} className="relative group">
                  {/* Node Circle */}
                  <div
                    className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-[var(--bg-secondary)] ${config.color} flex items-center justify-center shadow`}
                  />

                  {/* Event Card */}
                  <div
                    onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isExpanded
                        ? 'bg-[var(--bg-tertiary)]/70 border-[var(--accent-teal)]/50 shadow-md'
                        : 'bg-[var(--bg-tertiary)]/20 border-[var(--border-primary)] hover:border-[var(--border-secondary)]'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold border ${config.badge}`}>
                          {config.label}
                        </span>
                        <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase">
                          {event.event}
                        </h4>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--text-muted)]">
                        <Clock className="w-3 h-3 text-[var(--accent-teal)]" />
                        <span>{new Date(event.timestamp).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Actor & Source Line */}
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-[var(--text-muted)]">
                      {event.actor && (
                        <span>
                          <strong className="text-[var(--text-secondary)]">Actor:</strong> {event.actor}
                        </span>
                      )}
                      {event.source && (
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3 text-[var(--accent-blue)]" />
                          <strong className="text-[var(--text-secondary)]">Source:</strong> {event.source}
                          {event.source_id && <span className="font-mono text-[10px]">({event.source_id})</span>}
                        </span>
                      )}
                    </div>

                    {/* Expandable Details */}
                    {event.details && (
                      <div className={`mt-3 pt-3 border-t border-[var(--border-primary)]/50 text-xs text-[var(--text-secondary)] leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                        {event.details}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
