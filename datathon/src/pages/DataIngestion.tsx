import { useCallback, useEffect, useMemo, useState } from 'react';
import { Database, FileUp, FolderPlus, RefreshCw, Upload } from 'lucide-react';
import {
  createDataSource,
  getIngestionKinds,
  getIngestionStatus,
  listDataSources,
  listIngestionJobs,
  uploadArtifact,
  type DataSourceRecord,
  type IngestionJobRecord,
  type IngestionStatus,
} from '../services/api';
import { useAuditStore } from '../store/auditStore';
import { useAuthStore } from '../store/authStore';

const JOB_META: Record<string, { label: string; tone: string }> = {
  received: { label: 'Received', tone: 'bg-[#4A5568]/10 text-[#4A5568]' },
  validating: { label: 'Validating', tone: 'bg-[#1E6FD9]/10 text-[#1E6FD9]' },
  normalizing: { label: 'Normalizing', tone: 'bg-[#D97706]/10 text-[#D97706]' },
  stored: { label: 'Stored', tone: 'bg-[#0E9E78]/10 text-[#0E9E78]' },
  completed: { label: 'Completed', tone: 'bg-[#0E9E78]/10 text-[#0E9E78]' },
  failed: { label: 'Failed', tone: 'bg-[#EF4444]/10 text-[#EF4444]' },
};

