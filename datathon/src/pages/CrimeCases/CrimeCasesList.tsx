import React, { useEffect, useState } from 'react';
import {
  getCrimeCases,
  getCrimeCaseInsights,
  deleteCrimeCase,
  getCrimeCategories,
  getLocationsList,
} from '../../services/api';
import { usePolling } from '../../hooks/usePolling';
import type { CrimeCaseDetailRecord, CrimeCaseInsights } from '../../services/api';
import { Search, Plus, Eye, Edit2, Trash2, ShieldAlert, X, AlertTriangle, Sparkles } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useRealtimeStore } from '../../store/realtimeStore';
import CrimeInsightsBar from '../../components/crimeCases/CrimeInsightsBar';
import PageHeader from '../../components/ui/PageHeader';
import { useUserScope } from '../../hooks/useUserScope';
import { useTranslation } from '../../i18n';

interface CrimeCasesListProps {
  onSelectCase: (id: string) => void;
  onCreateCase: () => void;
  onEditCase: (id: string) => void;
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  'under_investigation': 'Under investigation',
  arrested: 'Arrested',
  chargesheeted: 'Chargesheeted',
  convicted: 'Convicted',
  closed: 'Closed',
  open: 'Open',
  assigned: 'Assigned',
  investigating: 'Under investigation',
  'evidence collected': 'Evidence collected',
  'charge sheet filed': 'Charge sheet filed',
};

const PRIORITY_LABEL: Record<string, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const STATUS_TONE: Record<string, { color: string; background: string }> = {
  active: { color: 'var(--accent-coral-light)', background: 'var(--accent-coral-subtle)' },
  'under_investigation': { color: 'var(--accent-purple-light)', background: 'var(--accent-purple-subtle)' },
  arrested: { color: 'var(--accent-amber-light)', background: 'var(--accent-amber-subtle)' },
  chargesheeted: { color: 'var(--accent-blue-light)', background: 'var(--accent-blue-subtle)' },
  convicted: { color: 'var(--accent-teal-light)', background: 'var(--accent-teal-subtle)' },
  closed: { color: 'var(--accent-teal-light)', background: 'var(--accent-teal-subtle)' },
  open: { color: 'var(--accent-coral-light)', background: 'var(--accent-coral-subtle)' },
  assigned: { color: 'var(--accent-cyan-light)', background: 'var(--accent-cyan-subtle)' },
  investigating: { color: 'var(--accent-purple-light)', background: 'var(--accent-purple-subtle)' },
  'evidence collected': { color: 'var(--accent-amber-light)', background: 'var(--accent-amber-subtle)' },
  'charge sheet filed': { color: 'var(--accent-blue-light)', background: 'var(--accent-blue-subtle)' },
};

const PRIORITY_TONE: Record<string, { color: string; background: string }> = {
  critical: { color: 'var(--accent-coral-light)', background: 'var(--accent-coral-subtle)' },
  high: { color: 'var(--accent-amber-light)', background: 'var(--accent-amber-subtle)' },
  medium: { color: 'var(--accent-purple-light)', background: 'var(--accent-purple-subtle)' },
  low: { color: 'var(--accent-teal-light)', background: 'var(--accent-teal-subtle)' },
};

const NEEDS_ATTENTION_STATUSES = new Set([
  'active', 'under_investigation', 'arrested',
  'open', 'assigned', 'investigating', 'evidence collected',
]);

const daysSince = (iso?: string | null) =>
  iso ? Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 86400000)) : 0;

const sortAttentionFirst = (rows: CrimeCaseDetailRecord[]) =>
  [...rows].sort(
    (a, b) =>
      (a.priority === 'critical' ? 0 : a.priority === 'high' ? 1 : a.priority === 'medium' ? 2 : 3) -
        (b.priority === 'critical' ? 0 : b.priority === 'high' ? 1 : b.priority === 'medium' ? 2 : 3) ||
      String(a.case_number).localeCompare(String(b.case_number)),
  );

const needsAttention = (c: CrimeCaseDetailRecord) =>
  c.progress != null &&
  NEEDS_ATTENTION_STATUSES.has(c.status) &&
  c.progress < 40;

