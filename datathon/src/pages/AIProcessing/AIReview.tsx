import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  RefreshCw,
  SearchX,
  ShieldCheck,
  UserRoundSearch,
} from 'lucide-react';
import { getPendingAIMatches, verifyAIMatch, type AIMatchRecord } from '../../services/api';
import { useAuditStore } from '../../store/auditStore';
import { useAuthStore } from '../../store/authStore';

const STATUS_META: Record<string, { label: string; tone: string }> = {
  PENDING: { label: 'PROPOSED · AWAITING REVIEW', tone: 'bg-[#F472B6]/10 text-[#F472B6]' },
  CONFIRMED: { label: 'CONFIRMED', tone: 'bg-[#0E9E78]/10 text-[#0E9E78]' },
  REJECTED: { label: 'REJECTED', tone: 'bg-[#4A5568]/10 text-[#4A5568]' },
};

const SOURCE_TAB: Record<string, string> = {
  criminal: 'criminals',
  victim: 'victims',
  fir: 'firs',
  crime_case: 'crime_cases',
  evidence: 'evidence',
};

const FILTERS = [
  { value: 'PENDING', label: 'Proposed' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: '', label: 'All' },
];

export default function AIReview() {
  const { user } = useAuthStore();
  const { addLog } = useAuditStore();
  const [matches, setMatches] = useState<AIMatchRecord[]>([]);
  const [filter, setFilter] = useState('PENDING');
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDecision, setBulkDecision] = useState<null | 'CONFIRM' | 'REJECT'>(null);

  const canReview = user?.role === 'ADMIN' || user?.role === 'SCRB' || user?.role === 'IO' || user?.role === 'INSPECTOR';

  const fetchMatches = useCallback(async () => {
    try {
      const data = await getPendingAIMatches(filter || undefined);
      setMatches(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load match records');
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    void fetchMatches();
  }, [fetchMatches]);

  const handleDecision = async (id: string, decision: 'CONFIRM' | 'REJECT') => {
    setBusyId(id);
    try {
      const updated = await verifyAIMatch(id, decision);
      addLog(
        user?.name ?? 'Operator',
        user?.badgeId ?? '-',
        'REVIEW',
        `AI match ${decision.toLowerCase()} — ${updated.candidate_ai_entity?.entity_type ?? 'entity'} → ${updated.source_entity_type}`,
      );
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await fetchMatches();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${decision.toLowerCase()} match`);
    } finally {
      setBusyId(null);
    }
  };

  const handleBulk = async (decision: 'CONFIRM' | 'REJECT') => {
    setBulkDecision(decision);
    const ids = [...selected];
    try {
      for (const id of ids) {
        await verifyAIMatch(id, decision);
      }
      addLog(
        user?.name ?? 'Operator',
        user?.badgeId ?? '-',
        'REVIEW',
        `Bulk ${decision.toLowerCase()} of ${ids.length} AI match record(s)`,
      );
      setSelected(new Set());
      await fetchMatches();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to bulk ${decision.toLowerCase()} matches`);
    } finally {
      setBulkDecision(null);
    }
  };

  const openSource = (type: string, id: string) => {
    const tab = SOURCE_TAB[type];
    if (!tab) return;
    window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab, targetId: id } }));
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };


  return (
    <div className="flex flex-col gap-5 select-none">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-md font-mono font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#F472B6]" /> AI Entity Resolution Review
          </h2>
          <p className="text-[9.5px] font-mono text-[var(--text-muted)] mt-0.5">
            Proposed identity matches · every finding requires a human decision — none are auto-confirmed
          </p>
        </div>
        <button
          onClick={() => void fetchMatches()}
          className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg text-[10px] font-mono font-bold hover:bg-[var(--accent-blue-subtle)] transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] text-[10px] font-mono">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold transition-colors cursor-pointer ${
              filter === f.value
                ? 'bg-[#1E6FD9] text-white'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {f.label}
          </button>
        ))}
        {selected.size > 0 && canReview && (
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => void handleBulk('REJECT')}
              disabled={bulkDecision !== null}
              className="px-3 py-1.5 rounded-lg border border-[var(--border-muted)] text-[10px] font-mono font-bold text-[var(--text-muted)] hover:text-[#4A5568] transition-colors cursor-pointer disabled:opacity-40"
            >
              Reject {selected.size}
            </button>
            <button
              onClick={() => void handleBulk('CONFIRM')}
              disabled={bulkDecision !== null}
              className="px-3 py-1.5 rounded-lg bg-[#0E9E78] text-white text-[10px] font-mono font-bold hover:bg-[#0E9E78]/90 transition-colors cursor-pointer disabled:opacity-40"
            >
              {bulkDecision === 'CONFIRM' ? 'Reviewing…' : `Confirm ${selected.size}`}
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-[11px] font-mono text-[var(--text-muted)] p-6">Loading match records…</div>
      ) : !hasLoaded ? null : (
        <div className="flex flex-col gap-3">
          <p className="text-[9.5px] font-mono text-[var(--text-muted)]">
            {matches.length} match record(s)
            {filter === 'PENDING' ? ' · all proposed, none auto-confirmed' : ''}
          </p>
          {matches.length === 0 ? (
            <div className="rounded-xl border border-[var(--border-muted)] bg-[var(--bg-secondary)] p-6 text-center">
              <SearchX className="w-6 h-6 text-[var(--text-muted)] mx-auto mb-2" />
              <p className="text-[10px] font-mono text-[var(--text-muted)]">No match records for this status.</p>
            </div>
          ) : (
            matches.map((match) => {
              const sm = STATUS_META[match.status] ?? { label: match.status, tone: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]' };
              const isPending = match.status === 'PENDING';
              const confidencePct = (match.match_score * 100).toFixed(1);
              const entity = match.candidate_ai_entity;
              const canOpenSource = Boolean(SOURCE_TAB[match.source_entity_type]);
              return (
                <div key={match.id} className="rounded-xl border border-[var(--border-muted)] bg-[var(--bg-secondary)] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {isPending && canReview && (
                      <input
                        type="checkbox"
                        checked={selected.has(match.id)}
                        onChange={() => toggle(match.id)}
                        className="accent-[#0E9E78] cursor-pointer"
                        aria-label={`Select match ${match.id}`}
                      />
                    )}
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-mono font-bold ${sm.tone}`}>{sm.label}</span>
                    <span className="text-[11px] font-mono font-bold text-[var(--text-primary)] uppercase">
                      {entity?.entity_type ?? 'entity'} → {match.source_entity_type}
                    </span>
                    <button
                      onClick={() => openSource(match.source_entity_type, match.source_entity_id)}
                      disabled={!canOpenSource}
                      title={canOpenSource ? 'Open the existing record' : 'No dedicated tab for this entity type'}
                      className="ml-auto flex items-center gap-1 text-[9px] font-mono text-[#1E6FD9] hover:text-[#1E6FD9]/70 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default"
                    >
                      <ExternalLink className="w-3 h-3" /> Open record
                    </button>
                  </div>

                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-lg bg-[var(--bg-primary)] p-3">
                      <h4 className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-2 flex items-center gap-1">
                        <UserRoundSearch className="w-3 h-3" /> Extracted entity
                      </h4>
                      <div className="flex gap-2 flex-wrap text-[9px] font-mono">
                        <span className="px-2 py-0.5 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-primary)]">{entity?.entity_type}</span>
                        <span className="px-2 py-0.5 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                          confidence {(entity?.confidence ?? 0) * 100 >= 1 ? ((entity?.confidence ?? 0) * 100).toFixed(1) : (entity?.confidence ?? 0)}%
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-muted)]">{entity?.provider}</span>
                      </div>
                      <pre className="mt-2 text-[9px] font-mono text-[var(--text-primary)] bg-[var(--bg-secondary)] rounded-md p-2 whitespace-pre-wrap break-words">
                        {JSON.stringify(entity?.attributes ?? {}, null, 2)}
                      </pre>
                    </div>
                    <div className="rounded-lg bg-[var(--bg-primary)] border border-[#F472B6]/20 p-3">
                      <h4 className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-2 flex items-center gap-1">
                        <ClipboardCheck className="w-3 h-3" /> Existing {match.source_entity_type}
                      </h4>
                      <p className="text-[9px] font-mono text-[var(--text-muted)] break-all">
                        ID: <span className="text-[var(--text-primary)]">{match.source_entity_id}</span>
                      </p>
                      <pre className="mt-2 text-[9px] font-mono text-[var(--text-primary)] bg-[var(--bg-secondary)] rounded-md p-2 whitespace-pre-wrap break-words">
                        {JSON.stringify(match.matching_attributes, null, 2)}
                      </pre>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-3 text-[9px] font-mono">
                    <span className="rounded-md bg-[#F472B6]/10 text-[#F472B6] px-2 py-0.5 font-bold">
                      Match confidence {confidencePct}%
                    </span>
                    {(match.matching_attributes as any)?.reason && <span className="text-[var(--text-muted)]">· {(match.matching_attributes as any).reason}</span>}
                    <span className="text-[var(--text-muted)]">· proposed {new Date(match.created_at).toLocaleString()}</span>
                  </div>

                  {isPending && canReview && (
                    <div className="flex gap-2 justify-end mt-3 pt-3 border-t border-[var(--border-muted)]">
                      <button
                        onClick={() => void handleDecision(match.id, 'REJECT')}
                        disabled={busyId === match.id}
                        className="px-3 py-1.5 rounded-lg border border-[var(--border-muted)] text-[10px] font-mono font-bold text-[var(--text-muted)] hover:text-[#4A5568] transition-colors cursor-pointer disabled:opacity-40"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => void handleDecision(match.id, 'CONFIRM')}
                        disabled={busyId === match.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0E9E78] text-white text-[10px] font-mono font-bold hover:bg-[#0E9E78]/90 transition-colors cursor-pointer disabled:opacity-40"
                      >
                        <CheckCircle2 className="w-3 h-3" /> Confirm Match
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}