export default function DataIngestion() {
  const { user } = useAuthStore();
  const { addLog } = useAuditStore();
  const [sources, setSources] = useState<DataSourceRecord[]>([]);
  const [jobs, setJobs] = useState<IngestionJobRecord[]>([]);
  const [status, setStatus] = useState<IngestionStatus | null>(null);
  const [kinds, setKinds] = useState<Array<{ value: string; label: string; ai_eligible: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Create-source form
  const [srcName, setSrcName] = useState('');
  const [srcType, setSrcType] = useState('MANUAL');
  const [srcDesc, setSrcDesc] = useState('');

  // Upload
  const [file, setFile] = useState<File | null>(null);
  const [srcId, setSrcId] = useState('');
  const [origin, setOrigin] = useState('');
  const [uplMsg, setUplMsg] = useState<string | null>(null);
  const [uplErr, setUplErr] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [s, j, st, k] = await Promise.all([
        listDataSources(),
        listIngestionJobs(),
        getIngestionStatus(),
        getIngestionKinds(),
      ]);
      setSources(s);
      setJobs(j);
      setStatus(st);
      setKinds(k);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load ingestion data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const statusCards = useMemo(() => {
    const rows: Array<{ key: string; label: string; value: number; tone: string }> = [
      { key: 'total', label: 'Total Jobs', value: status?.total ?? 0, tone: 'text-[var(--text-primary)]' },
      { key: 'stored', label: 'Stored', value: status?.stored ?? 0, tone: 'text-[#0E9E78]' },
      { key: 'ready_for_ai', label: 'Ready for AI', value: status?.ready_for_ai ?? 0, tone: 'text-[#1E6FD9]' },
      { key: 'requires_review', label: 'Needs Review', value: status?.requires_review ?? 0, tone: 'text-[#D97706]' },
      { key: 'failed', label: 'Failed', value: status?.failed ?? 0, tone: 'text-[#EF4444]' },
    ];
    return rows;
  }, [status]);

  const handleCreateSource = async () => {
    if (!srcName.trim()) return;
    setBusy(true);
    try {
      await createDataSource({
        name: srcName.trim(),
        source_type: srcType,
        description: srcDesc.trim() || null,
        is_active: true,
      });
      addLog(user?.name ?? 'Operator', user?.badgeId ?? '-', 'CREATE', `Created data source "${srcName.trim()}"`);
      setSrcName('');
      setSrcDesc('');
      await fetchAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create source');
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setUplErr('Choose a file first.');
      return;
    }
    setUplMsg(null);
    setUplErr(null);
    setBusy(true);
    try {
      const job = await uploadArtifact(file, {
        sourceId: srcId || undefined,
        origin: origin.trim() || undefined,
      });
      addLog(user?.name ?? 'Operator', user?.badgeId ?? '-', 'UPLOAD', `Ingested "${file.name}" (${job.status})`);
      setUplMsg(`Ingestion job ${job.id.slice(0, 8)}… queued as "${job.status}"`);
      setFile(null);
      setOrigin('');
      await fetchAll();
    } catch (e) {
      setUplErr(e instanceof Error ? e.message : 'Failed to upload artifact');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 select-none">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-md font-mono font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
            <Database className="w-5 h-5 text-[#1E6FD9]" /> Universal Data Ingestion
          </h2>
          <p className="text-[9.5px] font-mono text-[var(--text-muted)] mt-0.5">
            Phase 1 · sources, artifacts and validation jobs
          </p>
        </div>
        <button
          onClick={() => void fetchAll()}
          className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg text-[10px] font-mono font-bold hover:bg-[var(--accent-blue-subtle)] transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] text-[10px] font-mono">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-[11px] font-mono text-[var(--text-muted)] p-6">Loading ingestion workspace…</div>
      ) : (
        <>
          {/* Status summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {statusCards.map((card) => (
              <div key={card.key} className="rounded-xl border border-[var(--border-muted)] bg-[var(--bg-secondary)] p-3">
                <div className="text-[9px] font-mono uppercase tracking-wider text-[var(--text-muted)]">{card.label}</div>
                <div className={`text-2xl font-bold font-mono mt-1 ${card.tone}`}>{card.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Upload artifact */}
            <div className="rounded-xl border border-[var(--border-muted)] bg-[var(--bg-secondary)] p-4">
              <h3 className="text-[11px] font-mono font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                <FileUp className="w-4 h-4 text-[#D97706]" /> Ingest Artifact
              </h3>
              <div className="mt-3 space-y-3">
                <label className="block">
                  <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase">File</span>
                  <input
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="mt-1 w-full text-[10px] font-mono file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-[var(--accent-blue)]/15 file:text-[var(--accent-blue)] file:hover:bg-[var(--accent-blue)]/25 cursor-pointer"
                  />
                </label>
                <label className="block">
                  <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase">Source (optional)</span>
                  <select
                    value={srcId}
                    onChange={(e) => setSrcId(e.target.value)}
                    className="mt-1 w-full bg-[var(--bg-primary)] border border-[var(--border-muted)] rounded-md px-2 py-1.5 text-[11px] font-mono"
                  >
                    <option value="">— Auto tag —</option>
                    {sources.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase">Origin / context</span>
                  <input
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    placeholder="e.g. CID Mysuru intake 2026-09"
                    className="mt-1 w-full bg-[var(--bg-primary)] border border-[var(--border-muted)] rounded-md px-2 py-1.5 text-[11px] font-mono"
                  />
                </label>
                <button
                  onClick={() => void handleUpload()}
                  disabled={busy || !file}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#1E6FD9] text-white rounded-lg text-[10px] font-mono font-bold hover:bg-[#1E6FD9]/90 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" /> {busy ? 'Working…' : 'Upload & Validate'}
                </button>
                {uplMsg && <p className="text-[10px] font-mono text-[#0E9E78]">{uplMsg}</p>}
                {uplErr && <p className="text-[10px] font-mono text-[#EF4444]">{uplErr}</p>}
              </div>
            </div>

            {/* Register a data source */}
            <div className="rounded-xl border border-[var(--border-muted)] bg-[var(--bg-secondary)] p-4">
              <h3 className="text-[11px] font-mono font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-[#0E9E78]" /> Register Data Source
              </h3>
              <div className="mt-3 space-y-3">
                <label className="block">
                  <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase">Name</span>
                  <input
                    value={srcName}
                    onChange={(e) => setSrcName(e.target.value)}
                    placeholder="Karnataka police FIR RSS feed"
                    className="mt-1 w-full bg-[var(--bg-primary)] border border-[var(--border-muted)] rounded-md px-2 py-1.5 text-[11px] font-mono"
                  />
                </label>
                <label className="block">
                  <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase">Kind</span>
                  <select
                    value={srcType}
                    onChange={(e) => setSrcType(e.target.value)}
                    className="mt-1 w-full bg-[var(--bg-primary)] border border-[var(--border-muted)] rounded-md px-2 py-1.5 text-[11px] font-mono"
                  >
                    {kinds.length > 0
                      ? kinds.map((k) => (
                          <option key={k.value} value={k.value.toUpperCase()}>{k.label}</option>
                        ))
                      : (['DOCUMENT', 'CSV', 'JSON', 'MANUAL'].map((k) => (
                          <option key={k} value={k}>{k}</option>
                        )))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase">Description</span>
                  <textarea
                    value={srcDesc}
                    onChange={(e) => setSrcDesc(e.target.value)}
                    rows={2}
                    className="mt-1 w-full bg-[var(--bg-primary)] border border-[var(--border-muted)] rounded-md px-2 py-1.5 text-[11px] font-mono"
                  />
                </label>
                <button
                  onClick={() => void handleCreateSource()}
                  disabled={busy || !srcName.trim()}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#0E9E78] text-white rounded-lg text-[10px] font-mono font-bold hover:bg-[#0E9E78]/90 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5" /> {busy ? 'Working…' : 'Register Source'}
                </button>
              </div>
            </div>
          </div>

          {/* Recent jobs */}
          <div className="rounded-xl border border-[var(--border-muted)] bg-[var(--bg-secondary)] p-4 overflow-x-auto">
            <h3 className="text-[11px] font-mono font-bold text-[var(--text-primary)] uppercase tracking-wider mb-3">
              Validation Jobs
            </h3>
            {jobs.length === 0 ? (
              <p className="text-[10px] font-mono text-[var(--text-muted)]">No ingestion jobs yet.</p>
            ) : (
              <table className="w-full text-left text-[10px] font-mono">
                <thead>
                  <tr className="text-[var(--text-muted)] border-b border-[var(--border-muted)]">
                    <th className="py-1.5 pr-3">Job</th>
                    <th className="py-1.5 pr-3">Kind</th>
                    <th className="py-1.5 pr-3">Records</th>
                    <th className="py-1.5 pr-3">AI</th>
                    <th className="py-1.5 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => {
                    const meta = JOB_META[job.status] ?? { label: job.status, tone: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]' };
                    return (
                      <tr key={job.id} className="border-b border-[var(--border-muted)]/40">
                        <td className="py-2 pr-3 text-[var(--text-primary)]">{job.original_filename ?? job.id.slice(0, 8)}</td>
                        <td className="py-2 pr-3 uppercase text-[var(--text-muted)]">{job.artifact_kind}</td>
                        <td className="py-2 pr-3">{job.record_count ?? 0}</td>
                        <td className="py-2 pr-3">{job.ai_job_spawned ? 'queued' : 'n/a'}</td>
                        <td className="py-2 pr-3">
                          <span className={`px-2 py-0.5 rounded-md font-bold ${meta.tone}`}>{meta.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}