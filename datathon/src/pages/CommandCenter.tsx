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
  X,
  Camera,
  ShieldAlert,
  Shield,
  ChevronRight,
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
import { useRBAC } from '../hooks/useRBAC';
import { useInvestigationPersistence } from '../hooks/useInvestigationPersistence';
import { PageHeader } from '../components/ui/PageHeader';
import { PersonAvatar } from '../components/ui/PersonAvatar';
import { CardSkeleton } from '../components/ui/Skeleton';
import { SectionHeader } from '../components/system/SectionHeader';
import { Metric } from '../components/system/Metric';
import { SignalTag } from '../components/system/SignalTag';

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
  person: 'var(--accent-blue-light)', victim: 'var(--accent-teal)', case: 'var(--accent-purple)', fir: 'var(--accent-cyan)', station: 'var(--accent-amber)',
  location: 'var(--accent-teal)', mo: 'var(--accent-purple)',
};

const ROLE_DESCRIPTOR: Record<string, string> = {
  ADMIN: 'System security & operator control',
  SCRB: 'Crime analytics & intelligence',
  IO: 'Case investigation & field operations',
  SP: 'Policy oversight & command',
  INSPECTOR: 'Investigation oversight & review',
  FORENSIC: 'Evidence & identification',
  VIEWER: 'Read-only intelligence access',
};

