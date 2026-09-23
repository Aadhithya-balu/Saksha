import { useCallback, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Clock,
  ExternalLink,
  FolderOpen,
  Play,
  RefreshCw,
  RotateCcw,
  XCircle,
  AlertTriangle,
  Plus,
  X,
} from 'lucide-react';
import {
  getAIJobs,
  retryAIJob,
  spawnAIJob,
  type AIProcessingJob,
} from '../../services/api';
import { useAuditStore } from '../../store/auditStore';
import { useAuthStore } from '../../store/authStore';
import { usePolling } from '../../hooks/usePolling';

const STATUS_META: Record<string, { label: string; tone: string }> = {
  QUEUED: { label: 'QUEUED', tone: 'bg-[#D97706]/10 text-[#D97706]' },
  PROCESSING: { label: 'PROCESSING', tone: 'bg-[#1E6FD9]/10 text-[#1E6FD9]' },
  COMPLETED: { label: 'COMPLETED', tone: 'bg-[#0E9E78]/10 text-[#0E9E78]' },
  FAILED: { label: 'FAILED', tone: 'bg-[#EF4444]/10 text-[#EF4444]' },
  REQUIRES_REVIEW: { label: 'REQUIRES REVIEW', tone: 'bg-[#F472B6]/10 text-[#F472B6]' },
};

const TARGET_TAB: Record<string, string> = {
  evidence: 'evidence',
  ingestion_job: 'data_ingestion',
  fir: 'firs',
  criminal: 'criminals',
  crime_case: 'crime_cases',
  victim: 'victims',
};

const TARGET_OPTIONS = [
  { value: 'evidence', label: 'Evidence' },
  { value: 'ingestion_job', label: 'Ingestion Job' },
];

const JOB_OPTIONS = [
  { value: 'OCR', label: 'OCR (text extraction)' },
  { value: 'NER', label: 'NER (entity extraction)' },
  { value: 'VISION', label: 'Vision (events)' },
];

const isTerminal = (status: string) =>
  status === 'COMPLETED' || status === 'FAILED' || status === 'REQUIRES_REVIEW';

const fmtDT = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString() : '—';

