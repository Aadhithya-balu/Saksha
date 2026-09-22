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
import { Search, Plus, Eye, Edit2, Trash2, ShieldAlert, X, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useRealtimeStore } from '../../store/realtimeStore';

import { useTranslation } from '../../i18n';

interface CrimeCasesListProps {
  onSelectCase: (id: string) => void;
  onCreateCase: () => void;
  onEditCase: (id: string) => void;
  selectedCaseId?: string | null;
}

const CrimeCasesList: React.FC<CrimeCasesListProps> = ({
  onSelectCase,
  onCreateCase,
  onEditCase,
  selectedCaseId
}) => {
  const t = useTranslation();
  const user = useAuthStore((state) => state.user);
  const canWrite = user?.role === 'ADMIN' || user?.role === 'IO' || user?.role === 'SCRB';
  const canDelete = user?.role === 'ADMIN';
  const [cases, setCases] = useState<CrimeCaseDetailRecord[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
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
        district: districtFilter || undefined,
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
        district: districtFilter || undefined,
        priority: priorityFilter || undefined,
      });
      setCases(response.results);
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
      .catch(() => {});
    getLocationsList()
      .then((locations) =>
        setDistricts(Array.from(new Set(locations.map((loc) => loc.district))).sort()),
      )
      .catch(() => {});
  }, []);

  // Background polling: silently refresh cases and insights every 30s
  usePolling(async () => {
    try {
      const response = await getCrimeCases(search || undefined, statusFilter || undefined, 1, 20, {
        category_id: categoryFilter || undefined,
        district: districtFilter || undefined,
        priority: priorityFilter || undefined,
      });
      setCases(response.results);
      setError(null);
    } catch { /* silent */ }
    try {
      const result = await getCrimeCaseInsights({
        status: statusFilter || undefined,
        category_id: categoryFilter || undefined,
        district: districtFilter || undefined,
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
          description: `Newly registered ${liveCase.crime_type} case at ${liveCase.location}`,
          mo_tags: null,
          status: liveCase.status,
          priority: liveCase.priority,
          progress: 0,
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

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/30';
      case 'assigned':
        return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30';
      case 'investigating':
        return 'bg-purple-500/10 text-purple-400 border border-purple-500/30';
      case 'evidence collected':
        return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30';
      case 'charge sheet filed':
        return 'bg-orange-500/10 text-orange-400 border border-orange-500/30';
      case 'closed':
        return 'bg-[#0E9E78]/10 text-[#0E9E78] border border-[#0E9E78]/30';
      default:
        return 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border border-[var(--border-secondary)]/30';
    }
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'low':
        return 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border border-[var(--border-secondary)]/20';
      case 'medium':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'high':
        return 'bg-orange-500/10 text-orange-400 border border-orange-500/30';
      case 'critical':
        return 'bg-[#C94A2A]/15 text-[#C94A2A] border border-[#C94A2A]/40 font-bold';
      default:
        return 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border border-[var(--border-secondary)]/20';
    }
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
    <div className="flex flex-col h-full bg-[var(--bg-secondary)] border-r border-[var(--border-primary)] relative z-10">
      {/* Header & Create */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border-primary)] shrink-0 bg-[var(--bg-secondary)] sticky top-0 z-20">
        <div>
          <h2 className="text-xs uppercase tracking-widest font-bold text-[var(--text-primary)]">Investigations</h2>
          <p className="text-[9px] font-mono text-[var(--text-muted)] mt-0.5">{cases.length} active cases</p>
        </div>
        {canWrite && (
          <button
            onClick={onCreateCase}
            className="flex items-center gap-1.5 px-2 py-1.5 bg-[#1E6FD9]/10 hover:bg-[#1E6FD9]/20 border border-[#1E6FD9]/30 transition-colors rounded text-[9px] text-[#1E6FD9] cursor-pointer uppercase font-bold tracking-wider"
          >
            <Plus className="w-3.5 h-3.5" /> New
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 border-b border-[var(--border-primary)] shrink-0 bg-[var(--bg-tertiary)]/50 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="SEARCH INVESTIGATIONS..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border-primary)] rounded font-mono text-[10px] text-[var(--text-primary)] uppercase placeholder-[var(--text-muted)] focus:border-[#1E6FD9]/60 focus:outline-none transition-colors"
          />
        </div>
        
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 px-2 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border-primary)] rounded font-mono text-[9px] text-[var(--text-primary)] uppercase focus:border-[#1E6FD9]/60 focus:outline-none cursor-pointer"
          >
            <option value="">ALL STATUS</option>
            <option value="open">OPEN</option>
            <option value="assigned">ASSIGNED</option>
            <option value="investigating">INVESTIGATING</option>
            <option value="evidence collected">EVIDENCE</option>
            <option value="charge sheet filed">CHARGE SHEET</option>
            <option value="closed">CLOSED</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="flex-1 px-2 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border-primary)] rounded font-mono text-[9px] text-[var(--text-primary)] uppercase focus:border-[#1E6FD9]/60 focus:outline-none cursor-pointer"
          >
            <option value="">ALL PRIORITY</option>
            <option value="low">LOW</option>
            <option value="medium">MEDIUM</option>
            <option value="high">HIGH</option>
            <option value="critical">CRITICAL</option>
          </select>
        </div>

        {(search || statusFilter || categoryFilter || districtFilter || priorityFilter) && (
          <button
            onClick={() => {
              setSearch('');
              setStatusFilter('');
              setCategoryFilter('');
              setDistrictFilter('');
              setPriorityFilter('');
            }}
            className="w-full py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded font-mono text-[9px] text-[var(--text-muted)] hover:text-[#1E6FD9] hover:border-[#1E6FD9]/60 transition-colors uppercase cursor-pointer tracking-wider"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Main List View */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 rounded-full border-2 border-[#1E6FD9] border-t-transparent animate-spin" />
          </div>
        ) : error ? (
          <div className="p-3 border border-[#C94A2A]/20 bg-[#C94A2A]/5 text-[#C94A2A] rounded-lg text-[10px] flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : cases.length === 0 ? (
          <div className="p-6 border border-dashed border-[var(--border-primary)] rounded-lg text-center text-[10px] font-mono text-[var(--text-muted)] uppercase">
            No active investigations
          </div>
        ) : (
          cases.map((c) => (
            <div
              key={c.id}
              onClick={() => onSelectCase(c.id)}
              className={`p-3 rounded-xl border transition-all cursor-pointer relative group flex flex-col gap-2 ${
                selectedCaseId === c.id
                  ? 'bg-[#1E6FD9]/10 border-[#1E6FD9]/50 shadow-[0_0_15px_rgba(30,111,217,0.1)]'
                  : 'bg-[var(--bg-elevated)]/30 border-[var(--border-primary)] hover:border-[#1E6FD9]/30 hover:bg-[var(--bg-elevated)]/70'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className={`font-bold text-[11px] uppercase truncate transition-colors ${selectedCaseId === c.id ? 'text-[#1E6FD9]' : 'text-[var(--text-primary)] group-hover:text-[#1E6FD9]'}`}>
                    {c.case_number}
                  </div>
                  <div className="text-[9px] text-[var(--text-secondary)] mt-0.5 line-clamp-1">
                    {c.description || 'No description available'}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase font-bold tracking-wider ${getPriorityStyle(c.priority)}`}>
                    {c.priority}
                  </span>
                  <span className="text-[8px] font-mono text-[var(--text-muted)]">
                    {formatCaseDate(c.occurred_at).split(',')[0]}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 mt-1">
                <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider font-semibold border ${getStatusStyle(c.status)}`}>
                  {c.status}
                </span>
                
                <div className="flex items-center gap-1.5 flex-1 max-w-[100px]">
                  <div className="flex-1 h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden border border-[var(--border-primary)]">
                    <div
                      className="h-full bg-gradient-to-r from-[#1E6FD9] to-[#0E9E78] transition-all duration-500"
                      style={{ width: `${c.progress}%` }}
                    />
                  </div>
                  <span className="text-[8px] font-mono text-[var(--text-primary)] w-6 text-right">
                    {c.progress}%
                  </span>
                </div>
              </div>
              
              {canDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClick(c);
                  }}
                  className="absolute top-2.5 right-2.5 p-1 rounded-md text-[var(--text-muted)] hover:text-[#C94A2A] hover:bg-[#C94A2A]/10 opacity-0 group-hover:opacity-100 transition-all"
                  title="Purge Case"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

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