const CrimeCasesList: React.FC<CrimeCasesListProps> = ({
  onSelectCase,
  onCreateCase,
  onEditCase
}) => {
  const t = useTranslation();
  const { district: scopeDistrict, canSelectDistrict } = useUserScope();
  const user = useAuthStore((state) => state.user);
  const canWrite = user?.role === 'ADMIN' || user?.role === 'IO' || user?.role === 'SCRB';
  const canDelete = user?.role === 'ADMIN';
  const [cases, setCases] = useState<CrimeCaseDetailRecord[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState<string>(() => (canSelectDistrict ? '' : scopeDistrict || ''));
  const [priorityFilter, setPriorityFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CrimeCaseDetailRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [insights, setInsights] = useState<CrimeCaseInsights | null>(null);

  const fetchInsights = async () => {
    try {
      const result = await getCrimeCaseInsights({
        status: statusFilter || undefined,
        category_id: categoryFilter || undefined,
        district: canSelectDistrict ? districtFilter || undefined : scopeDistrict || undefined,
        priority: priorityFilter || undefined,
      });
      setInsights(result);
    } catch {
      setInsights(null);
    }
  };

  const fetchCases = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getCrimeCases(search || undefined, statusFilter || undefined, 1, 20, {
        category_id: categoryFilter || undefined,
        district: canSelectDistrict ? districtFilter || undefined : scopeDistrict || undefined,
        priority: priorityFilter || undefined,
      });
      setCases(sortAttentionFirst(response.results));
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch crime cases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchCases();
      fetchInsights();
    }, 400);
    return () => window.clearTimeout(timer);
  }, [search, statusFilter, categoryFilter, districtFilter, priorityFilter]);

  // Load filter dropdown options once
  useEffect(() => {
    getCrimeCategories()
      .then(setCategories)
      .catch((err) => console.error('Failed to load crime filter options', err));
    getLocationsList()
      .then((locations) =>
        setDistricts(Array.from(new Set(locations.map((loc) => loc.district).filter(Boolean))).sort()),
      )
      .catch((err) => console.error('Failed to load crime filter options', err));
  }, []);

  // Background polling: silently refresh cases and insights every 30s
  usePolling(async () => {
    try {
      const response = await getCrimeCases(search || undefined, statusFilter || undefined, 1, 20, {
        category_id: categoryFilter || undefined,
        district: canSelectDistrict ? districtFilter || undefined : scopeDistrict || undefined,
        priority: priorityFilter || undefined,
      });
      setCases(sortAttentionFirst(response.results));
      setError(null);
    } catch { /* silent */ }
    try {
      const result = await getCrimeCaseInsights({
        status: statusFilter || undefined,
        category_id: categoryFilter || undefined,
        district: canSelectDistrict ? districtFilter || undefined : scopeDistrict || undefined,
        priority: priorityFilter || undefined,
      });
      setInsights(result);
    } catch { /* silent */ }
  }, 30000);

  // Real-time feed: newly created cases appear at the top instantly.
  useEffect(() => {
    useRealtimeStore.getState().connect();
    const unsubscribe = useRealtimeStore.getState().onCaseCreated((liveCase) => {
      if (search || (statusFilter && statusFilter !== liveCase.status)) return;
      setCases((prev) => [
        {
          id: liveCase.id || '',
          case_number: liveCase.case_number,
          category_id: '',
          location_id: '',
          occurred_at: liveCase.time || new Date().toISOString(),
          reported_at: new Date().toISOString(),
          description: null,
          mo_tags: null,
          status: liveCase.status,
          priority: liveCase.priority,
          progress: null,
        } as unknown as CrimeCaseDetailRecord,
        ...prev.filter((c) => c.case_number !== liveCase.case_number),
      ].slice(0, 20));
      fetchInsights();
    });
    return () => {
      unsubscribe();
      useRealtimeStore.getState().disconnect();
    };
  }, [search, statusFilter]);

  const handleDeleteClick = (caseRecord: CrimeCaseDetailRecord) => {
    setDeleteError(null);
    setPendingDelete(caseRecord);
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteCrimeCase(pendingDelete.id);
      setPendingDelete(null);
      fetchCases();
      fetchInsights();
    } catch (err: any) {
      setDeleteError(err?.message || 'Failed to delete case');
    } finally {
      setDeleting(false);
    }
  };

  const getStatusStyle = (status: string) => STATUS_TONE[status.toLowerCase()] || {
    color: 'var(--text-secondary)',
    background: 'var(--bg-tertiary)',
  };

  const getPriorityStyle = (priority: string) => PRIORITY_TONE[priority.toLowerCase()] || {
    color: 'var(--text-secondary)',
    background: 'var(--bg-tertiary)',
  };
  const formatCaseDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header — plain-language entry with operating-area chip */}
      <PageHeader
        title={t.cc_title}
        subtitle={t.cc_subtitle}
        icon={<ShieldAlert className="w-5 h-5" />}
        actions={
          <>
            {scopeDistrict && (
              <span
                className="sk-header-chip hidden sm:inline-flex"
                data-accent="cyan"
                title="Your operating area — set from your profile"
              >
                <Search className="w-3 h-3" />
                {scopeDistrict}
              </span>
            )}
            {canWrite && (
              <button
                onClick={onCreateCase}
                className="sk-btn cursor-pointer"
                style={{ background: 'var(--accent-blue)', borderColor: 'var(--accent-blue)', color: '#fff' }}
              >
                <Plus className="w-4 h-4" /> {t.cc_create}
              </button>
            )}
          </>
        }
      />

      {/* Visual Crime Telemetry & Insights Ribbon */}
      <CrimeInsightsBar
        insights={insights}
        activeStatus={statusFilter}
        activePriority={priorityFilter}
        onSelectStatus={(s) => setStatusFilter(s)}
        onSelectPriority={(p) => setPriorityFilter(p)}
        onResetFilters={() => {
          setSearch('');
          setStatusFilter('');
          setCategoryFilter('');
          setDistrictFilter(canSelectDistrict ? '' : scopeDistrict || '');
          setPriorityFilter('');
        }}
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:flex-wrap gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder={t.cc_search_hint}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sk-input w-full pl-9 pr-3 py-1.5"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="sk-select w-full md:w-44 px-3 py-1.5 cursor-pointer"
        >
          <option value="">{t.cc_all_status}</option>
          <option value="active">Active</option>
          <option value="under_investigation">Under investigation</option>
          <option value="arrested">Arrested</option>
          <option value="chargesheeted">Chargesheeted</option>
          <option value="convicted">Convicted</option>
          <option value="closed">Closed</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="sk-select w-full md:w-48 px-3 py-1.5 cursor-pointer"
        >
          <option value="">{t.cc_all_categories}</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
        {canSelectDistrict ? (
          <select
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
            className="sk-select w-full md:w-44 px-3 py-1.5 cursor-pointer"
          >
            <option value="">{t.cc_all_districts}</option>
            {districts.map((dist) => (
              <option key={dist} value={dist}>{dist}</option>
            ))}
          </select>
        ) : scopeDistrict ? (
          <div
            className="sk-select w-full md:w-44 px-3 py-1.5 !cursor-not-allowed opacity-90 select-none"
            title="Your data scope is fixed to your operating area"
          >
            {scopeDistrict}
          </div>
        ) : null}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="sk-select w-full md:w-40 px-3 py-1.5 cursor-pointer"
        >
          <option value="">{t.cc_all_priorities}</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        {(search || statusFilter || categoryFilter || districtFilter || priorityFilter) && (
          <button
            onClick={() => {
              setSearch('');
              setStatusFilter('');
              setCategoryFilter('');
              setDistrictFilter(canSelectDistrict ? '' : scopeDistrict || '');
              setPriorityFilter('');
            }}
            className="sk-btn sk-btn-secondary cursor-pointer uppercase"
          >
            {t.cc_reset}
          </button>
        )}
      </div>

      {/* Main Grid View */}
      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[#1E6FD9] border-t-transparent animate-spin" />
        </div>
      ) : error ? (
        <div className="p-5 border border-[#C94A2A]/20 bg-[#C94A2A]/5 text-[#C94A2A] rounded-card text-xs flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : cases.length === 0 ? (
        <div className="p-8 border border-border-color bg-secondary-bg rounded-card text-center text-xs text-[var(--text-muted)]">
          {t.cc_no_cases}
        </div>
      ) : (
        <div className="border border-border-color rounded-card overflow-hidden bg-secondary-bg">
          {/* Desktop full table — ≥1400px. All 8 columns fit in the content
              area at this width, so the sticky actions column stays on-screen
              without horizontal scrolling. */}
          <div className="hidden min-[1400px]:block overflow-x-auto">
            <table className="w-full border-collapse font-mono text-xs text-left">
              <thead>
                <tr className="border-b border-border-color bg-[var(--bg-secondary)]/40 text-[var(--text-muted)] uppercase select-none">
                  <th className="p-4">{t.cc_case_details}</th>
                  <th className="p-4">{t.cc_occurred_at}</th>
                  <th className="p-4">{t.cc_district}</th>
                  <th className="p-4">{t.cc_category}</th>
                  <th className="p-4 text-center">{t.cc_status}</th>
                  <th className="p-4 text-center">{t.cc_priority}</th>
                  <th className="p-4">{t.cc_progress}</th>
                  <th className="p-4 text-right sticky right-0 bg-[var(--bg-secondary)]/90 border-l border-border-color/60 shadow-[-4px_0_8px_rgba(0,0,0,0.08)]">
                    {t.cc_actions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color/65">
                {cases.map((c) => (
                   <tr
                    key={c.id}
                    onClick={() => onSelectCase(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectCase(c.id);
                      }
                    }}
                    tabIndex={0}
                    className="hover:bg-[var(--bg-surface-hover)] transition-colors group cursor-pointer"
                  >
                    <td className="p-4">
                      <div className="font-bold text-[var(--text-primary)] group-hover:text-[var(--text-primary)] uppercase">
                        {c.case_number}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] mt-1 line-clamp-1 max-w-sm">
                        {c.description || t.cc_no_description}
                      </div>
                    </td>
                    <td className="p-4 text-[var(--text-secondary)]">
                      {formatCaseDate(c.occurred_at)}
                    </td>
                    <td className="p-4 text-[var(--text-secondary)]">
                      {c.location?.district || '—'}
                    </td>
                    <td className="p-4 text-[var(--text-secondary)]">
                      {c.category?.name || '—'}
                    </td>
                    <td className="p-4 text-center">
                      <span className="sk-chip px-2 py-0.5" style={getStatusStyle(c.status)}>
                        {STATUS_LABEL[c.status] || c.status.replace(/_/g, ' ')}
                      </span>
                      {needsAttention(c) && (
                        <div className="mt-1 flex items-center justify-center gap-1 text-[9px] text-[var(--accent-coral-light)]">
                          <span className="w-1 h-1 rounded-full bg-[var(--accent-coral)] animate-pulse" />
                          {daysSince(c.reported_at)} days open
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span className="sk-chip px-2 py-0.5" style={getPriorityStyle(c.priority)}>
                        {PRIORITY_LABEL[c.priority] || c.priority}
                      </span>
                    </td>
                    <td className="p-4 min-w-[150px]">
                      {c.progress == null ? (
                        <span className="text-[10px] text-[var(--text-muted)] uppercase">—</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden border border-[var(--border-primary)]">
                            <div
                              className="h-full bg-gradient-to-r from-[#1E6FD9] to-[#0E9E78] transition-all duration-500"
                              style={{ width: `${c.progress}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-[var(--text-primary)] shrink-0">
                            {c.progress}%
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="p-4 sticky right-0 bg-[var(--bg-secondary)] border-l border-border-color/60">
                      <div className="flex items-center justify-end gap-2.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); onSelectCase(c.id); }}
                          title={t.cc_view}
                          className="p-1.5 hover:bg-[#1E6FD9]/15 border border-border-color rounded text-[var(--text-secondary)] hover:text-[#1E6FD9] transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab: 'ai_chat', targetId: c.id } }));
                          }}
                          title="Ask SAKSHA AI about this case"
                          className="p-1.5 hover:bg-[#8B5CF6]/15 border border-border-color rounded text-[var(--text-secondary)] hover:text-[#8B5CF6] transition-colors cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                        </button>
                        {canWrite && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onEditCase(c.id); }}
                          title={t.cc_edit}
                          className="p-1.5 hover:bg-[#0E9E78]/15 border border-border-color rounded text-[var(--text-secondary)] hover:text-[#0E9E78] transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        )}
                        {canDelete && (
<button
                          onClick={(e) => { e.stopPropagation(); handleDeleteClick(c); }}
                            title={t.cc_purge}
                            className="p-1.5 hover:bg-[#C94A2A]/15 border border-border-color rounded text-[var(--text-secondary)] hover:text-[#C94A2A] transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Compact list — 768px to 1399px. A slim representation with
              Case / Category / Status / Priority / Actions only, so the action
              buttons fit on-screen at tablet and mid-size desktop widths with
              NO horizontal scrolling or clipped columns. */}
          <div className="hidden md:block min-[1400px]:hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border-color bg-[var(--bg-secondary)]/40 text-[10px] uppercase tracking-wider text-[var(--text-muted)] select-none">
              <span className="flex-1 min-w-0">Case</span>
              <span className="w-[96px] min-[1100px]:w-[120px] shrink-0">Category</span>
              <span className="w-[92px] min-[1100px]:w-[104px] shrink-0 text-center">Status</span>
              <span className="w-[70px] min-[1100px]:w-[80px] shrink-0 text-center">Priority</span>
              <span className="w-[108px] min-[1100px]:w-[116px] shrink-0 text-right">Actions</span>
            </div>
            <div className="divide-y divide-border-color/65">
              {cases.map((c) => (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectCase(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectCase(c.id);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-3 hover:bg-[var(--bg-surface-hover)] transition-colors group cursor-pointer min-w-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-[var(--text-primary)] uppercase text-xs truncate">{c.case_number}</span>
                      {needsAttention(c) && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-coral)] animate-pulse shrink-0" title="Needs attention" />
                      )}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] mt-0.5 line-clamp-1">{c.description || t.cc_no_description}</div>
                    <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">{formatCaseDate(c.occurred_at)}</div>
                  </div>

                  <div className="w-[96px] min-[1100px]:w-[120px] shrink-0">
                    <span className="block text-[11px] text-[var(--text-secondary)] line-clamp-1">{c.category?.name || '—'}</span>
                    <span className="block text-[9px] text-[var(--text-muted)] mt-0.5">{c.location?.district || '—'}</span>
                  </div>

                  <div className="w-[92px] min-[1100px]:w-[104px] shrink-0 flex items-center justify-center">
                    <span className="sk-chip px-2 py-0.5" style={getStatusStyle(c.status)}>
                      {STATUS_LABEL[c.status] || c.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="w-[70px] min-[1100px]:w-[80px] shrink-0 flex items-center justify-center">
                    <span className="sk-chip px-2 py-0.5" style={getPriorityStyle(c.priority)}>
                      {PRIORITY_LABEL[c.priority] || c.priority}
                    </span>
                  </div>

                  <div className="w-[108px] min-[1100px]:w-[116px] shrink-0 flex items-center justify-end gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); onSelectCase(c.id); }}
                      title={t.cc_view}
                      className="p-1 hover:bg-[#1E6FD9]/15 border border-border-color rounded text-[var(--text-secondary)] hover:text-[#1E6FD9] transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab: 'ai_chat', targetId: c.id } }));
                      }}
                      title="Ask SAKSHA AI about this case"
                      className="p-1 hover:bg-[#8B5CF6]/15 border border-border-color rounded text-[var(--text-secondary)] hover:text-[#8B5CF6] transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                    {canWrite && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onEditCase(c.id); }}
                        title={t.cc_edit}
                        className="p-1 hover:bg-[#0E9E78]/15 border border-border-color rounded text-[var(--text-secondary)] hover:text-[#0E9E78] transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteClick(c); }}
                        title={t.cc_purge}
                        className="p-1 hover:bg-[#C94A2A]/15 border border-border-color rounded text-[var(--text-secondary)] hover:text-[#C94A2A] transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile card list — replaces every table layout on <768px so all
              case data and actions stay on-screen without horizontal scrolling. */}
          <div className="md:hidden divide-y divide-border-color/65">
            {cases.map((c) => (
              <div
                key={c.id}
                onClick={() => onSelectCase(c.id)}
                className="p-4 space-y-3 cursor-pointer active:bg-[var(--bg-surface-hover)] transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-[var(--text-primary)] uppercase text-xs">
                      {c.case_number}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] mt-0.5 line-clamp-2">
                      {c.description || t.cc_no_description}
                    </div>
                  </div>
                  <span className="sk-chip px-2 py-0.5 shrink-0" style={getStatusStyle(c.status)}>
                    {STATUS_LABEL[c.status] || c.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-[var(--text-secondary)]">
                  <div>
                    <span className="text-[var(--text-muted)]">{t.cc_district}: </span>
                    {c.location?.district || '—'}
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">{t.cc_occurred_at}: </span>
                    {formatCaseDate(c.occurred_at)}
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">{t.cc_category}: </span>
                    {c.category?.name || '—'}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="sk-chip px-1.5 py-0.5 text-[9px]" style={getPriorityStyle(c.priority)}>
                      {PRIORITY_LABEL[c.priority] || c.priority}
                    </span>
                    {needsAttention(c) && (
                      <span className="flex items-center gap-1 text-[9px] text-[var(--accent-coral-light)]">
                        <span className="w-1 h-1 rounded-full bg-[var(--accent-coral)] animate-pulse" />
                        {daysSince(c.reported_at)}d
                      </span>
                    )}
                  </div>
                </div>

                {c.progress == null ? (
                  <div className="text-[9px] text-[var(--text-muted)] uppercase">
                    {t.cc_progress}: —
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden border border-[var(--border-primary)]">
                      <div
                        className="h-full bg-gradient-to-r from-[#1E6FD9] to-[#0E9E78]"
                        style={{ width: `${c.progress}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-[var(--text-primary)] shrink-0">
                      {c.progress}%
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); onSelectCase(c.id); }}
                    title={t.cc_view}
                    className="p-1.5 hover:bg-[#1E6FD9]/15 border border-border-color rounded text-[var(--text-secondary)] hover:text-[#1E6FD9] transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab: 'ai_chat', targetId: c.id } }));
                    }}
                    title="Ask SAKSHA AI about this case"
                    className="p-1.5 hover:bg-[#8B5CF6]/15 border border-border-color rounded text-[var(--text-secondary)] hover:text-[#8B5CF6] transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                  {canWrite && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onEditCase(c.id); }}
                      title={t.cc_edit}
                      className="p-1.5 hover:bg-[#0E9E78]/15 border border-border-color rounded text-[var(--text-secondary)] hover:text-[#0E9E78] transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteClick(c); }}
                      title={t.cc_purge}
                      className="p-1.5 hover:bg-[#C94A2A]/15 border border-border-color rounded text-[var(--text-secondary)] hover:text-[#C94A2A] transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {pendingDelete && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !deleting && setPendingDelete(null)}
          />
          <div className="relative w-full max-w-md rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-950/30 border border-red-900/40 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-[#C94A2A]" />
                </div>
                <span className="text-[14px] font-bold text-[var(--text-primary)]">
                  Confirm Deletion
                </span>
              </div>
              <button
                onClick={() => !deleting && setPendingDelete(null)}
                className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
                Are you sure you want to delete this crime case?
              </p>
              <div className="p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] space-y-1">
                <div className="flex justify-between">
                  <span className="text-[11px] text-[var(--text-muted)]">Case Number</span>
                  <span className="text-[12px] font-mono font-bold text-[var(--text-primary)]">{pendingDelete.case_number}</span>
                </div>
                {pendingDelete.status && (
                  <div className="flex justify-between">
                    <span className="text-[11px] text-[var(--text-muted)]">Status</span>
                    <span className="text-[12px] font-mono text-[var(--text-primary)]">{pendingDelete.status}</span>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-[var(--accent-coral)] flex items-start gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                This will permanently remove the case and all linked FIRs, evidence, notes, and associations. This action cannot be undone.
              </p>
              {deleteError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-950/20 border border-red-900/30">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-[12px] text-red-400">{deleteError}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--border-primary)]">
              <button
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-secondary)] text-[12px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-[#C94A2A] hover:bg-[#B43D22] text-white text-[12px] font-semibold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Case
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrimeCasesList;