const sevChip = (level?: string) => {
  const lv = level || 'info';
  if (lv === 'critical') return 'bg-[var(--accent-coral-subtle)] text-[var(--accent-coral-light)] border border-[var(--accent-coral-subtle)]';
  if (lv === 'high') return 'bg-[var(--accent-amber-subtle)] text-[var(--accent-amber-light)] border border-[var(--accent-amber-subtle)]';
  return 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-primary)]';
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
  const { role, checkPermission } = useRBAC();
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
    if (!p) return null;
    return p === 'LIVE' ? (
      <SignalTag kind="verified" label="LIVE" className="!text-[8px]" />
    ) : p === 'DEMO' ? (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-mono text-[8px] font-bold uppercase tracking-wide border-[var(--accent-amber-subtle)] text-[var(--accent-amber-light)] bg-[var(--accent-amber-subtle)]">
        {p}
      </span>
    ) : (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded border font-mono text-[8px] font-bold uppercase tracking-wide text-[var(--text-muted)] border-[var(--border-primary)]">
        {p}
      </span>
    );
  };

  const renderSearchBar = (large = false) => (
    <div className="w-full">
      <div className={`relative flex items-center rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]/70 focus-within:border-[var(--accent-blue)] transition-colors ${large ? 'p-2 shadow-lg shadow-[var(--accent-blue-subtle)]' : ''}`}>
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
          <button onClick={startVoice} title="Voice search (Kannada/English)" className="p-1.5 text-[var(--text-muted)] hover:text-[var(--accent-blue-light)] cursor-pointer shrink-0" aria-label="Voice search">
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
          className="hidden sm:flex items-center gap-1.5 mx-2 px-2.5 py-1.5 rounded-lg border border-[var(--border-primary)] text-[9px] font-mono uppercase tracking-wider text-[var(--accent-purple-light)] hover:bg-[var(--accent-purple-subtle)] transition-colors cursor-pointer shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5" /> Ask
        </button>
      </div>
    </div>
  );

  const renderHome = () => (
    <div className="space-y-5">
      {/* Hero search */}
      <div className="rounded-2xl border border-[var(--border-primary)] bg-gradient-to-br from-[var(--bg-secondary)]/80 to-[var(--bg-secondary)]/30 p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)]/60 text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
            <Fingerprint className="w-3 h-3 text-[var(--accent-blue-light)]" /> Investigation Command Center
          </span>
          {role && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)]/60 text-[8.5px] font-mono text-[var(--text-secondary)] uppercase tracking-wider">
              <ShieldAlert className="w-3 h-3 text-[var(--accent-amber-light)]" /> {role} clearance
            </span>
          )}
          {renderProvenanceBadge(results)}
        </div>
        <SectionHeader
          eyebrow="OPERATOR CONTEXT"
          eyebrowRight={user ? `${user.badgeId}` : undefined}
          title={`What can we investigate${user ? `, ${user.name.split(' ')[0]}` : ''}?`}
          description={role ? ROLE_DESCRIPTOR[role] || undefined : undefined}
          className="mb-4 !p-0"
        />
        <p className="text-[10px] sm:text-xs font-mono text-[var(--text-muted)] mb-4">
          One search for person, FIR, case, station, district, location, crime type or MO — in English or Kannada.
        </p>
        {renderSearchBar(true)}
        {/* Quick investigation actions */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-4">
          {[
            { label: 'Search Person', icon: <User className="w-4 h-4" />, a: () => inputRef.current?.focus() },
            { label: 'Search FIR / Case', icon: <FileText className="w-4 h-4" />, a: () => inputRef.current?.focus() },
            { label: 'Upload Image', icon: <Camera className="w-4 h-4" />, a: triggerImage, permitted: checkPermission('/face-recognition') },
            { label: 'Find Similar Cases', icon: <TrendingUp className="w-4 h-4" />, a: () => navigate('investigation'), permitted: checkPermission('/investigation') },
            { label: 'Search MO', icon: <Brain className="w-4 h-4" />, a: () => { setNlOpen(true); } },
            { label: 'Search Location', icon: <MapPin className="w-4 h-4" />, a: () => navigate('hotspot') },
          ].filter((qa) => qa.permitted !== false).map((qa) => (
            <button
              key={qa.label}
              onClick={qa.a}
              className="flex flex-col items-start gap-1.5 p-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)]/50 hover:border-[var(--accent-blue)]/40 hover:bg-[var(--accent-blue-subtle)] transition-all cursor-pointer text-left"
            >
              <span className="text-[var(--accent-blue-light)]">{qa.icon}</span>
              <span className="text-[10px] font-semibold text-[var(--text-primary)]">{qa.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Role-aware command metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Critical Alerts" value={kpis.critical} tone="coral" foot="notification queue" />
        <Metric label="Unread" value={kpis.unread} tone="amber" foot="intelligence center" />
        <Metric label="Saved" value={saved.length} tone="teal" foot="investigations" />
        <Metric label="Recent" value={recent.length} tone="cyan" foot="session lookups" />
      </div>

      {/* Recent investigations + saved */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="sk-card p-4">
          <SectionHeader
            eyebrow="SESSION"
            eyebrowRight={recent.length > 0 ? `${recent.slice(0, 6).length} shown` : undefined}
            title="Recent Investigations"
            actions={recent.length > 0 ? (
              <button onClick={clearRecent} className="text-[9px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">Clear</button>
            ) : undefined}
            className="mb-3"
          />
          {recent.length === 0 ? (
            <p className="text-[10px] font-mono text-[var(--text-muted)]">No investigations yet. Run a search to begin.</p>
          ) : (
            <ul className="divide-y divide-[var(--border-primary)]/50">
              {recent.slice(0, 6).map((r) => (
                <li key={`${r.type}-${r.id}`} className="py-2 flex items-center gap-2">
                  <span style={{ color: ACCENT[r.type] || 'var(--accent-blue-light)' }}>
                    {r.type === 'person' ? <User className="w-3.5 h-3.5" /> : r.type === 'case' ? <Briefcase className="w-3.5 h-3.5" /> : r.type === 'fir' ? <FileText className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
                  </span>
                  <button
                    onClick={() => { setQuery(r.label); }}
                    className="flex-1 min-w-0 text-left"
                  >
                    <span className="block text-[10px] font-semibold text-[var(--text-primary)] truncate">{r.label}</span>
                    {r.detail && <span className="block text-[8.5px] font-mono text-[var(--text-muted)] truncate">{r.detail}</span>}
                  </button>
                  <button onClick={() => removeRecent(r)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer" aria-label="Remove"><X className="w-3 h-3" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="sk-card p-4">
          <SectionHeader
            eyebrow="PINNED"
            eyebrowRight={saved.length > 0 ? `${saved.slice(0, 6).length} shown` : undefined}
            title="Saved Investigations"
            className="mb-3"
          />
          {saved.length === 0 ? (
            <p className="text-[10px] font-mono text-[var(--text-muted)]">Save important investigations to resume them later.</p>
          ) : (
            <ul className="divide-y divide-[var(--border-primary)]/50">
              {saved.slice(0, 6).map((s) => (
                <li key={`${s.type}-${s.id}`} className="py-2 flex items-center gap-2">
                  <span style={{ color: ACCENT[s.type] || 'var(--accent-blue-light)' }}>
                    {s.type === 'person' ? <User className="w-3.5 h-3.5" /> : s.type === 'case' ? <Briefcase className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
                  </span>
                  <button onClick={() => setQuery(s.label)} className="flex-1 min-w-0 text-left">
                    <span className="block text-[10px] font-semibold text-[var(--text-primary)] truncate">{s.label}</span>
                    {s.detail && <span className="block text-[8.5px] font-mono text-[var(--text-muted)] truncate">{s.detail}</span>}
                  </button>
                  <button onClick={() => toggleSaved(s)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer" aria-label="Remove saved"><Bookmark className="w-3 h-3 fill-current" /></button>
                </li>
              ))}
            </ul>
          )}
          {kpis.unread > 0 && (
            <div className="mt-3 pt-3 border-t border-[var(--border-primary)] flex items-center gap-2 text-[9px] font-mono text-[var(--text-muted)]">
              <span>{kpis.unread} unread · {kpis.critical} critical</span>
            </div>
          )}
        </div>
      </div>

      {/* Important alerts + recent cases */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Important alerts — actionable */}
        <div className="sk-card p-4">
          <SectionHeader
            eyebrow="SIGNALS"
            eyebrowRight={alerts.length > 0 ? `${Math.min(alerts.length, 4)} latest` : undefined}
            title="Important Alerts"
            actions={
              <button onClick={() => navigate('notifications')} className="text-[9px] font-mono text-[var(--accent-blue-light)] hover:underline cursor-pointer">View all</button>
            }
            className="mb-3"
          />
          {loadingHome ? <CardSkeleton /> : alerts.length === 0 ? (
            <p className="text-[10px] font-mono text-[var(--text-muted)]">No recent alerts.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-2">
              {alerts.slice(0, 4).map((a) => (
                <li key={a.id} className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-elevated)]/30 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${sevChip(a.severity)}`}>
                      {a.severity || 'info'}
                    </span>
                    <span className="text-[10px] font-semibold text-[var(--text-primary)] truncate">{a.title || a.subject}</span>
                  </div>
                  <p className="text-[9px] text-[var(--text-secondary)] line-clamp-1 mt-1">{a.message}</p>
                  {a.related_case_number && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <button onClick={() => goTo('crime_cases', isUuid(a.resource_id) ? a.resource_id : undefined)} className="px-2 py-1 rounded border border-[var(--border-primary)] text-[8px] font-mono text-[var(--accent-blue-light)] hover:bg-[var(--accent-blue-subtle)] cursor-pointer">Investigate</button>
                      <button onClick={() => goTo('crime_cases', isUuid(a.resource_id) ? a.resource_id : undefined)} className="px-2 py-1 rounded border border-[var(--border-primary)] text-[8px] font-mono text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] cursor-pointer">View Cases</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent cases */}
        <div className="sk-card p-4">
          <SectionHeader
            eyebrow="LIVE"
            eyebrowRight={incidents.length > 0 ? `${Math.min(incidents.length, 5)} recent` : undefined}
            title="Recent Cases"
            actions={
              <button onClick={() => navigate('crime_cases')} className="text-[9px] font-mono text-[var(--accent-blue-light)] hover:underline cursor-pointer">View all</button>
            }
            className="mb-3"
          />
          {loadingHome ? <CardSkeleton /> : incidents.length === 0 ? (
            <p className="text-[10px] font-mono text-[var(--text-muted)]">No recent cases.</p>
          ) : (
            <ul className="divide-y divide-[var(--border-primary)]/50">
              {incidents.slice(0, 5).map((inc, idx) => (
                <li key={idx} className="py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-[var(--accent-blue-light)] truncate">{inc.case_number}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[7.5px] font-mono uppercase ${inc.priority ? sevChip(inc.priority) : ''}`}>{inc.priority ?? '—'}</span>
                  </div>
                  <div className="text-[9px] text-[var(--text-secondary)] mt-0.5 truncate">{inc.crime_type} · {inc.location}</div>
                  <div className="text-[8px] font-mono text-[var(--text-muted)] mt-0.5 flex items-center gap-2">
                    <span>{inc.time ? new Date(inc.time).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</span>
                    <button onClick={() => goTo('crime_cases')} className="ml-auto inline-flex items-center gap-0.5 text-[var(--accent-blue-light)] hover:underline cursor-pointer">Investigate <ChevronRight className="w-2.5 h-2.5" /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );

  const renderSearch = () => {
    if (searching) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}</div>;
    if (searchError) return (
      <div className="p-6 text-center border border-dashed border-[var(--border-primary)] rounded-lg">
        <AlertTriangle className="w-6 h-6 text-[var(--accent-amber-light)] mx-auto mb-2" />
        <p className="text-xs text-[var(--text-secondary)]">Search is temporarily unavailable.</p>
        <div className="flex justify-center gap-2 mt-3">
          <button onClick={() => setRetryKey((k) => k + 1)} className="px-3 py-1.5 rounded border border-[var(--border-primary)] text-[9px] font-mono text-[var(--accent-blue-light)] hover:bg-[var(--accent-blue-subtle)] cursor-pointer">Retry</button>
        </div>
      </div>
    );
    if (!results || results.total === 0) return (
      <div className="p-8 text-center border border-dashed border-[var(--border-primary)] rounded-lg">
        <Search className="w-6 h-6 text-[var(--text-muted)] mx-auto mb-2" />
        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">No records found for &ldquo;{query}&rdquo;</p>
        <p className="text-[10px] text-[var(--text-muted)] mt-2">Try another name, FIR, case, station, district or MO description.</p>
        <div className="flex flex-wrap justify-center gap-2 mt-3">
          <button onClick={() => setNlOpen(true)} className="px-3 py-1.5 rounded border border-[var(--border-primary)] text-[9px] font-mono text-[var(--accent-purple-light)] hover:bg-[var(--accent-purple-subtle)] cursor-pointer">Ask natural-language query</button>
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
          <div className="px-3 py-2 rounded border border-[var(--accent-amber-subtle)] bg-[var(--accent-amber-subtle)] text-[9px] font-mono text-[var(--accent-amber-light)]">
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
                      className={`p-1.5 rounded cursor-pointer shrink-0 ${isSaved(savedLabel(item)) ? 'text-[var(--accent-amber-light)]' : 'text-[var(--text-muted)] hover:text-[var(--accent-amber-light)]'}`}
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
    <div className="flex flex-col gap-5 pb-8">
      <PageHeader
        title="Command Center"
        subtitle="Investigation-first dashboard · Karnataka State Police"
        icon={<LayoutDashboard className="w-5 h-5" />}
        actions={
          <button onClick={() => setRetryKey((k) => k + 1)} className="sk-btn sk-btn-secondary sk-btn-icon" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loadingHome ? 'animate-spin' : ''}`} />
          </button>
        }
      />

      {homeError && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--tone-warning-bg)', border: '1px solid var(--tone-warning-border)', color: 'var(--tone-warning-text)' }}>
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="text-xs">{homeError}</span>
          <button onClick={() => setRetryKey((k) => k + 1)} className="ml-auto text-[9px] font-mono text-[var(--accent-blue-light)] hover:underline cursor-pointer">Retry</button>
        </div>
      )}

      {view !== 'home' && <div className="mb-1">{renderSearchBar(false)}</div>}
      {view === 'home' ? renderHome() : renderSearch()}

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
          className="w-full p-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-xs outline-none focus:border-[var(--accent-purple)] placeholder:text-[var(--text-muted)] resize-none"
        />
        {error && <p className="text-[9px] font-mono text-[var(--accent-amber-light)] mt-1">{error}</p>}
        {interpretation && interpretation.confidence === 'low' && (
          <div className="mt-3 p-3 rounded-lg border border-[var(--accent-amber-subtle)] bg-[var(--accent-amber-subtle)]">
            <p className="text-[9px] font-mono text-[var(--accent-amber-light)]">Could not confidently interpret this query. Please add a name, FIR, case, district, station or crime type.</p>
            <SignalTag kind="review" label="Low confidence" />
          </div>
        )}
        {interpretation && interpretation.confidence !== 'low' && interpretation.mo_keywords.length === 0 && !interpretation.case_number && !interpretation.person_name && !interpretation.district && (
          <p className="text-[9px] font-mono text-[var(--accent-amber-light)] mt-1">No filters extracted yet — refine then search.</p>
        )}
        <div className="mt-3">
          <div className="text-[8.5px] font-mono uppercase text-[var(--text-muted)] mb-1.5">Examples</div>
          <div className="flex flex-col gap-1">
            {examples.map((ex) => (
              <button key={ex} onClick={() => { setValue(ex); }} className="text-left text-[9.5px] font-mono text-[var(--text-secondary)] hover:text-[var(--accent-purple-light)] cursor-pointer px-2 py-1 rounded hover:bg-[var(--accent-purple-subtle)]">{ex}</button>
            ))}
          </div>
        </div>
        <button onClick={onSubmit} disabled={loading || !value.trim()} className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent-purple)] text-[var(--text-primary)] text-xs font-semibold hover:opacity-90 disabled:opacity-40 cursor-pointer">
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
        <div className="p-3 rounded-lg border border-[var(--accent-amber-subtle)] bg-[var(--accent-amber-subtle)]">
          <div className="flex items-center gap-2 text-[var(--accent-amber-light)]">
            <ShieldAlert className="w-4 h-4" />
            <span className="text-[10px] font-mono font-bold uppercase">{state.status}</span>
          </div>
          <p className="text-[10px] text-[var(--text-secondary)] mt-2 leading-relaxed">{state.message}</p>
          <p className="text-[9px] font-mono text-[var(--text-muted)] mt-2">{state.safe_fallback}</p>
        </div>
      ) : (
        <div className="py-10 text-center">
          <div className="w-10 h-10 mx-auto mb-3 border-2 border-[var(--accent-blue-light)] border-t-transparent rounded-full animate-spin" />
          <p className="text-[10px] font-mono text-[var(--text-muted)]">Checking image matching capability…</p>
        </div>
      )}
    </div>
  </div>
);

export default CommandCenter;