import React, { useCallback, useEffect, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  Download,
  FilePlus2,
  FileText,
  History,
  Layers,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  archiveReport,
  createReport,
  createReportVersion,
  finalizeReport,
  getReportAudit,
  getReportDetail,
  listReports,
  reviewReport,
  type ReportAuditEntry,
  type ReportDetail,
  type ReportRecord,
} from '../../services/api';

const STATUS_STYLES: Record<string, string> = {
  draft: 'border-[var(--accent-amber)]/40 text-amber-300',
  generating: 'border-[var(--accent-teal)]/40 text-teal-300',
  generated: 'border-[var(--accent-blue)]/40 text-[#4DA3FF]',
  under_review: 'border-[var(--accent-purple)]/40 text-purple-300',
  final: 'border-emerald-500/40 text-emerald-300',
  archived: 'border-[var(--text-muted)]/40 text-[var(--text-muted)]',
  failed: 'border-[var(--accent-coral)]/40 text-coral-400',
};

const PROVENANCE_STYLES: Record<string, string> = {
  live: 'text-emerald-300 border-emerald-500/30',
  migrated: 'text-[#4DA3FF] border-[var(--accent-blue)]/30',
  demo: 'text-amber-300 border-[var(--accent-amber)]/30',
  mixed: 'text-purple-300 border-[var(--accent-purple)]/30',
  unknown: 'text-[var(--text-muted)] border-[var(--text-muted)]/30',
};

const ACTIONS_ORDER: Record<string, number> = {
  REPORT_CREATE: 0,
  REPORT_GENERATE: 1,
  REPORT_GENERATION_FAILED: 1,
  REPORT_REVIEW: 2,
  REPORT_FINALIZE: 3,
  REPORT_ARCHIVE: 4,
  REPORT_VIEW: 0,
  REPORT_DOWNLOAD: 0,
  REPORT_VERSION_CREATE: 0,
  REPORT_AI_VALIDATION: 0,
};

const ACTION_LABELS: Record<string, string> = {
  REPORT_CREATE: 'Draft Created',
  REPORT_GENERATE: 'Generated',
  REPORT_GENERATION_FAILED: 'Generation Failed',
  REPORT_REVIEW: 'Under Review',
  REPORT_FINALIZE: 'Finalized',
  REPORT_ARCHIVE: 'Archived',
  REPORT_VIEW: 'Viewed',
  REPORT_DOWNLOAD: 'Downloaded',
  REPORT_VERSION_CREATE: 'New Version',
  REPORT_AI_VALIDATION: 'AI Reference Validation',
};

const STATUS_PROGRESS: Record<string, string> = {
  draft: 'Draft',
  generating: 'Generating',
  generated: 'Generated',
  under_review: 'Under Review',
  final: 'Final',
  archived: 'Archived',
  failed: 'Failed',
};