export default function ProcessingCenter() {
  const { user } = useAuthStore();
  const { addLog } = useAuditStore();
  const [jobs, setJobs] = useState<AIProcessingJob[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [spawning, setSpawning] = useState(false);
  const [targetType, setTargetType] = useState('evidence');
  const [jobType, setJobType] = useState('OCR');
  const [targetId, setTargetId] = useState('');
  const [expandedError, setExpandedError] = useState<string | null>(null);

  const canOperate = user?.role === 'ADMIN' || user?.role === 'SCRB' || user?.role === 'IO';

  const fetchJobs = useCallback(async () => {
    try {
      const data = await getAIJobs();
      setJobs(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load AI jobs');
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  }, []);

  usePolling(fetchJobs, 5000);

  const handleRetry = async (jobId: string) => {
    setBusyId(jobId);
    try {
      await retryAIJob(jobId);
      addLog(
        user?.name ?? 'Operator',
        user?.badgeId ?? '-',
        'UPDATE',
        `Retried AI processing job ${jobId}`,
      );
      await fetchJobs();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to retry job');
    } finally {
      setBusyId(null);
    }
  };

  const handleSpawn = async () => {
    if (!targetId.trim()) {
      setError('A target entity ID is required to queue a job.');
      return;
    }
    setSpawning(true);
    try {
      const job = await spawnAIJob(targetType, targetId.trim(), jobType);
      addLog(
        user?.name ?? 'Operator',
        user?.badgeId ?? '-',
        'CREATE',
        `Queued ${jobType} job on ${targetType} ${job.target_entity_id}`,
      );
      setShowNew(false);
      setTargetId('');
      await fetchJobs();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to queue job');
    } finally {
      setSpawning(false);
    }
  };

  const openTarget = (type: string, id: string) => {
    const tab = TARGET_TAB[type];
    if (!tab) return;
    window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab, targetId: id } }));
  };

  const pendingCount = jobs.filter((j) => !isTerminal(j.status)).length;

  return (
    <div className="flex flex-col gap-5 select-none">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-md font-mono font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
            <Bot className="w-5 h-5 text-[#1E6FD9]" /> AI Processing Center
          </h2>
          <p className="text-[9.5px] font-mono text-[var(--text-muted)] mt-0.5">
            OCR · NER · Vision pipeline · identity-relevant findings require human review
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canOperate && (
            <button
              onClick={() => setShowNew((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#1E6FD9] text-white rounded-lg text-[10px] font-mono font-bold hover:bg-[#1E6FD9]/90 transition-colors cursor-pointer"
            >
              {showNew ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {showNew ? 'Close' : 'New Job'}
            </button>
          )}
          <button
            onClick={() => void fetchJobs()}
            className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg text-[10px] font-mono font-bold hover:bg-[var(--accent-blue-subtle)] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] text-[10px] font-mono">
          {error}
        </div>
      )}

      {showNew && canOperate && (
        <div className="rounded-xl border border-[#1E6FD9]/30 bg-[var(--bg-secondary)] p-4">
          <h3 className="text-[10px] font-mono font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2 mb-3">
            <Plus className="w-3.5 h-3.5 text-[#1E6FD9]" /> Queue an AI job
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[9px] font-mono text-[var(--text-muted)]">Target entity type</span>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
                className="bg-[var(--bg-tertiary)] border border-[var(--border-muted)] rounded-lg px-2 py-1.5 text-[10px] font-mono text-[var(--text-primary)]"
              >
                {TARGET_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[9px] font-mono text-[var(--text-muted)]">Pipeline</span>
              <select
                value={jobType}
                onChange={(e) => setJobType(e.target.value)}
                className="bg-[var(--bg-tertiary)] border border-[var(--border-muted)] rounded-lg px-2 py-1.5 text-[10px] font-mono text-[var(--text-primary)]"
              >
                {JOB_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[9px] font-mono text-[var(--text-muted)]">Target entity ID (UUID)</span>
              <input
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                placeholder="e.g. asset records for the target entity"
                className="bg-[var(--bg-tertiary)] border border-[var(--border-muted)] rounded-lg px-2 py-1.5 text-[10px] font-mono text-[var(--text-primary)]"
              />
            </label>
          </div>
          <div className="flex justify-end mt-3">
            <button
              onClick={() => void handleSpawn()}
              disabled={spawning}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#0E9E78] text-white rounded-lg text-[10px] font-mono font-bold hover:bg-[#0E9E78]/90 transition-colors cursor-pointer disabled:opacity-40"
            >
              <Play className="w-3.5 h-3.5" /> {spawning ? 'Queueing…' : 'Queue Job'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-[11px] font-mono text-[var(--text-muted)] p-6">Loading jobs…</div>
      ) : !hasLoaded ? null : (
        <div className="flex flex-col gap-3">
          <p className="text-[9.5px] font-mono text-[var(--text-muted)]">
            {jobs.length} job(s) · {pendingCount} in flight (auto-refreshing)
          </p>
          {jobs.length === 0 ? (
            <div className="rounded-xl border border-[var(--border-muted)] bg-[var(--bg-secondary)] p-6 text-center">
              <FolderOpen className="w-6 h-6 text-[var(--text-muted)] mx-auto mb-2" />
              <p className="text-[10px] font-mono text-[var(--text-muted)]">No AI jobs have been queued yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {jobs.map((job) => {
                const sm = STATUS_META[job.status] ?? { label: job.status, tone: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]' };
                const canOpen = Boolean(TARGET_TAB[job.target_entity_type]);
                const canRetry = (job.status === 'FAILED' || job.status === 'QUEUED') && canOperate;
                return (
                  <div key={job.id} className="rounded-xl border border-[var(--border-muted)] bg-[var(--bg-secondary)] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-mono font-bold ${sm.tone}`}>{sm.label}</span>
                      <span className="text-[11px] font-mono font-bold text-[var(--text-primary)] uppercase">{job.job_type}</span>
                      <span className="text-[9px] font-mono text-[var(--text-muted)]">{job.target_entity_type}</span>
                      <button
                        onClick={() => openTarget(job.target_entity_type, job.target_entity_id)}
                        disabled={!canOpen}
                        title={canOpen ? 'Open the target entity' : 'No dedicated tab for this entity type'}
                        className="ml-auto flex items-center gap-1 text-[9px] font-mono text-[#1E6FD9] hover:text-[#1E6FD9]/70 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default"
                      >
                        <ExternalLink className="w-3 h-3" /> Open target
                      </button>
                    </div>
                    <p className="mt-2 text-[9px] font-mono text-[var(--text-muted)] break-all">
                      Target: <span className="text-[var(--text-primary)]">{job.target_entity_id}</span>
                    </p>
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2 text-[9px] font-mono">
                      <div className="rounded-md bg-[var(--bg-primary)] px-2 py-1.5">
                        <span className="text-[var(--text-muted)]">Created:</span>{' '}
                        <span className="text-[var(--text-primary)] font-bold">{fmtDT(job.created_at)}</span>
                      </div>
                      <div className="rounded-md bg-[var(--bg-primary)] px-2 py-1.5">
                        <span className="text-[var(--text-muted)]">Started:</span>{' '}
                        <span className="text-[var(--text-primary)] font-bold">{fmtDT(job.processing_started_at)}</span>
                      </div>
                      <div className="rounded-md bg-[var(--bg-primary)] px-2 py-1.5">
                        <span className="text-[var(--text-muted)]">Completed:</span>{' '}
                        <span className="text-[var(--text-primary)] font-bold">{fmtDT(job.processing_completed_at)}</span>
                      </div>
                      <div className="rounded-md bg-[var(--bg-primary)] px-2 py-1.5">
                        <span className="text-[var(--text-muted)]">Retries:</span>{' '}
                        <span className="text-[var(--text-primary)] font-bold">{job.retry_count}</span>
                      </div>
                      <div className="rounded-md bg-[var(--bg-primary)] px-2 py-1.5 flex items-center gap-1">
                        {job.status === 'COMPLETED' && <CheckCircle2 className="w-3 h-3 text-[#0E9E78]" />}
                        {job.status === 'FAILED' && <XCircle className="w-3 h-3 text-[#EF4444]" />}
                        {job.status === 'QUEUED' && <Clock className="w-3 h-3 text-[#D97706]" />}
                        {job.status === 'PROCESSING' && <RefreshCw className="w-3 h-3 text-[#1E6FD9] animate-spin" />}
                        {job.status === 'REQUIRES_REVIEW' && <AlertTriangle className="w-3 h-3 text-[#F472B6]" />}
                        <span className="text-[var(--text-muted)]">Pipeline:</span>{' '}
                        <span className="text-[var(--text-primary)] font-bold">{job.job_type}</span>
                      </div>
                    </div>
                    {job.status === 'FAILED' && job.error_details && (
                      <button
                        onClick={() => setExpandedError(expandedError === job.id ? null : job.id)}
                        className="mt-2 flex items-center gap-1 text-[9px] font-mono text-[#EF4444] hover:text-[#EF4444]/70 transition-colors cursor-pointer"
                      >
                        <XCircle className="w-3 h-3" /> {expandedError === job.id ? 'Hide error' : 'Show error details'}
                      </button>
                    )}
                    {expandedError === job.id && job.error_details && (
                      <pre className="mt-2 whitespace-pre-wrap break-words text-[9px] font-mono text-[#EF4444] bg-[#EF4444]/5 border border-[#EF4444]/20 rounded-md p-2">
                        {job.error_details}
                      </pre>
                    )}
                    {canRetry && (
                      <div className="flex gap-2 justify-end mt-3 pt-3 border-t border-[var(--border-muted)]">
                        <button
                          onClick={() => void handleRetry(job.id)}
                          disabled={busyId === job.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#0E9E78] text-[#0E9E78] text-[10px] font-mono font-bold hover:bg-[#0E9E78]/10 transition-colors cursor-pointer disabled:opacity-40"
                        >
                          <RotateCcw className={`w-3 h-3 ${busyId === job.id ? 'animate-spin' : ''}`} /> Re-queue
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}