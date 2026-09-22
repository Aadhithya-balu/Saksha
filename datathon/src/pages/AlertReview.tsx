import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, RefreshCw, ShieldAlert } from 'lucide-react';
import {
  getAlertFindings,
  regenerateAlertFindings,
  reviewAlertFinding,
  type AlertFindingRecord,
} from '../services/api';
import { useAuditStore } from '../store/auditStore';
import { useAuthStore } from '../store/authStore';

const SEVERITY_TONES: Record<string, string> = {
  critical: 'bg-[#EF4444]/10 text-[#EF4444]',
  high: 'bg-[#D97706]/10 text-[#D97706]',
  medium: 'bg-[#1E6FD9]/10 text-[#1E6FD9]',
  low: 'bg-[#4A5568]/10 text-[#4A5568]',
  informational: 'bg-[#0E9E78]/10 text-[#0E9E78]',
};

const STATUS_TONES: Record<string, string> = {
  open: 'bg-[#D97706]/10 text-[#D97706]',
  in_review: 'bg-[#1E6FD9]/10 text-[#1E6FD9]',
  reviewed: 'bg-[#0E9E78]/10 text-[#0E9E78]',
  dismissed: 'bg-[#4A5568]/10 text-[#4A5568]',
};

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_review', label: 'In Review' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'dismissed', label: 'Dismissed' },
];

