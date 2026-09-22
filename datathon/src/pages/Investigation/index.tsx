import React, { useEffect, useState } from 'react';
import { Search, ArrowLeft, Layers, Activity, Users, Shield, Briefcase, FileText, Brain, MapPin } from 'lucide-react';
import { getInvestigation, getCrimeCases, searchInvestigation } from '../../services/api';
import type {
  InvestigationData,
  CrimeCaseDetailRecord,
  InvestigationGroupedSearchResponse,
  InvestigationSearchItem,
} from '../../services/api';
import PageHeader from '../../components/ui/PageHeader';
import { useUserScope } from '../../hooks/useUserScope';
import { CaseHeader } from '../../components/investigation/workspace/CaseHeader';
import { CaseOverviewTab } from '../../components/investigation/workspace/CaseOverviewTab';
import { CaseTimelineTab } from '../../components/investigation/workspace/CaseTimelineTab';
import { CaseEntitiesTab } from '../../components/investigation/workspace/CaseEntitiesTab';
import { CaseEvidenceTab } from '../../components/investigation/workspace/CaseEvidenceTab';
import { CaseForensicsTab } from '../../components/investigation/workspace/CaseForensicsTab';
import { CaseGraphTab } from '../../components/investigation/workspace/CaseGraphTab';
import AIRecommendations from '../../components/investigation/AIRecommendations';
import AIChatPanel from '../../components/investigation/AIChatPanel';
import { MOPatternExplorer } from '../../components/investigation/MOPatternExplorer';
import { CardSkeleton } from '../../components/ui/Skeleton';

type ViewState = 'list' | 'detail';

const SEARCH_GROUPS: { key: keyof Pick<InvestigationGroupedSearchResponse, 'persons' | 'victims' | 'cases' | 'firs' | 'mo_matches'>; label: string; icon: React.ReactNode; tone: string }[] = [
  { key: 'persons', label: 'Criminals / Suspects', icon: <Users className="w-3.5 h-3.5" />, tone: '#1E6FD9' },
  { key: 'victims', label: 'Victims / Witnesses', icon: <Shield className="w-3.5 h-3.5" />, tone: '#22c55e' },
  { key: 'cases', label: 'Cases', icon: <Briefcase className="w-3.5 h-3.5" />, tone: '#7c5cff' },
  { key: 'firs', label: 'FIRs', icon: <FileText className="w-3.5 h-3.5" />, tone: '#14b8a6' },
  { key: 'mo_matches', label: 'MO Matches', icon: <Brain className="w-3.5 h-3.5" />, tone: '#a855f7' },
];

const navigateTo = (tab: string, targetId?: string) => {
  window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab, targetId } }));
};

const isUuidish = (v?: string | null): v is string =>
  !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  assigned: 'Assigned',
  investigating: 'Under investigation',
  'evidence collected': 'Evidence collected',
  'charge sheet filed': 'Charge sheet filed',
  closed: 'Closed',
};

const PRIORITY_LABEL: Record<string, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const PRIORITY_TONE: Record<string, { color: string; background: string }> = {
  critical: { color: 'var(--accent-coral-light)', background: 'var(--accent-coral-subtle)' },
  high: { color: 'var(--accent-amber-light)', background: 'var(--accent-amber-subtle)' },
  medium: { color: 'var(--accent-purple-light)', background: 'var(--accent-purple-subtle)' },
  low: { color: 'var(--accent-teal-light)', background: 'var(--accent-teal-subtle)' },
};

const NEEDS_ATTENTION_STATUSES = new Set(['open', 'assigned', 'investigating']);

const daysSince = (iso?: string) =>
  iso ? Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 86400000)) : 0;

const needsAttention = (item: CrimeCaseDetailRecord) =>
  NEEDS_ATTENTION_STATUSES.has(item.status) && (item.progress ?? 0) < 40;

