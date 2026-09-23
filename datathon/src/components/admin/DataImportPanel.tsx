import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FileUp, ListChecks, UploadCloud } from 'lucide-react';
import {
  analyzeImportFile,
  commitImportFile,
  getImportEntities,
  listImportJobs,
  getImportJobQuality,
  getImportJobRecords,
  promoteImportJob,
  rollbackImportJob,
  type ImportAnalysis,
  type ImportCommitResult,
  type ImportEntitySpec,
  type ImportJobSummary,
  type ImportJobQualityReport,
  type StagedRecordItem,
} from '../../services/api';

const humanizeEntityType = (value: string) =>
  value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const DataImportPanel: React.FC = () => {
  const [entities, setEntities] = useState<ImportEntitySpec[]>([]);
  const [profiles, setProfiles] = useState<string[]>(['standard']);
  const [maxRows, setMaxRows] = useState(5000);
  const [entityType, setEntityType] = useState('victims');
  const [profile, setProfile] = useState('standard');
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [result, setResult] = useState<ImportCommitResult | null>(null);
  const [jobs, setJobs] = useState<ImportJobSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Staging and Quality Lifecycle Inspection (Task D-01, D-02, D-03)
  const [inspectJobId, setInspectJobId] = useState<string | null>(null);
  const [stagedRecords, setStagedRecords] = useState<StagedRecordItem[]>([]);
  const [stagedTotal, setStagedTotal] = useState(0);
  const [stagedFilter, setStagedFilter] = useState<string>('all');
  const [stagedLoading, setStagedLoading] = useState(false);
  const [qualityReport, setQualityReport] = useState<ImportJobQualityReport | null>(null);

  const refreshJobs = useCallback(() => {
    void listImportJobs(10)
      .then((response) => setJobs(response.results ?? []))
      .catch(() => undefined);
  }, []);

  const loadStaged = async (jobId: string, filter = stagedFilter) => {
    setInspectJobId(jobId);
    setStagedLoading(true);
    try {
      const res = await getImportJobRecords(jobId, {
        validation_status: filter !== 'all' ? filter : undefined,
        limit: 20,
      });
      setStagedRecords(res.results || []);
      setStagedTotal(res.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load staged records');
    } finally {
      setStagedLoading(false);
    }
  };

  const loadQuality = async (jobId: string) => {
    try {
      const res = await getImportJobQuality(jobId);
      setQualityReport(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quality report');
    }
  };

  const handlePromote = async (jobId: string) => {
    if (!confirm(`Promote validated records from job ${jobId.slice(0, 8)} to production?`)) return;
    try {
      const res = await promoteImportJob(jobId);
      setActionFeedback(`Job ${jobId.slice(0, 8)} promoted: ${res.promoted_rows} rows promoted, ${res.skipped_rows} skipped.`);
      refreshJobs();
      if (inspectJobId === jobId) void loadStaged(jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to promote job');
    }
  };

  const handleRollback = async (jobId: string) => {
    if (!confirm(`Are you sure you want to rollback staging job ${jobId.slice(0, 8)}?`)) return;
    try {
      const res = await rollbackImportJob(jobId);
      setActionFeedback(`Job ${jobId.slice(0, 8)} rolled back: ${res.removed_records} records removed.`);
      refreshJobs();
      if (inspectJobId === jobId) setInspectJobId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rollback job');
    }
  };

  useEffect(() => {
    getImportEntities()
      .then((response) => {
        setEntities(response.entities ?? []);
        setProfiles((response.profiles ?? []).map((p) => p.profile));
        if (typeof response.max_rows === 'number') setMaxRows(response.max_rows);
        if ((response.entities ?? []).length > 0) {
          setEntityType(response.entities[0].entity_type);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load import entities'));
    refreshJobs();
  }, [refreshJobs]);

  const selectedEntity = entities.find((e) => e.entity_type === entityType);
  const requiredColumns = selectedEntity?.columns.filter((c) => c.required).map((c) => c.name) ?? [];
  const optionalColumns = selectedEntity?.columns.filter((c) => !c.required).map((c) => c.name) ?? [];

  const runAnalysis = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setAnalysis(null);
    setResult(null);
    try {
      setAnalysis(await analyzeImportFile(file, entityType, profile));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyse file');
    } finally {
      setBusy(false);
    }
  };

  const runCommit = async (dryRun: boolean) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await commitImportFile(file, entityType, profile, dryRun);
      if (dryRun) {
        // Dry-run responses carry the same shape as /preview.
        setAnalysis(response as unknown as ImportAnalysis);
      } else {
        setResult(response);
      }
      refreshJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to commit import');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border-color bg-[var(--bg-tertiary)]/35 p-4 space-y-3">
        <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
          <UploadCloud className="h-4 w-4 text-[#4DA3FF]" /> Bulk legacy data ingestion
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <label className="text-[10px] uppercase text-[var(--text-muted)]">
            Entity
            <select
              value={entityType}
              onChange={(e) => { setEntityType(e.target.value); setAnalysis(null); setResult(null); }}
              className="mt-1 w-full rounded bg-[var(--bg-primary)] border border-border-color px-2 py-2 text-xs text-[var(--text-primary)]"
            >
              {entities.map((e) => (
                <option key={e.entity_type} value={e.entity_type}>{humanizeEntityType(e.entity_type)}</option>
              ))}
            </select>
          </label>
          <label className="text-[10px] uppercase text-[var(--text-muted)]">
            Column profile
            <select
              value={profile}
              onChange={(e) => { setProfile(e.target.value); setAnalysis(null); }}
              className="mt-1 w-full rounded bg-[var(--bg-primary)] border border-border-color px-2 py-2 text-xs text-[var(--text-primary)]"
            >
              {profiles.map((p) => (
                <option key={p} value={p}>{p === 'cctns' ? 'CCTNS / ICJS' : p}</option>
              ))}
            </select>
          </label>
          <label className="text-[10px] uppercase text-[var(--text-muted)] md:col-span-2">
            CSV or XLSX file (max {maxRows.toLocaleString()} rows)
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setAnalysis(null); setResult(null); }}
              className="mt-1 w-full rounded bg-[var(--bg-primary)] border border-border-color px-2 py-1.5 text-xs text-[var(--text-secondary)] file:mr-2 file:rounded file:border-0 file:bg-[#1E6FD9]/20 file:px-2 file:py-1 file:text-[10px] file:uppercase file:text-[var(--text-primary)]"
            />
          </label>
        </div>

        {selectedEntity && (
          <p className="text-[9px] text-[var(--text-muted)] leading-relaxed">
            <span className="font-bold uppercase">Required:</span> {requiredColumns.join(', ') || '—'}
            {' · '}
            <span className="font-bold uppercase">Optional:</span> {optionalColumns.slice(0, 8).join(', ') || '—'}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void runAnalysis()}
            disabled={!file || busy}
            className="inline-flex items-center gap-2 rounded border border-[#1E6FD9]/35 bg-[#1E6FD9]/15 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)] disabled:opacity-40"
          >
            <ListChecks className="h-3.5 w-3.5" /> Validate &amp; Preview Mapping
          </button>
          <button
            onClick={() => void runCommit(true)}
            disabled={!file || busy}
            className="inline-flex items-center gap-2 rounded border border-border-color bg-[var(--bg-secondary)] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] disabled:opacity-40"
          >
            Dry Run
          </button>
          <button
            onClick={() => void runCommit(false)}
            disabled={!file || busy || (analysis !== null && analysis.missing_required_columns.length > 0)}
            title={analysis && analysis.missing_required_columns.length > 0 ? 'Resolve missing required columns first' : undefined}
            className="inline-flex items-center gap-2 rounded border border-[#0E9E78]/35 bg-[#0E9E78]/15 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)] disabled:opacity-40"
          >
            <FileUp className="h-3.5 w-3.5" /> Commit Import
          </button>
        </div>
      </div>

      {error && <div className="rounded border border-amber-500/30 px-3 py-2 text-[10px] uppercase tracking-wider text-amber-300">{error}</div>}

      {analysis && (
        <div className="rounded-lg border border-border-color bg-[var(--bg-secondary)]/60 p-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
            Validation report · {analysis.filename} · {analysis.total_rows} rows · profile {analysis.profile}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] font-mono">
            <div className="rounded border border-border-color p-2"><span className="block text-[var(--text-muted)] uppercase">Valid rows</span><span className="text-[#0E9E78] font-bold">{analysis.estimated_valid_rows}</span></div>
            <div className="rounded border border-border-color p-2"><span className="block text-[var(--text-muted)] uppercase">Invalid rows</span><span className="text-amber-400 font-bold">{analysis.estimated_invalid_rows}</span></div>
            <div className="rounded border border-border-color p-2"><span className="block text-[var(--text-muted)] uppercase">Mapped columns</span><span className="font-bold">{Object.keys(analysis.column_mapping ?? {}).length}</span></div>
            <div className="rounded border border-border-color p-2"><span className="block text-[var(--text-muted)] uppercase">Missing required</span><span className={analysis.missing_required_columns?.length ? 'text-red-400 font-bold' : 'font-bold'}>{analysis.missing_required_columns?.length ?? 0}</span></div>
          </div>
          {(analysis.missing_required_columns?.length ?? 0) > 0 && (
            <p className="text-[9px] text-red-400 uppercase">Missing required columns: {analysis.missing_required_columns.join(', ')}</p>
          )}
          {(analysis.unmapped_headers?.length ?? 0) > 0 && (
            <p className="text-[9px] text-amber-300 break-all">
              <span className="uppercase font-bold">Unmapped headers:</span> {analysis.unmapped_headers.join(' · ')}
            </p>
          )}
          {Object.keys(analysis.column_mapping ?? {}).length > 0 && (
            <p className="text-[9px] text-[var(--text-muted)] break-all">
              <span className="uppercase font-bold">Auto-mapped:</span>{' '}
              {Object.entries(analysis.column_mapping).map(([src, dst]) => `${src}→${dst}`).join(' · ')}
            </p>
          )}
          {(analysis.validation_report ?? []).slice(0, 8).map((item) => (
            <div key={item.row_number} className="rounded border border-border-color px-2 py-1.5 text-[9px]">
              <span className="font-bold uppercase text-[var(--text-muted)]">Row {item.row_number}</span>
              {(item.errors ?? []).map((err, i) => <span key={`e${i}`} className="ml-2 text-red-400">{err}</span>)}
              {(item.warnings ?? []).map((warning, i) => <span key={`w${i}`} className="ml-2 text-amber-300">{warning}</span>)}
            </div>
          ))}
          {analysis.truncated_report && <p className="text-[9px] text-amber-300 uppercase">Report truncated — remaining rows not shown.</p>}
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-[#0E9E78]/30 bg-[#0E9E78]/5 p-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
            Job {result.job_id.slice(0, 8)} · {result.status.toUpperCase()} · imported {result.imported_rows}, failed {result.failed_rows} of {result.total_rows}
          </p>
          {(result.validation_report ?? []).slice(0, 8).map((item) => (
            <div key={item.row_number} className="text-[9px]">
              <span className="font-bold uppercase text-[var(--text-muted)]">Row {item.row_number}</span>
              {(item.errors ?? []).map((err, i) => <span key={`e${i}`} className="ml-2 text-red-400">{err}</span>)}
            </div>
          ))}
        </div>
      )}

      {actionFeedback && (
        <div className="rounded border border-[#0E9E78]/30 bg-[#0E9E78]/10 px-3 py-2 text-[10px] uppercase tracking-wider text-[#0E9E78]">
          {actionFeedback}
        </div>
      )}

      <div className="rounded-lg border border-border-color bg-[var(--bg-tertiary)]/25 p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)] mb-2">Recent import jobs</p>
        {jobs.length === 0 ? (
          <p className="text-[9px] uppercase text-[var(--text-muted)]">No imports recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-left text-[9px] whitespace-nowrap">
            <thead className="text-[var(--text-muted)] uppercase">
              <tr>
                <th className="py-1 pr-3">When</th>
                <th className="py-1 pr-3">Entity</th>
                <th className="py-1 pr-3">File</th>
                <th className="py-1 pr-3">Status</th>
                <th className="py-1 pr-3">OK</th>
                <th className="py-1 pr-3">Failed</th>
                <th className="py-1 text-right">Staging &amp; Quality Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-primary)] text-[var(--text-secondary)]">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-[var(--bg-primary)]/40 transition-colors">
                  <td className="py-1.5 pr-3">{job.created_at ? new Date(job.created_at).toLocaleString() : '—'}</td>
                  <td className="py-1.5 pr-3 uppercase font-semibold">{job.entity_type}</td>
                  <td className="py-1.5 pr-3 truncate max-w-[180px] font-mono text-[var(--text-primary)]">{job.filename}</td>
                  <td className={`py-1.5 pr-3 uppercase font-semibold ${job.status === 'completed' ? 'text-[#0E9E78]' : job.status === 'failed' ? 'text-red-400' : 'text-amber-300'}`}>{job.status}</td>
                  <td className="py-1.5 pr-3 text-[#0E9E78]">{job.imported_rows}</td>
                  <td className="py-1.5 pr-3 text-red-400">{job.failed_rows}</td>
                  <td className="py-1.5 text-right space-x-1">
                    <button
                      onClick={() => void loadStaged(job.id)}
                      className="px-2 py-0.5 rounded border border-indigo-500/35 bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25"
                    >
                      Inspect Staged
                    </button>
                    <button
                      onClick={() => void loadQuality(job.id)}
                      className="px-2 py-0.5 rounded border border-blue-500/35 bg-blue-500/15 text-blue-300 hover:bg-blue-500/25"
                    >
                      Quality
                    </button>
                    <button
                      onClick={() => void handlePromote(job.id)}
                      className="px-2 py-0.5 rounded border border-emerald-500/35 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                    >
                      Promote
                    </button>
                    <button
                      onClick={() => void handleRollback(job.id)}
                      className="px-2 py-0.5 rounded border border-red-500/35 bg-red-500/15 text-red-300 hover:bg-red-500/25"
                    >
                      Rollback
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Staged Records Modal */}
      {inspectJobId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl max-w-4xl w-full p-5 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[var(--border-muted)] pb-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Staging Table Inspection · Job {inspectJobId.slice(0, 8)}
                </h4>
                <p className="text-[10px] text-[var(--text-muted)] font-mono">
                  Showing {stagedRecords.length} of {stagedTotal} staged records
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={stagedFilter}
                  onChange={(e) => {
                    setStagedFilter(e.target.value);
                    void loadStaged(inspectJobId, e.target.value);
                  }}
                  className="rounded bg-[var(--bg-secondary)] border border-[var(--border-primary)] px-2 py-1 text-[11px] text-[var(--text-primary)]"
                >
                  <option value="all">All Statuses</option>
                  <option value="valid">Valid Only</option>
                  <option value="invalid">Invalid Only</option>
                  <option value="warning">Warnings Only</option>
                </select>
                <button
                  onClick={() => setInspectJobId(null)}
                  className="px-2.5 py-1 rounded border border-[var(--border-primary)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="overflow-auto flex-1 custom-scrollbar">
              {stagedLoading ? (
                <div className="p-8 text-center text-xs text-[var(--text-muted)]">Loading staged records...</div>
              ) : stagedRecords.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--text-muted)]">No staged records found for this filter.</div>
              ) : (
                <table className="w-full text-left text-[10px]">
                  <thead className="bg-[var(--bg-secondary)] text-[var(--text-muted)] uppercase tracking-wider font-mono">
                    <tr>
                      <th className="p-2">Row</th>
                      <th className="p-2">Validation</th>
                      <th className="p-2">Duplicate</th>
                      <th className="p-2">Promoted</th>
                      <th className="p-2">Payload Preview</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-primary)] text-[var(--text-secondary)] font-mono">
                    {stagedRecords.map((item) => (
                      <tr key={item.id} className="hover:bg-[var(--bg-secondary)]/30">
                        <td className="p-2 font-bold">{item.row_number}</td>
                        <td className="p-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${
                              item.validation_status === 'valid'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : item.validation_status === 'warning'
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                : 'bg-red-500/15 text-red-400 border border-red-500/30'
                            }`}
                          >
                            {item.validation_status}
                          </span>
                        </td>
                        <td className="p-2">
                          <span className="text-[10px] text-[var(--text-muted)]">
                            {item.duplicate_status}
                          </span>
                        </td>
                        <td className="p-2">
                          <span className={item.promoted ? 'text-emerald-400 font-bold' : 'text-zinc-500'}>
                            {item.promoted ? 'YES' : 'NO'}
                          </span>
                        </td>
                        <td className="p-2 font-mono text-[9px] text-[var(--text-muted)] truncate max-w-xs">
                          {JSON.stringify(item.normalized_payload || item.raw_payload)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-[var(--border-muted)]">
              <span className="text-[10px] text-[var(--text-muted)]">
                Staged items are held in isolation prior to production promotion
              </span>
              <button
                onClick={() => void handlePromote(inspectJobId)}
                className="px-3 py-1.5 rounded bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 transition-colors"
              >
                Promote Job Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quality Report Modal */}
      {qualityReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-muted)] pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                Import Quality Report · {qualityReport.job_id.slice(0, 8)}
              </h4>
              <button
                onClick={() => setQualityReport(null)}
                className="px-2 py-0.5 rounded border border-[var(--border-primary)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              <div className="p-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)]/50">
                <span className="block text-[10px] uppercase text-[var(--text-muted)]">Quality Grade</span>
                <span className="text-lg font-bold text-indigo-300">{qualityReport.quality_grade}</span>
                <span className="block text-[9px] text-[var(--text-muted)]">Recomputed: {qualityReport.recomputed_grade}</span>
              </div>
              <div className="p-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)]/50">
                <span className="block text-[10px] uppercase text-[var(--text-muted)]">Problem Ratio</span>
                <span className="text-lg font-bold text-amber-300">
                  {qualityReport.problem_ratio !== null ? `${(qualityReport.problem_ratio * 100).toFixed(1)}%` : '0%'}
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--border-primary)] p-3 space-y-2">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Trust &amp; Promotion Summary
              </span>
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                <div className="text-emerald-400">Promotable Now: {qualityReport.trust_summary?.promotable_now ?? 0}</div>
                <div className="text-amber-300">Requires Review: {qualityReport.trust_summary?.requires_review ?? 0}</div>
                <div className="text-red-400">Rejected / Duplicate: {qualityReport.trust_summary?.rejected_or_duplicated ?? 0}</div>
                <div className="text-blue-300">Already Promoted: {qualityReport.trust_summary?.promoted ?? 0}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataImportPanel;