export default function AlertReview() {
  const { user } = useAuthStore();
  const { addLog } = useAuditStore();
  const [findings, setFindings] = useState<AlertFindingRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canReview = user?.role === 'ADMIN' || user?.role === 'SCRB' || user?.role === 'IO' || user?.role === 'INSPECTOR';
  const canGenerate = user?.role === 'ADMIN' || user?.role === 'SCRB';

  const fetchFindings = useCallback(async () => {
    try {
      const res = await getAlertFindings({
        status: filter || undefined,
        finding_type: typeFilter || undefined,
        limit: 100,
      });
      setFindings(res.results);
      setTotal(res.total);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load findings');
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  }, [filter, typeFilter]);

  useEffect(() => {
    setLoading(true);
    void fetchFindings();
  }, [fetchFindings]);

  const handleDecision = async (finding: AlertFindingRecord, decision: 'confirm' | 'investigate' | 'dismiss') => {
    const reviewNote =
      decision === 'dismiss'
        ? window.prompt('Reason for dismissal (optional):') ?? undefined
        : undefined;
    setBusyId(finding.id);
    try {
      const updated = await reviewAlertFinding(finding.id, decision, reviewNote);
      addLog(
        user?.name ?? 'Operator',
        user?.badgeId ?? '-',
        'REVIEW',
        `Alert finding ${decision} — ${updated.finding_type} — ${updated.district}${reviewNote ? ` (${reviewNote})` : ''}`,
      );
      await fetchFindings();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${decision} finding`);
    } finally {
      setBusyId(null);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await regenerateAlertFindings();
      addLog(user?.name ?? 'Operator', user?.badgeId ?? '-', 'CREATE', `Regenerated alert findings (${res.generated} new)`);
      await fetchFindings();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to regenerate findings');
    } finally {
      setRegenerating(false);
    }
  };

  const openCount = useMemo(() => findings.filter((f) => f.status === 'open').length, [findings]);

  return (
    <div className="flex flex-col gap-5 select-none">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-md font-mono font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#F472B6]" /> Alert Findings Review
          </h2>
          <p className="text-[9.5px] font-mono text-[var(--text-muted)] mt-0.5">
            Rule-generated leads (crime spike, repeat offender) · human review required
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canGenerate && (
            <button
              onClick={() => void handleRegenerate()}
              disabled={regenerating}
              className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg text-[10px] font-mono font-bold hover:bg-[#F472B6]/10 hover:text-[#F472B6] transition-colors cursor-pointer disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} /> Run Rules
            </button>
          )}
          <button
            onClick={() => void fetchFindings()}
            className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg text-[10px] font-mono font-bold hover:bg-[var(--accent-blue-subtle)] transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] text-[10px] font-mono">
          {error}
        </div>
      )}

      {/* Filters */}
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
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="ml-auto bg-[var(--bg-tertiary)] border border-[var(--border-muted)] rounded-lg px-2 py-1.5 text-[10px] font-mono text-[var(--text-muted)]"
        >
          <option value="">All types</option>
          <option value="CRIME_SPIKE">Crime spike</option>
          <option value="REPEAT_OFFENDER">Repeat offender</option>
        </select>
      </div>

      {loading ? (
        <div className="text-[11px] font-mono text-[var(--text-muted)] p-6">Loading findings…</div>
      ) : !hasLoaded ? null : (
        <div className="flex flex-col gap-3">
          <p className="text-[9.5px] font-mono text-[var(--text-muted)]">
            {total} finding(s) · {openCount} open on this view
          </p>
          {findings.length === 0 ? (
            <div className="rounded-xl border border-[var(--border-muted)] bg-[var(--bg-secondary)] p-6 text-center">
              <ClipboardCheck className="w-6 h-6 text-[#0E9E78] mx-auto mb-2" />
              <p className="text-[10px] font-mono text-[var(--text-muted)]">No findings match this filter.</p>
            </div>
          ) : (
            findings.map((f) => {
              const sv = SEVERITY_TONES[f.severity] ?? 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]';
              const st = STATUS_TONES[f.status] ?? 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]';
              return (
                <div key={f.id} className="rounded-xl border border-[var(--border-muted)] bg-[var(--bg-secondary)] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-mono font-bold ${sv}`}>{f.severity.toUpperCase()}</span>
                    <span className="text-[11px] font-mono font-bold text-[var(--text-primary)] uppercase">{f.finding_type.replace('_', ' ')}</span>
                    <span className="text-[9px] font-mono text-[var(--text-muted)]">{f.district}</span>
                    {f.category && <span className="text-[9px] font-mono text-[var(--text-muted)]">· {f.category}</span>}
                    <span className={`ml-auto px-2 py-0.5 rounded-md text-[9px] font-mono font-bold ${st}`}>{f.status.replace('_', ' ').toUpperCase()}</span>
                  </div>
                  <p className="mt-2 text-[10px] font-mono text-[var(--text-primary)] leading-relaxed">{f.explanation}</p>
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[9px] font-mono">
                    <div className="rounded-md bg-[var(--bg-primary)] px-2 py-1.5">
                      <span className="text-[var(--text-muted)]">Current:</span>{' '}
                      <span className="text-[var(--text-primary)] font-bold">{f.current_count}</span>
                    </div>
                    <div className="rounded-md bg-[var(--bg-primary)] px-2 py-1.5">
                      <span className="text-[var(--text-muted)]">Baseline:</span>{' '}
                      <span className="text-[var(--text-primary)] font-bold">{f.baseline_count}</span>
                    </div>
                    <div className="rounded-md bg-[var(--bg-primary)] px-2 py-1.5">
                      <span className="text-[var(--text-muted)]">Ratio:</span>{' '}
                      <span className="text-[var(--text-primary)] font-bold">{(f.spike_ratio ?? 1).toFixed(2)}×</span>
                    </div>
                    <div className="rounded-md bg-[var(--bg-primary)] px-2 py-1.5">
                      <span className="text-[var(--text-muted)]">Confidence:</span>{' '}
                      <span className="text-[var(--text-primary)] font-bold">{f.confidence}</span>
                    </div>
                  </div>
                  {(f.review_decision || f.review_note) && (
                    <p className="mt-2 text-[9px] font-mono text-[#0E9E78]">
                      Decided: <span className="font-bold">{f.review_decision}</span>
                      {f.review_note ? ` · ${f.review_note}` : ''}
                    </p>
                  )}
                  {f.status === 'open' && canReview && (
                    <div className="flex gap-2 justify-end mt-3 pt-3 border-t border-[var(--border-muted)]">
                      <button
                        onClick={() => void handleDecision(f, 'dismiss')}
                        disabled={busyId === f.id}
                        className="px-3 py-1.5 rounded-lg border border-[var(--border-muted)] text-[10px] font-mono font-bold text-[var(--text-muted)] hover:text-[#4A5568] transition-colors cursor-pointer disabled:opacity-40"
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() => void handleDecision(f, 'investigate')}
                        disabled={busyId === f.id}
                        className="px-3 py-1.5 rounded-lg border border-[#1E6FD9] text-[#1E6FD9] text-[10px] font-mono font-bold hover:bg-[#1E6FD9]/10 transition-colors cursor-pointer disabled:opacity-40"
                      >
                        Send to Investigation
                      </button>
                      <button
                        onClick={() => void handleDecision(f, 'confirm')}
                        disabled={busyId === f.id}
                        className="px-3 py-1.5 rounded-lg bg-[#0E9E78] text-white text-[10px] font-mono font-bold hover:bg-[#0E9E78]/90 transition-colors cursor-pointer disabled:opacity-40"
                      >
                        Confirm Finding
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