const InvestigationPage: React.FC = () => {
  const { district: scopeDistrict, canSelectDistrict, personaDescriptor } = useUserScope();
  const [viewState, setViewState] = useState<ViewState>('list');
  const [cases, setCases] = useState<CrimeCaseDetailRecord[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [investigationData, setInvestigationData] = useState<InvestigationData | null>(null);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fedResults, setFedResults] = useState<InvestigationGroupedSearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Check if returning from Criminals / other tab with a target case ID
  useEffect(() => {
    const redirectId = sessionStorage.getItem('selected_entity_id') || sessionStorage.getItem('return_to_case_id');
    if (redirectId) {
      sessionStorage.removeItem('selected_entity_id');
      loadInvestigation(redirectId);
    }
  }, []);

  // Fetch case list on mount — district-scoped operators always see their own
  // district (backend is the source of truth for the filter).
  const loadCases = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getCrimeCases(
        searchQuery || undefined,
        statusFilter || undefined,
        1,
        50,
        canSelectDistrict ? undefined : { district: scopeDistrict },
      );
      // Attention-first ordering: critical/high first, then case number.
      const sorted = [...(response.results || [])].sort(
        (a, b) =>
          (a.priority === 'critical' ? 0 : a.priority === 'high' ? 1 : a.priority === 'medium' ? 2 : 3) -
            (b.priority === 'critical' ? 0 : b.priority === 'high' ? 1 : b.priority === 'medium' ? 2 : 3) ||
          String(a.case_number).localeCompare(String(b.case_number)),
      );
      setCases(sorted);
    } catch (err: any) {
      setError(err?.message || 'Failed to load cases');
    } finally {
      setLoading(false);
    }
  };

  // Debounce search so we don't fire a query (and hammer the DB pool) per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const term = searchQuery.trim();
      if (term) {
        setSearching(true);
        setFedResults(null);
        setSearchError(null);
        searchInvestigation(term, 15)
          .then((res) => setFedResults(res))
          .catch((err: any) => setSearchError(err?.message || 'Failed to search records'))
          .finally(() => setSearching(false));
      } else {
        setFedResults(null);
        loadCases();
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [searchQuery, statusFilter, scopeDistrict, canSelectDistrict]);

  // Fetch investigation detail
  const loadInvestigation = async (caseId: string) => {
    setLoadingDetail(true);
    setError(null);
    try {
      const data = await getInvestigation(caseId);
      setInvestigationData(data);
      setSelectedCaseId(caseId);
      setViewState('detail');
    } catch (err: any) {
      setError(err?.message || 'Failed to load investigation data');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleBack = () => {
    setViewState('list');
    setInvestigationData(null);
    setSelectedCaseId(null);
  };

  const openFederatedItem = (item: InvestigationSearchItem) => {
    if (item.type === 'case') {
      const caseId = item.meta?.case_id || item.id.replace('case-', '');
      if (isUuidish(caseId)) loadInvestigation(caseId);
    } else if (item.type === 'fir') {
      const caseId = item.meta?.case_id;
      if (isUuidish(caseId)) loadInvestigation(caseId);
      else navigateTo('fir');
    } else if (item.type === 'person') {
      const id = item.meta?.criminal_id || item.id.replace('criminal-', '');
      navigateTo('criminals', id);
    } else if (item.type === 'victim') {
      const id = item.meta?.victim_id || item.id.replace('victim-', '');
      navigateTo('victims', id);
    } else if (item.type === 'mo') {
      const docId = String(item.meta?.doc_id || item.id || '').replace(/^(criminal|crime_case|fir)-/, '');
      if (item.status === 'criminal') navigateTo('criminals', docId);
      else if (item.status === 'crime_case' && isUuidish(docId)) loadInvestigation(docId);
      else if (item.status === 'fir') navigateTo('fir');
    }
  };

  const renderFederatedResults = () => {
    if (searching) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      );
    }
    if (searchError) {
      return (
        <div className="p-10 text-center text-[10px] text-amber-400 uppercase border border-dashed border-amber-500/30 rounded-lg">
          {searchError}
        </div>
      );
    }
    if (!fedResults || fedResults.total === 0) {
      return (
        <div className="p-12 text-center text-[10px] text-[var(--text-muted)] uppercase border border-dashed border-[var(--border-primary)] rounded-lg">
          No records found for &ldquo;{searchQuery.trim()}&rdquo;
          <div className="mt-1 text-[9px] normal-case">Try a person/victim name, FIR, case number or MO description.</div>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {!fedResults.mo_intelligence && (
          <div className="px-3 py-2 rounded border border-amber-500/30 bg-amber-500/5 text-[9px] font-mono text-amber-300">
            MO semantic matches are filtered for your clearance level.
          </div>
        )}
        {SEARCH_GROUPS.map((group) => {
          const items = fedResults[group.key];
          if (!items || items.length === 0) return null;
          return (
            <div key={group.key} className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)]/40 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border-primary)]">
                <span style={{ color: group.tone }}>{group.icon}</span>
                <span className="text-[8.5px] font-mono font-bold uppercase tracking-wider text-[var(--text-primary)]">{group.label}</span>
                <span className="ml-auto text-[8px] font-mono text-[var(--text-muted)]">{items.length}</span>
              </div>
              <div className="divide-y divide-[var(--border-primary)]/50">
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => openFederatedItem(item)}
                    className="w-full text-left px-3 py-2 hover:bg-[var(--bg-elevated)]/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-[var(--text-primary)] truncate">{item.name}</span>
                      {item.status && (
                        <span className="px-1.5 py-0.5 rounded text-[7px] font-mono uppercase bg-[var(--bg-elevated)] border border-[var(--border-primary)] text-[var(--text-muted)] shrink-0">
                          {item.status.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                    {item.subtitle && <div className="text-[8.5px] font-mono text-[var(--text-muted)] truncate">{item.subtitle}</div>}
                    {item.detail && <div className="text-[9px] text-[var(--text-secondary)] line-clamp-1">{item.detail}</div>}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── List View ──
  if (viewState === 'list') {
    return (
      <div className="min-h-[84vh] flex flex-col gap-4 p-1 md:p-3 select-none">
        {/* Header */}
        <div className="pb-3 shrink-0 flex flex-col gap-2">
          <PageHeader
            title="Investigation Cases"
            subtitle={
              canSelectDistrict || !personaDescriptor
                ? 'Open a case to see the full dossier — FIRs, people, evidence, timeline and analysis.'
                : `${personaDescriptor} workspace. Open a case to see the full dossier — FIRs, people, evidence, timeline and analysis${scopeDistrict ? ` in ${scopeDistrict}` : ''}.`
            }
            icon={<Layers className="w-5 h-5" />}
            actions={
              scopeDistrict ? (
                <span
                  className="sk-header-chip hidden sm:inline-flex"
                  data-accent="cyan"
                  title="Your operating area — set from your profile"
                >
                  <MapPin className="w-3 h-3" />
                  {scopeDistrict}
                </span>
              ) : undefined
            }
          />
          {error && <p className="text-xs font-medium text-[var(--accent-coral-light)]">{error}</p>}
        </div>

        {/* Filters */}
        <div className="flex gap-3 shrink-0">
          <div className="flex items-center relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search by person, victim, FIR, case number, MO keywords…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="sk-input w-full pl-8 pr-3 py-1.5"
            />
            <Search className="absolute left-2.5 w-3.5 h-3.5 text-[var(--text-muted)] pointer-events-none" />
          </div>
          {!searchQuery.trim() && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="sk-select px-3 py-1.5 cursor-pointer"
            >
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="assigned">Assigned</option>
              <option value="investigating">Under investigation</option>
              <option value="evidence collected">Evidence collected</option>
              <option value="charge sheet filed">Charge sheet filed</option>
              <option value="closed">Closed</option>
            </select>
          )}
        </div>

        {/* Case List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {searchQuery.trim() ? (
            renderFederatedResults()
          ) : loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : cases.length === 0 ? (
            <div className="p-12 text-center text-[10px] text-[var(--text-muted)] uppercase border border-dashed border-[var(--border-primary)] rounded-lg">
              No cases matching your filters
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {cases.map((caseItem) => {
                const isOpening = loadingDetail && selectedCaseId === caseItem.id;
                const attention = needsAttention(caseItem);
                const tone = PRIORITY_TONE[caseItem.priority] || PRIORITY_TONE.medium;
                return (
                  <button
                    key={caseItem.id}
                    onClick={() => loadInvestigation(caseItem.id)}
                    disabled={loadingDetail}
                    className={`sk-card text-left transition-colors cursor-pointer group ${
                      isOpening ? 'ring-2 ring-[var(--accent-blue-subtle)]' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <span className="text-[13px] font-semibold text-[var(--text-primary)] uppercase group-hover:text-[var(--accent-blue)] transition-colors break-all">
                        {caseItem.case_number}
                      </span>
                      <span
                        className="sk-chip px-2 py-0.5 shrink-0"
                        style={{ color: tone.color, background: tone.background }}
                      >
                        {PRIORITY_LABEL[caseItem.priority] || caseItem.priority} priority
                      </span>
                    </div>
                    <p className="text-[12.5px] text-[var(--text-secondary)] line-clamp-2 leading-relaxed mb-3">
                      {caseItem.description || 'No description recorded.'}
                    </p>
                    <div className="flex items-center justify-between text-[10.5px] text-[var(--text-muted)]">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <Activity className="w-3 h-3 shrink-0" />
                        {isOpening ? (
                          <span className="flex items-center gap-1.5 text-[var(--accent-blue-light)]">
                            <span className="w-2.5 h-2.5 rounded-full border border-[var(--accent-blue)] border-t-transparent animate-spin inline-block" />
                            Loading dossier…
                          </span>
                        ) : (
                          <span className="truncate">{STATUS_LABEL[caseItem.status] || caseItem.status.replace(/_/g, ' ')}</span>
                        )}
                      </span>
                      <span className="shrink-0">{caseItem.progress}% documented</span>
                    </div>
                    <div className="mt-2.5 pt-2.5 border-t border-[var(--border-muted)] flex items-center justify-between gap-2 text-[10.5px] text-[var(--text-muted)]">
                      <span className="truncate">
                        {caseItem.assigned_officer?.full_name ? caseItem.assigned_officer.full_name : 'Not yet assigned'}
                      </span>
                      {attention && (
                        <span className="flex items-center gap-1.5 shrink-0 text-[var(--accent-coral-light)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-coral)] animate-pulse" />
                          {daysSince(caseItem.reported_at)} day{daysSince(caseItem.reported_at) === 1 ? '' : 's'} open
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Detail View ──
  if (loadingDetail || !investigationData) {
    return (
      <div className="min-h-[84vh] space-y-6 p-1 md:p-3">
        <button
          onClick={handleBack}
          className="sk-btn sk-btn-ghost shrink-0 uppercase"
        >
          <ArrowLeft className="w-4 h-4" /> All cases
        </button>

        {/* Clear, labeled loading state */}
        <div className="p-6 sk-card flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-10 h-10 rounded-full border-2 border-[var(--accent-blue)] border-t-transparent animate-spin" />
          <div>
            <p className="text-sm uppercase tracking-[0.18em] font-bold text-[var(--text-primary)]">
              Opening investigation dossier
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Pulling together the FIR, people, evidence, timeline and analysis for this case…
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-blue)] animate-pulse" />
            Building your working view
          </div>
        </div>

        <div className="space-y-4">
          <CardSkeleton />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <CardSkeleton />
              <CardSkeleton />
            </div>
            <div className="space-y-4">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { case: caseInfo } = investigationData;

  const tabCounts = {
    timeline: investigationData.timeline?.length || 0,
    entities:
      (investigationData.criminals?.length || 0) +
      (investigationData.vehicles?.length || 0) +
      (investigationData.locations?.length || 0) +
      (investigationData.organizations?.length || 0) +
      (investigationData.digital_accounts?.length || 0),
    evidence: investigationData.evidence?.length || 0,
    forensics: investigationData.forensic_reports_count || 0,
  };

  const handleSelectCriminal = (criminalId: string) => {
    if (selectedCaseId) {
      sessionStorage.setItem('return_to_case_id', selectedCaseId);
      sessionStorage.setItem('return_to_case_number', caseInfo.case_number);
    }
    window.dispatchEvent(
      new CustomEvent('navigate-tab', {
        detail: { tab: 'criminals', targetId: criminalId },
      })
    );
  };

  return (
    <div className="min-h-[84vh] space-y-5 p-1 md:p-3 text-left">
      {/* Back button */}
      <button
        onClick={handleBack}
        className="sk-btn sk-btn-ghost shrink-0 uppercase cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" /> All cases
      </button>

      {/* Primary Case Cockpit Header */}
      <CaseHeader
        caseData={caseInfo}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        tabCounts={tabCounts}
      />

      {/* Tab Panels */}
      {activeTab === 'overview' && (
        <CaseOverviewTab
          data={investigationData}
          onNavigateTab={(tab) => setActiveTab(tab)}
        />
      )}

      {activeTab === 'timeline' && (
        <CaseTimelineTab events={investigationData.timeline || []} />
      )}

      {activeTab === 'entities' && (
        <CaseEntitiesTab
          data={investigationData}
          onSelectCriminal={handleSelectCriminal}
        />
      )}

      {activeTab === 'graph' && (
        <CaseGraphTab
          caseId={selectedCaseId!}
          data={investigationData}
          onNavigateTab={(tab, targetId) => {
            if (tab === 'criminals' && targetId) {
              handleSelectCriminal(targetId);
            } else {
              setActiveTab(tab);
            }
          }}
        />
      )}

      {activeTab === 'evidence' && (
        <CaseEvidenceTab
          evidenceList={investigationData.evidence || []}
          caseNumber={caseInfo.case_number}
        />
      )}

      {activeTab === 'forensics' && (
        <CaseForensicsTab
          caseId={selectedCaseId!}
          caseNumber={caseInfo.case_number}
          evidenceList={investigationData.evidence || []}
        />
      )}

      {activeTab === 'alerts' && (
        <div className="space-y-6">
          <MOPatternExplorer
            currentCaseId={selectedCaseId!}
            currentCaseNumber={caseInfo.case_number}
            onSelectCase={(caseId) => loadInvestigation(caseId)}
            onSelectCriminal={handleSelectCriminal}
          />
        </div>
      )}

      {activeTab === 'assistant' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-[var(--text-primary)]">
              Automated Analytical Recommendations
            </h3>
            <AIRecommendations recommendations={investigationData.ai_recommendations || []} />
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-[var(--text-primary)]">
              Investigation Copilot Chat
            </h3>
            <AIChatPanel caseId={selectedCaseId!} />
          </div>
        </div>
      )}
    </div>
  );
};

export default InvestigationPage;