export const ManagedReportLifecycle: React.FC<{ role: string }> = ({ role }) => {
  const isAdmin = role === 'ADMIN';
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [selected, setSelected] = useState<ReportDetail | null>(null);
  const [audit, setAudit] = useState<ReportAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listReports(1, 100);
      setReports(res.results);
      if (selected && res.results.some((r) => r.id === selected.id)) {
        const detail = await getReportDetail(selected.id);
        setSelected(detail);
        if (isAdmin) {
          try {
            const a = await getReportAudit(selected.id);
            setAudit(a.results);
          } catch { setAudit([]); }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load managed reports');
    } finally {
      setLoading(false);
    }
  }, [selected?.id, isAdmin]);

  useEffect(() => { void reload(); }, []);

  const openReport = async (id: string) => {
    setError(null);
    try {
      const detail = await getReportDetail(id);
      setSelected(detail);
      setAudit([]);
      if (isAdmin) {
        try {
          const a = await getReportAudit(id);
          setAudit(a.results);
        } catch { setAudit([]); }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    }
  };

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setBusy(null);
    }
  };

  const sorted = [...reports].sort((a, b) => (ACTIONS_ORDER[a.status] ?? 0) - (ACTIONS_ORDER[b.status] ?? 0));

  return (
    <div className="rounded-lg border border-border-color bg-[var(--bg-tertiary)]/35 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] uppercase tracking-[0.24em] text-[var(--text-muted)]">Managed Report Lifecycle</p>
          <p className="mt-1 text-[10px] text-[var(--text-muted)]">
            Draft → Generate → Review → Final → Archive · provenance, versioning & integrity
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void run('create', () => createReport({ report_type: 'cases', title: `Operations Report ${new Date().toISOString().slice(0, 10)}` }))}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded border border-[var(--accent-blue)]/35 bg-[var(--accent-blue)]/15 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white disabled:opacity-40"
          >
            <FilePlus2 className="h-3.5 w-3.5" /> New Draft
          </button>
          <button onClick={() => void reload()} disabled={busy !== null} className="inline-flex items-center gap-2 rounded bg-[var(--bg-primary)] border border-border-color px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] disabled:opacity-40">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      {error && <div className="rounded border border-[var(--accent-coral)]/40 bg-[var(--accent-coral)]/10 p-3 text-[10px] text-coral-400">{error}</div>}

      {loading && <div className="p-8 text-center text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Loading managed reports</div>}

      {!loading && reports.length === 0 && (
        <div className="p-8 text-center text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
          No managed reports yet — create a draft to start the auditable lifecycle
        </div>
      )}

      {!loading && reports.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {sorted.map((r) => (
            <button
              key={r.id}
              onClick={() => void openReport(r.id)}
              className={`rounded-lg border p-3 text-left transition-colors ${selected?.id === r.id ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)]/10' : 'border-border-color bg-[var(--bg-secondary)]/60 hover:border-[var(--accent-blue)]/40'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 shrink-0 text-[#4DA3FF]" />
                  <span className="truncate text-[11px] font-bold text-[var(--text-primary)]">{r.title ?? `${r.report_type} report`}</span>
                </div>
                <span className={`shrink-0 rounded border px-2 py-0.5 text-[9px] uppercase tracking-wider ${STATUS_STYLES[r.status] ?? 'border-border-color text-[var(--text-muted)]'}`}>
                  {STATUS_PROGRESS[r.status] ?? r.status}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[9px]">
                <span className={`rounded border px-1.5 py-0.5 uppercase tracking-wider ${PROVENANCE_STYLES[r.provenance] ?? 'border-border-color text-[var(--text-muted)]'}`}>
                  {r.provenance ?? 'unknown'}
                </span>
                <span className="inline-flex items-center gap-1 text-[var(--text-muted)]"><Layers className="h-3 w-3" /> v{r.version}</span>
                {r.ai_reported && <span className="inline-flex items-center gap-1 text-purple-300"><ShieldCheck className="h-3 w-3" /> AI</span>}
                <span className="text-[var(--text-muted)]">
                  {r.source_record_count > 0 ? `${r.source_record_count} sources` : 'No linked sources'} · {r.evidence_count} evidence
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="mt-4 rounded-lg border border-border-color bg-[var(--bg-primary)]/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-color pb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">{selected.title}</p>
              <p className="mt-1 text-[9px] text-[var(--text-muted)]">
                {selected.report_type} · {selected.requested_by ?? 'unknown user'} · created {selected.created_at ? new Date(selected.created_at).toLocaleString() : '—'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab: 'ai_chat', targetId: selected.id, targetType: 'report' } }))}
                className="inline-flex items-center gap-1 rounded border border-purple-400/35 bg-purple-500/15 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-white"
                title="Ask SAKSHA AI about this report"
              >
                <Sparkles className="h-3 w-3 text-purple-300" /> Ask AI
              </button>
              <button onClick={() => void run('dl', () => downloadManaged(selected.id))} disabled={busy !== null} className="inline-flex items-center gap-1 rounded border border-[var(--accent-teal)]/35 bg-[var(--accent-teal)]/15 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-white disabled:opacity-40">
                <Download className="h-3 w-3" /> Download
              </button>
              {selected.status !== 'final' && selected.status !== 'archived' && (
                <button onClick={() => void run('review', () => reviewReport(selected.id, note))} disabled={busy !== null} className="inline-flex items-center gap-1 rounded border border-[var(--accent-purple)]/35 bg-[var(--accent-purple)]/15 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-white disabled:opacity-40">
                  <ShieldCheck className="h-3 w-3" /> Review
                </button>
              )}
              {selected.status === 'under_review' && (
                <button onClick={() => void run('final', () => finalizeReport(selected.id, note))} disabled={busy !== null} className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-white disabled:opacity-40">
                  <CheckCircle2 className="h-3 w-3" /> Finalize
                </button>
              )}
              {selected.status !== 'archived' && (
                <button onClick={() => void run('archive', () => archiveReport(selected.id))} disabled={busy !== null} className="inline-flex items-center gap-1 rounded border border-[var(--text-muted)]/40 bg-[var(--bg-secondary)]/40 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] disabled:opacity-40">
                  <Archive className="h-3 w-3" /> Archive
                </button>
              )}
              {selected.status !== 'archived' && (
                <button onClick={() => void run('version', () => createReportVersion(selected.id, note || 'Operations revision'))} disabled={busy !== null} className="inline-flex items-center gap-1 rounded border border-[var(--accent-amber)]/40 bg-[var(--accent-amber)]/15 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-white disabled:opacity-40">
                  <Layers className="h-3 w-3" /> New Version
                </button>
              )}
            </div>
          </div>

          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Review note / version reason"
            className="mt-3 w-full rounded bg-[var(--bg-primary)] border border-border-color px-3 py-2 text-[10px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-blue)]"
          />

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded border border-border-color bg-[var(--bg-tertiary)]/30 p-3">
              <p className="text-[9px] uppercase tracking-[0.24em] text-[var(--text-muted)]">Meta & Integrity</p>
              <dl className="mt-2 space-y-1 text-[10px]">
                <Row label="Status" value={STATUS_PROGRESS[selected.status] ?? selected.status} />
                <Row label="Provenance" value={selected.provenance} />
                <Row label="Generation" value={selected.generation_method ?? '—'} />
                <Row label="Version" value={`v${selected.version}`} />
                <Row label="Sources" value={selected.source_record_count > 0 ? `${selected.source_record_count} record(s)` : 'None linked'} />
                <Row label="Evidence" value={`${selected.evidence_count} record(s)`} />
                <Row label="Reviewed by" value={selected.reviewed_by ?? '—'} />
                <Row label="Finalized by" value={selected.finalized_by ?? '—'} />
                <div className="pt-1">
                  <span className="text-[var(--text-muted)]">Integrity Hash</span>
                  <p className="break-all font-mono text-[9px] text-[var(--text-secondary)]">{selected.integrity_hash ?? '—'}</p>
                </div>
              </dl>
            </div>

            <div className="rounded border border-border-color bg-[var(--bg-tertiary)]/30 p-3">
              <p className="text-[9px] uppercase tracking-[0.24em] text-[var(--text-muted)]">Provenance & AI</p>
              <p className="mt-2 text-[10px] text-[var(--text-secondary)]">
                {selected.ai_reported
                  ? `AI-assisted (${selected.ai_metadata?.provider ?? selected.ai_metadata?.model ?? 'model'} · ${selected.generation_method})`
                  : 'Database-derived export (no AI involved)'}
              </p>
              {selected.sources.length > 0 && (
                <div className="mt-2">
                  <p className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">Source Records</p>
                  {selected.sources.slice(0, 10).map((s, i) => (
                    <p key={i} className="truncate text-[9px] text-[var(--text-secondary)]">· {s.source_type}: {s.source_label ?? s.source_id}</p>
                  ))}
                </div>
              )}
              {selected.evidence.length > 0 && (
                <div className="mt-2">
                  <p className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">Supporting Evidence</p>
                  {selected.evidence.slice(0, 10).map((e, i) => (
                    <p key={i} className="truncate text-[9px] text-[var(--text-secondary)]">· {e.title ?? e.evidence_id} ({e.evidence_type})</p>
                  ))}
                </div>
              )}
              {selected.snapshot_headers.length > 0 && (
                <p className="mt-2 text-[9px] text-[var(--text-muted)]">Snapshot: {selected.snapshot_row_count} rows from {selected.snapshot_headers.length} columns</p>
              )}
            </div>
          </div>

          {isAdmin && audit.length > 0 && (
            <div className="mt-4">
              <p className="inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.24em] text-[var(--text-muted)]"><History className="h-3 w-3" /> Audit Trail (administrative)</p>
              <div className="mt-2 space-y-1">
                {audit.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 rounded border border-border-color bg-[var(--bg-tertiary)]/20 px-3 py-1.5 text-[9px]">
                    <span className="text-[var(--text-muted)]">{a.timestamp ? new Date(a.timestamp).toLocaleString() : '—'}</span>
                    <span className="font-bold text-[var(--text-primary)]">{ACTION_LABELS[a.action] ?? a.action}</span>
                    <span className="text-[var(--text-muted)]">by {a.user}</span>
                    <span className={`ml-auto rounded px-1.5 py-0.5 uppercase ${a.result === 'success' ? 'text-emerald-300' : 'text-coral-400'}`}>{a.result}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between gap-2">
    <span className="text-[var(--text-muted)]">{label}</span>
    <span className="text-[var(--text-secondary)]">{value}</span>
  </div>
);

async function downloadManaged(reportId: string) {
  // Managed-report downloads use the authenticated JSON API; the blob is
  // fetched with the bearer token directly for all supported formats.
  const m = await import('../../services/api');
  const { getStoredTokens, API_BASE_URL } = m;
  const { accessToken } = getStoredTokens();
  const resp = await fetch(`${API_BASE_URL}/reports/${reportId}/download?export_format=pdf`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  if (!resp.ok) throw new Error(`Download failed (${resp.status})`);
  const blob = await resp.blob();
  const disposition = resp.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? `saksha_report_${reportId}.pdf`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 300);
}