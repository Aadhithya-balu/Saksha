import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  User,
  Briefcase,
  FileText,
  MapPin,
  Landmark,
  Brain,
  Sparkles,
  Users,
  Clock,
  X,
  Camera,
  Shield,
  ShieldAlert,
  ChevronRight,
  Radio,
  Fingerprint,
  Bookmark,
  RefreshCw,
  Mic,
  TrendingUp,
  AlertTriangle,
  LayoutDashboard,
} from 'lucide-react';
import {
  searchInvestigation,
  interpretInvestigationQuery,
  searchInvestigationImage,
  getRecentNotifications,
  getNotificationDashboard,
  getRecentIncidents,
  type InvestigationGroupedSearchResponse,
  type InvestigationSearchItem,
  type InvestigationInterpretation,
  type InvestigationImageSearchResponse,
  type NotificationRecord,
  type RecentIncident,
} from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useInvestigationPersistence } from '../hooks/useInvestigationPersistence';
import { PageHeader } from '../components/ui/PageHeader';
import { PersonAvatar } from '../components/ui/PersonAvatar';
import { CardSkeleton } from '../components/ui/Skeleton';
import KarnatakaMap from '../components/map/KarnatakaMap';

const GROUPS: { key: keyof Pick<InvestigationGroupedSearchResponse, 'persons' | 'victims' | 'cases' | 'firs' | 'stations' | 'locations' | 'mo_matches'>; label: string; icon: React.ReactNode }[] = [
  { key: 'persons', label: 'PERSONS', icon: <Users className="w-3.5 h-3.5" /> },
  { key: 'victims', label: 'VICTIMS / WITNESSES', icon: <Shield className="w-3.5 h-3.5" /> },
  { key: 'cases', label: 'CASES', icon: <Briefcase className="w-3.5 h-3.5" /> },
  { key: 'firs', label: 'FIRs', icon: <FileText className="w-3.5 h-3.5" /> },
  { key: 'stations', label: 'POLICE STATIONS', icon: <Landmark className="w-3.5 h-3.5" /> },
  { key: 'locations', label: 'LOCATIONS', icon: <MapPin className="w-3.5 h-3.5" /> },
  { key: 'mo_matches', label: 'MO MATCHES', icon: <Brain className="w-3.5 h-3.5" /> },
];

const ACCENT: Record<string, string> = {
  person: '#1E6FD9', victim: '#22c55e', case: '#7c5cff', fir: '#14b8a6', station: '#f59e0b',
  location: '#22c55e', mo: '#a855f7',
};

type View = 'home' | 'search' | 'profile';

function navigate(tab: string, targetId?: string) {
  window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab, targetId } }));
}

const goTo = (path: string, targetId?: string) => {
  navigate(path, targetId);
};

const isUuid = (v?: string | null): v is string =>
  !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export const CommandCenter: React.FC = () => {
  const { user } = useAuthStore();
  const { recent, saved, trackRecent, removeRecent, clearRecent, isSaved, toggleSaved } =
    useInvestigationPersistence();

  const [view, setView] = useState<View>('home');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState<InvestigationGroupedSearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const [alerts, setAlerts] = useState<NotificationRecord[]>([]);
  const [notifDash, setNotifDash] = useState<{ critical: number; unread: number }>({ critical: 0, unread: 0 });
  const [incidents, setIncidents] = useState<RecentIncident[]>([]);
  const [loadingHome, setLoadingHome] = useState(true);
  const [homeError, setHomeError] = useState<string | null>(null);

  const [nlOpen, setNlOpen] = useState(false);
  const [nlQuery, setNlQuery] = useState('');
  const [interp, setInterp] = useState<InvestigationInterpretation | null>(null);
  const [nlLoading, setNlLoading] = useState(false);
  const [nlError, setNlError] = useState<string | null>(null);

  const [imageState, setImageState] = useState<InvestigationImageSearchResponse | null>(null);
  const [imageOpen, setImageOpen] = useState(false);

  const [voiceSupport] = useState(() => typeof window !== 'undefined' && 'webkitSpeechRecognition' in window);
  const recRef = useRef<any>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!debounced) { setResults(null); setView('home'); return; }
    runSearch(debounced);
  }, [debounced, retryKey]);

  // Load home data
  useEffect(() => {
    let mounted = true;
    setLoadingHome(true);
    setHomeError(null);
    Promise.allSettled([
      getRecentNotifications(6),
      getNotificationDashboard(),
      getRecentIncidents(),
    ]).then(([n, d, i]) => {
      if (!mounted) return;
      if (n.status === 'fulfilled') setAlerts(n.value);
      if (d.status === 'fulfilled') setNotifDash({ critical: d.value.critical_alerts, unread: d.value.unread_count });
      if (i.status === 'fulfilled') setIncidents(i.value);
      if (n.status === 'rejected' || i.status === 'rejected') setHomeError('Some command data is temporarily unavailable.');
      setLoadingHome(false);
    });
    return () => { mounted = false; };
  }, [retryKey]);

  const runSearch = async (term: string) => {
    setSearching(true);
    setSearchError(null);
    try {
      const res = await searchInvestigation(term, 15);
      setResults(res);
      setView('search');
      if (res.total > 0) {
        trackRecent({ type: 'search', id: term, label: term, detail: `${res.total} result(s)`, ts: Date.now() });
      }
    } catch (err: any) {
      setSearchError(err?.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const submitNL = async () => {
    if (!nlQuery.trim()) return;
    setNlLoading(true);
    setNlError(null);
    setInterp(null);
    try {
      const i = await interpretInvestigationQuery(nlQuery.trim());
      setInterp(i);
      if (i.confidence === 'low') { setNlOpen(true); return; }
      setNlOpen(false);
      setQuery(i.search_term);
    } catch (err: any) {
      setNlError(err?.message || 'Could not interpret query');
    } finally {
      setNlLoading(false);
    }
  };

  const triggerImage = async () => {
    setImageOpen(true);
    try { setImageState(await searchInvestigationImage()); }
    catch { setImageState({ status: 'unavailable', message: 'Image matching service is unavailable.', safe_fallback: 'Search by name, FIR, case, station or other identifier.', upload_required: true, matches: [], capability: 'none' }); }
  };

  const startVoice = () => {
    if (!voiceSupport) return;
    const SR = (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = 'kn-IN';
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      setQuery(text);
    };
    rec.onerror = () => {};
    recRef.current = rec;
    rec.start();
  };

  const openItem = (item: InvestigationSearchItem) => {
    if (item.type === 'person') {
      const id = item.meta?.criminal_id || item.id.replace('criminal-', '');
      trackRecent({ type: 'person', id, label: item.name, detail: item.subtitle || undefined, ts: Date.now() });
      goTo('criminals', id);
    } else if (item.type === 'victim') {
      const id = item.meta?.victim_id || item.id.replace('victim-', '');
      trackRecent({ type: 'search', id, label: item.name, detail: item.subtitle, ts: Date.now() });
      goTo('victims', id);
    } else if (item.type === 'case') {
      const id = item.meta?.case_id || item.id.replace('case-', '');
      trackRecent({ type: 'case', id, label: item.name, detail: item.subtitle || undefined, ts: Date.now() });
      goTo('crime_cases', id);
    } else if (item.type === 'fir') {
      const id = item.meta?.case_id;
      trackRecent({ type: 'fir', id: item.id, label: item.name, detail: item.subtitle, ts: Date.now() });
      if (id) goTo('crime_cases', id); else goTo('fir');
    } else if (item.type === 'mo') {
      trackRecent({ type: 'mo', id: item.id, label: item.name, detail: `MO · ${item.status}`, ts: Date.now() });
      const docId = String(item.meta?.doc_id || item.id || '').replace(/^(criminal|crime_case|fir)-/, '');
      if (item.status === 'criminal' && docId) goTo('criminals', docId);
      else if (item.status === 'crime_case' && docId) goTo('crime_cases', docId);
      else goTo('criminals');
    } else if (item.type === 'location' || item.type === 'station') {
      setQuery(item.meta?.district || item.name.split(',')[0]);
    }
  };

  const savedLabel = (item: InvestigationSearchItem) => ({
    type: (item.type === 'person' ? 'person' : item.type === 'case' ? 'case' : item.type === 'fir' ? 'fir' : item.type === 'mo' ? 'mo' : 'search') as 'person' | 'case' | 'fir' | 'mo' | 'search',
    id: (item.type === 'person' ? item.meta?.criminal_id : item.meta?.case_id) || item.id,
    label: item.name,
    detail: item.subtitle,
    ts: Date.now(),
  });

  const kpis = useMemo(() => ({
    unread: notifDash.unread,
    critical: notifDash.critical,
  }), [notifDash]);

  const renderProvenanceBadge = (result: InvestigationGroupedSearchResponse | null) => {
    const p = (result?.provenance || '').toUpperCase();
    const tone = p === 'LIVE' ? 'text-[#0E9E78] border-[#0E9E78]/40'
      : p === 'DEMO' ? 'text-amber-400 border-amber-500/40'
      : 'text-[var(--text-muted)] border-[var(--border-primary)]';
    if (!p) return null;
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded border font-mono text-[8px] font-bold uppercase tracking-wide ${tone}`}>
        {p}
      </span>
    );
  };

  const renderSearchBar = (large = false) => (
    <div className="w-full">
      <div className={`relative flex items-center rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]/70 focus-within:border-[#1E6FD9] transition-colors ${large ? 'p-2 shadow-lg shadow-[#1E6FD9]/5' : ''}`}>
        <Search className={`${large ? 'w-5 h-5' : 'w-4 h-4'} text-[var(--text-muted)] mx-3 shrink-0`} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search person, FIR, case, station, MO… ಕನ್ನಡದಲ್ಲೂ ಹುಡುಕಿ"
          className="flex-1 bg-transparent text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] min-w-0 text-sm py-2.5"
        />
        {voiceSupport && (
          <button onClick={startVoice} title="Voice search (Kannada/English)" className="p-1.5 text-[var(--text-muted)] hover:text-[#1E6FD9] cursor-pointer shrink-0" aria-label="Voice search">
            <Mic className="w-4 h-4" />
          </button>
        )}
        {query && (
          <button onClick={() => setQuery('')} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer shrink-0" aria-label="Clear">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={() => setNlOpen(true)}
          className="hidden sm:flex items-center gap-1.5 mx-2 px-2.5 py-1.5 rounded-lg border border-[var(--border-primary)] text-[9px] font-mono uppercase tracking-wider text-[#a855f7] hover:bg-[#a855f7]/10 transition-colors cursor-pointer shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5" /> Ask
        </button>
      </div>
    </div>
  );

  const renderHome = () => (
    <div className="h-full w-full bg-[var(--bg-primary)] overflow-hidden rounded-xl border border-[var(--border-primary)] shadow-inner">
      <KarnatakaMap 
        hotspots={[]}
        crimeCases={incidents as any}
        districtDataOverride={{}}
      />
    </div>
  );
  // Map takes over renderHome

  const renderSearch = () => {
    if (searching) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}</div>;
    if (searchError) return (
      <div className="p-6 text-center border border-dashed border-[var(--border-primary)] rounded-lg">
        <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto mb-2" />
        <p className="text-xs text-[var(--text-secondary)]">Search is temporarily unavailable.</p>
        <div className="flex justify-center gap-2 mt-3">
          <button onClick={() => setRetryKey((k) => k + 1)} className="px-3 py-1.5 rounded border border-[var(--border-primary)] text-[9px] font-mono text-[#1E6FD9] hover:bg-[#1E6FD9]/10 cursor-pointer">Retry</button>
        </div>
      </div>
    );
    if (!results || results.total === 0) return (
      <div className="p-8 text-center border border-dashed border-[var(--border-primary)] rounded-lg">
        <Search className="w-6 h-6 text-[var(--text-muted)] mx-auto mb-2" />
        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">No records found for &ldquo;{query}&rdquo;</p>
        <p className="text-[10px] text-[var(--text-muted)] mt-2">Try another name, FIR, case, station, district or MO description.</p>
        <div className="flex flex-wrap justify-center gap-2 mt-3">
          <button onClick={() => setNlOpen(true)} className="px-3 py-1.5 rounded border border-[var(--border-primary)] text-[9px] font-mono text-[#a855f7] hover:bg-[#a855f7]/10 cursor-pointer">Ask natural-language query</button>
          <button onClick={triggerImage} className="px-3 py-1.5 rounded border border-[var(--border-primary)] text-[9px] font-mono text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] cursor-pointer">Upload image</button>
        </div>
      </div>
    );
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => { setView('home'); setQuery(''); }} className="text-[10px] font-mono uppercase text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer">Back</button>
          <span className="text-[10px] font-mono text-[var(--text-muted)]">{results.total} result(s) for &ldquo;{results.query}&rdquo;</span>
          {renderProvenanceBadge(results)}
        </div>
        {!results.mo_intelligence && (
          <div className="px-3 py-2 rounded border border-amber-500/30 bg-amber-500/5 text-[9px] font-mono text-amber-300">
            MO semantic matches are filtered for your clearance level.
          </div>
        )}
        {GROUPS.map((group) => {
          const items = results[group.key];
          if (items.length === 0) return null;
          return (
            <div key={group.key} className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]/40 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-primary)] bg-[var(--bg-elevated)]/40">
                <span style={{ color: ACCENT[group.key === 'mo_matches' ? 'mo' : group.key === 'persons' ? 'person' : group.key === 'cases' ? 'case' : group.key === 'firs' ? 'fir' : group.key === 'stations' ? 'station' : 'location'] }}>{group.icon}</span>
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[var(--text-primary)]">{group.label}</span>
                <span className="ml-auto text-[8px] font-mono text-[var(--text-muted)]">{items.length}</span>
              </div>
              <div className="divide-y divide-[var(--border-primary)]/50">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--bg-elevated)]/40 transition-colors">
                    {item.type === 'person'
                      ? <PersonAvatar name={item.name} size={34} accentColor={ACCENT.person} />
                      : <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: `${ACCENT[item.type === 'mo_matches' ? 'mo' : item.type]}15`, color: ACCENT[item.type === 'mo_matches' ? 'mo' : item.type] }}>{group.icon}</span>}
                    <button onClick={() => openItem(item)} className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-[var(--text-primary)] truncate">{item.name}</span>
                        {item.status && <span className="px-1.5 py-0.5 rounded text-[7px] font-mono uppercase bg-[var(--bg-elevated)] border border-[var(--border-primary)] text-[var(--text-muted)] shrink-0">{item.status.replace(/_/g, ' ')}</span>}
                      </div>
                      {item.subtitle && <div className="text-[8.5px] font-mono text-[var(--text-muted)] truncate">{item.subtitle}</div>}
                      {item.detail && <div className="text-[9px] text-[var(--text-secondary)] line-clamp-1">{item.detail}</div>}
                    </button>
                    <button
                      onClick={() => toggleSaved(savedLabel(item))}
                      title={isSaved(savedLabel(item)) ? 'Remove from saved' : 'Save investigation'}
                      className={`p-1.5 rounded cursor-pointer shrink-0 ${isSaved(savedLabel(item)) ? 'text-[#f59e0b]' : 'text-[var(--text-muted)] hover:text-[#f59e0b]'}`}
                      aria-label="Save investigation"
                    >
                      <Bookmark className={`w-3.5 h-3.5 ${isSaved(savedLabel(item)) ? 'fill-current' : ''}`} />
                    </button>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-[var(--bg-primary)]">
      {/* Left Panel: Indicators & Search */}
      <div className="w-[320px] lg:w-[380px] shrink-0 border-r border-[var(--border-primary)] bg-[var(--bg-secondary)] flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-[var(--border-primary)] bg-[var(--bg-tertiary)]/50">
          <div className="flex items-center gap-2 mb-4">
            <LayoutDashboard className="w-5 h-5 text-[var(--accent-blue)]" />
            <h1 className="text-sm font-bold uppercase tracking-wide text-[var(--text-primary)]">Command Center</h1>
          </div>
          {renderSearchBar(false)}
        </div>

        {/* Indicators */}
        <div className="p-4 grid grid-cols-2 gap-2">
          <div className="p-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-elevated)]/30">
            <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Active Cases</div>
            <div className="text-xl font-mono font-bold text-[var(--text-primary)] mt-1">1,240</div>
            <div className="text-[9px] text-[var(--accent-green)] mt-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> +12%</div>
          </div>
          <div className="p-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-elevated)]/30">
            <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Critical Alerts</div>
            <div className="text-xl font-mono font-bold text-[var(--accent-coral)] mt-1">{kpis.critical}</div>
            <div className="text-[9px] text-[var(--text-muted)] mt-1 flex items-center gap-1">Last 24h</div>
          </div>
        </div>

        {/* Recent Investigations */}
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-[var(--accent-blue)]" />
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">Recent Targets</h4>
          </div>
          {recent.length === 0 ? (
            <p className="text-[10px] font-mono text-[var(--text-muted)]">No investigations yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--border-primary)]/50">
              {recent.slice(0, 5).map((r) => (
                <li key={`${r.type}-${r.id}`} className="py-2.5 flex items-center gap-2 group">
                  <span style={{ color: ACCENT[r.type] || '#1E6FD9' }} className="p-1.5 rounded-md bg-[var(--bg-elevated)]">
                    {r.type === 'person' ? <User className="w-3.5 h-3.5" /> : r.type === 'case' ? <Briefcase className="w-3.5 h-3.5" /> : r.type === 'fir' ? <FileText className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
                  </span>
                  <button onClick={() => { setQuery(r.label); }} className="flex-1 min-w-0 text-left">
                    <span className="block text-[11px] font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--accent-blue)] transition-colors">{r.label}</span>
                    {r.detail && <span className="block text-[9px] font-mono text-[var(--text-muted)] truncate">{r.detail}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Center Panel: Map or Search Results */}
      <div className="flex-1 relative flex flex-col p-4 overflow-y-auto">
        {homeError && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-lg text-sm bg-red-500/10 border border-red-500/20 text-red-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="text-xs">{homeError}</span>
            <button onClick={() => setRetryKey((k) => k + 1)} className="ml-auto text-[9px] font-mono hover:underline cursor-pointer">Retry</button>
          </div>
        )}
        {view === 'home' ? renderHome() : renderSearch()}
      </div>

      {/* Right Panel: Live Feed */}
      <div className="w-[280px] lg:w-[340px] shrink-0 border-l border-[var(--border-primary)] bg-[var(--bg-secondary)] flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-[var(--border-primary)] sticky top-0 bg-[var(--bg-secondary)] z-10">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-[var(--accent-coral)] animate-pulse" />
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">Live Intelligence Feed</h4>
          </div>
        </div>

        <div className="p-4 space-y-6">
          {/* Important Alerts */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase">Priority Signals</span>
            </div>
            {alerts.length === 0 ? (
              <p className="text-[10px] font-mono text-[var(--text-muted)]">All clear.</p>
            ) : (
              <ul className="space-y-2.5">
                {alerts.slice(0, 4).map((a) => (
                  <li key={a.id} className="relative pl-3 border-l-2 border-[var(--accent-coral)]">
                    <div className="text-[10px] font-semibold text-[var(--text-primary)] leading-tight">{a.title || a.subject}</div>
                    <p className="text-[9px] text-[var(--text-secondary)] mt-1 line-clamp-2">{a.message}</p>
                    {a.related_case_number && (
                      <button onClick={() => goTo('crime_cases', isUuid(a.resource_id) ? a.resource_id : undefined)} className="mt-1.5 text-[8.5px] font-mono text-[var(--accent-blue)] hover:underline">Investigate Case →</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Recent Cases */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase">Emerging Cases</span>
            </div>
            {incidents.length === 0 ? (
              <p className="text-[10px] font-mono text-[var(--text-muted)]">No recent cases.</p>
            ) : (
              <ul className="space-y-2.5">
                {incidents.slice(0, 5).map((inc, idx) => (
                  <li key={idx} className="relative p-2.5 rounded-lg bg-[var(--bg-elevated)]/30 border border-[var(--border-primary)] hover:border-[var(--accent-blue)]/30 transition-colors cursor-pointer" onClick={() => goTo('crime_cases')}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-[var(--text-primary)]">{inc.case_number}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[7px] font-mono uppercase ${inc.priority === 'critical' ? 'bg-red-950/40 text-red-400' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'}`}>{inc.priority}</span>
                    </div>
                    <div className="text-[9px] text-[var(--text-secondary)] mt-1 truncate">{inc.crime_type}</div>
                    <div className="text-[8.5px] font-mono text-[var(--text-muted)] mt-1">{inc.location}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* NL / Kannada modal */}
      {nlOpen && (
        <NlModal
          onClose={() => setNlOpen(false)}
          onSubmit={submitNL}
          loading={nlLoading}
          error={nlError}
          value={nlQuery}
          setValue={setNlQuery}
          interpretation={interp}
        />
      )}

      {/* Image modal */}
      {imageOpen && <ImageModal onClose={() => setImageOpen(false)} state={imageState} />}
    </div>
  );
};

const NlModal: React.FC<{
  onClose: () => void; onSubmit: () => void; loading: boolean; error: string | null;
  value: string; setValue: (v: string) => void; interpretation: InvestigationInterpretation | null;
}> = ({ onClose, onSubmit, loading, error, value, setValue, interpretation }) => {
  const examples = [
    'Find murders in Bengaluru Urban with similar MO',
    'Show previous cases involving this person',
    'ಬೆಂಗಳೂರು ನಗರದಲ್ಲಿ ಇದೇ ರೀತಿಯ ಕೊಲೆ ಪ್ರಕರಣಗಳನ್ನು ತೋರಿಸಿ',
    'Kempegowda Nagar station alli similar cases yavudu?',
  ];
  return (
    <div className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--text-primary)]">Natural-Language / ಕನ್ನಡ Query</span>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <textarea
          value={value}
          onChange={(e) => { setValue(e.target.value); }}
          rows={3}
          placeholder="Describe what you know… English / ಕನ್ನಡ / Mixed"
          className="w-full p-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-xs outline-none focus:border-[#a855f7] placeholder:text-[var(--text-muted)] resize-none"
        />
        {error && <p className="text-[9px] font-mono text-amber-400 mt-1">{error}</p>}
        {interpretation && interpretation.confidence === 'low' && (
          <div className="mt-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
            <p className="text-[9px] font-mono text-amber-300">Could not confidently interpret this query. Please add a name, FIR, case, district, station or crime type.</p>
          </div>
        )}
        {interpretation && interpretation.confidence !== 'low' && interpretation.mo_keywords.length === 0 && !interpretation.case_number && !interpretation.person_name && !interpretation.district && (
          <p className="text-[9px] font-mono text-amber-300 mt-1">No filters extracted yet — refine then search.</p>
        )}
        <div className="mt-3">
          <div className="text-[8.5px] font-mono uppercase text-[var(--text-muted)] mb-1.5">Examples</div>
          <div className="flex flex-col gap-1">
            {examples.map((ex) => (
              <button key={ex} onClick={() => { setValue(ex); }} className="text-left text-[9.5px] font-mono text-[var(--text-secondary)] hover:text-[#a855f7] cursor-pointer px-2 py-1 rounded hover:bg-[#a855f7]/5">{ex}</button>
            ))}
          </div>
        </div>
        <button onClick={onSubmit} disabled={loading || !value.trim()} className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#a855f7] text-[var(--text-primary)] text-xs font-semibold hover:opacity-90 disabled:opacity-40 cursor-pointer">
          {loading ? 'Interpreting…' : 'Interpret & Search'}
        </button>
      </div>
    </div>
  );
};

const ImageModal: React.FC<{ onClose: () => void; state: InvestigationImageSearchResponse | null }> = ({ onClose, state }) => (
  <div className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center">
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
    <div className="relative w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--text-primary)]">Image Investigation</span>
        <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer" aria-label="Close"><X className="w-4 h-4" /></button>
      </div>
      {state ? (
        <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center gap-2 text-amber-300">
            <ShieldAlert className="w-4 h-4" />
            <span className="text-[10px] font-mono font-bold uppercase">{state.status}</span>
          </div>
          <p className="text-[10px] text-[var(--text-secondary)] mt-2 leading-relaxed">{state.message}</p>
          <p className="text-[9px] font-mono text-[var(--text-muted)] mt-2">{state.safe_fallback}</p>
        </div>
      ) : (
        <div className="py-10 text-center">
          <div className="w-10 h-10 mx-auto mb-3 border-2 border-[#1E6FD9] border-t-transparent rounded-full animate-spin" />
          <p className="text-[10px] font-mono text-[var(--text-muted)]">Checking image matching capability…</p>
        </div>
      )}
    </div>
  </div>
);

export default CommandCenter;
