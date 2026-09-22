import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Cpu,
  Flame,
  History,
  MapPin,
  Radar,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import {
  deleteIntelligenceHistory,
  getCrimeCategories,
  getEmergingPatterns,
  getIntelligenceHistory,
  runIntelligenceFusion,
  type IntelligenceHistoryItem,
  type UnifiedIntelligenceResult,
} from '../../services/api';
import IntelligencePatternsFeed from '../../components/intelligence/IntelligencePatternsFeed';
import IntelligenceInvestigationDrawer from '../../components/intelligence/IntelligenceInvestigationDrawer';
import { useUserScope } from '../../hooks/useUserScope';

const KARNATAKA_DISTRICTS = [
  'Bengaluru Urban',
  'Bengaluru Rural',
  'Mysuru',
  'Belagavi',
  'Dharwad',
  'Kalaburagi',
  'Vijayapura',
  'Ballari',
  'Bidar',
  'Hassan',
  'Tumkuru',
  'Mandya',
  'Shimoga',
  'Davanagere',
  'Chitradurga',
  'Kodagu',
  'Chikkamagaluru',
  'Haveri',
  'Gadag',
  'Bagalkote',
  'Koppal',
  'Yadagir',
  'Raichur',
  'Kolar',
  'Chikkaballapura',
  'Ramanagara',
  'Chamarajanagar',
  'Vijayanagara',
  'Dakshina Kannada',
  'Udupi',
];

const CATEGORIES_FALLBACK = [
  'Cyber Crime',
  'Theft & Burglaries',
  'Narcotics',
  'Smuggling',
  'Assault',
  'Domestic Violence',
  'Property Disputes',
  'Illegal Mining',
  'Financial',
  'Fraud',
];

type SensitivityKey = 'broad' | 'balanced' | 'strict';

const SENSITIVITY: Record<SensitivityKey, { label: string; hint: string; min_signals: number; min_risk: number; min_confidence: number }> = {
  broad: { label: 'Broad', hint: 'Flag more patterns', min_signals: 1, min_risk: 0.30, min_confidence: 0.40 },
  balanced: { label: 'Balanced', hint: 'Recommended', min_signals: 2, min_risk: 0.40, min_confidence: 0.50 },
  strict: { label: 'Strict', hint: 'Only strong patterns', min_signals: 3, min_risk: 0.60, min_confidence: 0.65 },
};

const TIME_WINDOWS = [7, 14, 30, 60, 90];

const PRIORITY_STYLES: Record<string, string> = {
  CRITICAL: 'text-[#C94A2A] border-[#C94A2A]/40',
  HIGH: 'text-amber-400 border-amber-500/40',
  MEDIUM: 'text-[#D4820A] border-[#D4820A]/40',
  LOW: 'text-[var(--text-muted)] border-[var(--border-primary)]',
};

const ML_MODES = ['ML', 'HYBRID', 'FALLBACK', 'RULE_BASED'];

const StatCard: React.FC<{ label: string; value: string; hint?: string; accent?: string }> = ({ label, value, hint, accent }) => (
  <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)]/40 px-2.5 py-2">
    <span className="block text-[15px] font-mono font-bold leading-tight" style={{ color: accent || 'var(--text-primary)' }}>
      {value}
    </span>
    <span className="block text-[7.5px] font-mono uppercase tracking-wider text-[var(--text-muted)] mt-0.5">
      {label}
      {hint ? <span className="block normal-case tracking-normal text-[6.5px] mt-0.5">{hint}</span> : null}
    </span>
  </div>
);

const IntelligenceFusion: React.FC = () => {
  const { district: scopeDistrict, canSelectDistrict } = useUserScope();
  const [patterns, setPatterns] = useState<UnifiedIntelligenceResult[]>(() => {
    try {
      const saved = sessionStorage.getItem('saksha_fusion_patterns');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      /* ignore */
    }
    return [];
  });

  const [total, setTotal] = useState<number>(() => {
    try {
      const saved = sessionStorage.getItem('saksha_fusion_total');
      if (saved) return Number(saved);
    } catch {
      /* ignore */
    }
    return 0;
  });

  const [loading, setLoading] = useState<boolean>(() => {
    try {
      const saved = sessionStorage.getItem('saksha_fusion_patterns');
      if (saved && JSON.parse(saved).length > 0) return false;
    } catch {
      /* ignore */
    }
    return true;
  });

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(() => {
    return sessionStorage.getItem('saksha_fusion_generated_at');
  });

  const [district, setDistrict] = useState<string>(() =>
    canSelectDistrict ? sessionStorage.getItem('saksha_fusion_district') || '' : scopeDistrict || '',
  );
  const [category, setCategory] = useState<string>(() => sessionStorage.getItem('saksha_fusion_category') || '');
  const [timeWindow, setTimeWindow] = useState<number>(() => Number(sessionStorage.getItem('saksha_fusion_timewindow')) || 30);
  const [sensitivity, setSensitivity] = useState<SensitivityKey>(() => {
    const s = sessionStorage.getItem('saksha_fusion_sensitivity');
    return s === 'broad' || s === 'strict' || s === 'balanced' ? s : 'balanced';
  });
  const [categories, setCategories] = useState<string[]>(CATEGORIES_FALLBACK);

  const [runs, setRuns] = useState<IntelligenceHistoryItem[]>([]);
  const [investigatePattern, setInvestigatePattern] = useState<UnifiedIntelligenceResult | null>(null);

  const sens = SENSITIVITY[sensitivity];

  useEffect(() => {
    getCrimeCategories()
      .then((cs) => {
        const names = Array.from(new Set(cs.map((c) => c.name).filter(Boolean)));
        if (names.length) setCategories(names);
      })
      .catch(() => {
        /* keep fallback list */
      });
  }, []);

  const loadRuns = useCallback(async () => {
    try {
      const raw = await getIntelligenceHistory(100);
      setRuns(
        raw
          .filter((h) => h.entity_type === 'fusion' || h.entity_type === 'fused_pattern')
          .slice(0, 8)
      );
    } catch {
      setRuns([]);
    }
  }, []);

  const loadPatterns = useCallback(async () => {
    // Only show full loading spinner if we don't already have patterns in memory/cache
    setLoading((prev) => (patterns.length === 0 ? true : prev));
    setError(null);
    try {
      const res = await getEmergingPatterns({
        district: district || undefined,
        category: category || undefined,
        time_window_days: timeWindow,
        min_signals: sens.min_signals,
        min_risk: sens.min_risk,
        min_confidence: sens.min_confidence,
      });
      const newPatterns = res.patterns || [];
      if (newPatterns.length > 0) {
        setPatterns(newPatterns);
        setTotal(res.total ?? newPatterns.length);
        setGeneratedAt(res.generated_at || null);
        try {
          sessionStorage.setItem('saksha_fusion_patterns', JSON.stringify(newPatterns));
          sessionStorage.setItem('saksha_fusion_total', String(res.total ?? newPatterns.length));
          if (res.generated_at) sessionStorage.setItem('saksha_fusion_generated_at', res.generated_at);
        } catch {
          /* ignore */
        }
      } else if (patterns.length === 0) {
        setPatterns([]);
        setTotal(0);
      }
    } catch (e: any) {
      // Don't wipe out existing cached patterns on transient error
      if (patterns.length === 0) {
        setError(e?.message || 'Failed to detect emerging patterns');
      }
    } finally {
      setLoading(false);
    }
  }, [district, category, timeWindow, sens.min_signals, sens.min_risk, sens.min_confidence]);

  // On mount: hydrate from cache if available, only fetch if cache is empty
  useEffect(() => {
    const saved = sessionStorage.getItem('saksha_fusion_patterns');
    let hasValidCache = false;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          hasValidCache = true;
        }
      } catch {
        /* ignore */
      }
    }
    if (!hasValidCache) {
      loadPatterns();
    }
    loadRuns();
  }, []);

  // Filter change observer: save to sessionStorage and reload patterns
  const isInitialFilterMount = React.useRef(true);
  useEffect(() => {
    if (isInitialFilterMount.current) {
      isInitialFilterMount.current = false;
      return;
    }
    try {
      sessionStorage.setItem('saksha_fusion_district', district);
      sessionStorage.setItem('saksha_fusion_category', category);
      sessionStorage.setItem('saksha_fusion_timewindow', String(timeWindow));
      sessionStorage.setItem('saksha_fusion_sensitivity', sensitivity);
    } catch {
      /* ignore */
    }
    loadPatterns();
  }, [district, category, timeWindow, sensitivity, loadPatterns]);

  const runFusion = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await runIntelligenceFusion({
        district: district || undefined,
        category: category || undefined,
        thresholds: {
          min_risk_score: sens.min_risk,
          min_confidence: sens.min_confidence,
          min_supporting_signals: sens.min_signals,
          current_window_days: timeWindow,
        },
      });
      const newPatterns = res.patterns || [];
      setPatterns(newPatterns);
      setTotal(res.total ?? 0);
      setGeneratedAt(res.generated_at || null);
      try {
        sessionStorage.setItem('saksha_fusion_patterns', JSON.stringify(newPatterns));
        sessionStorage.setItem('saksha_fusion_total', String(res.total ?? 0));
        if (res.generated_at) sessionStorage.setItem('saksha_fusion_generated_at', res.generated_at);
      } catch {
        /* ignore */
      }
      await loadRuns();
    } catch (e: any) {
      setError(e?.message || 'Fusion run failed');
    } finally {
      setRunning(false);
    }
  };

  const handleDeleteRun = async (runId: string) => {
    try {
      await deleteIntelligenceHistory(runId);
      setRuns((prev) => prev.filter((r) => r.id !== runId));
    } catch {
      /* ignore */
    }
  };

  const kpis = useMemo(() => {
    const signals = patterns.reduce((a, p) => a + (p.supporting_signals?.length || 0), 0);
    const districtCount = new Set(patterns.map((p) => p.location?.district).filter(Boolean)).size;
    const avgConf = patterns.length
      ? Math.round((patterns.reduce((a, p) => a + (p.confidence || 0), 0) / patterns.length) * 100)
      : 0;
    const critical = patterns.filter((p) => p.recommended_action_input?.priority === 'CRITICAL').length;
    const high = patterns.filter((p) => p.recommended_action_input?.priority === 'HIGH').length;
    return { signals, districtCount, avgConf, critical, high };
  }, [patterns]);

  const selectCls =
    'bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-2.5 py-2 text-[10px] font-mono text-[var(--text-primary)] outline-none focus:border-[#C94A2A]/50 [&>option]:bg-[var(--bg-primary)]';

  return (
    <div className="min-h-[84vh] pb-10 select-none">
      {/* Header */}
      <div className="border-b border-[var(--border-muted)] pb-3 mb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-md font-mono font-bold uppercase tracking-wider text-[var(--text-primary)]">
              <Radar className="w-5 h-5 text-[#C94A2A]" /> Intelligence Fusion
            </h2>
            <p className="text-[9.5px] font-mono text-[var(--text-muted)] mt-0.5 uppercase">
              Fuse live analytics into plain-language crime insights for field officers
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {generatedAt && (
              <span className="text-[7.5px] font-mono text-[var(--text-muted)] hidden md:block">
                Generated {new Date(generatedAt).toLocaleString()}
              </span>
            )}
            <button
              onClick={loadPatterns}
              disabled={loading || running}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--border-primary)] text-[9px] font-mono uppercase text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button
              onClick={runFusion}
              disabled={running || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#a855f7]/40 bg-[#a855f7]/5 text-[9px] font-mono uppercase font-bold text-[#a855f7] hover:bg-[#a855f7]/10 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Radar className={`w-3 h-3 ${running ? 'animate-pulse' : ''}`} />
              {running ? 'Fusing…' : 'Run Fusion'}
            </button>
          </div>
        </div>
      </div>

      {/* Filters — drive the underlying analysis */}
      <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]/40 p-3 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-[8px] font-mono uppercase tracking-wider text-[var(--text-muted)] w-full sm:w-auto sm:mr-1">
            <SlidersHorizontal className="w-3 h-3" /> Analysis scope
          </span>
          {canSelectDistrict ? (
            <select
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className={selectCls}
              aria-label="District"
            >
              <option value="">All districts</option>
              {KARNATAKA_DISTRICTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-2.5 py-1 text-[10.5px] font-medium text-[var(--text-primary)]">
              <MapPin className="w-3 h-3 text-[var(--accent-blue)]" />
              {scopeDistrict}
            </span>
          )}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={selectCls}
            aria-label="Crime category"
          >
            <option value="">All crime types</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <div className="flex items-center gap-1.5">
            <span className="text-[7.5px] font-mono uppercase text-[var(--text-muted)]">Window</span>
            <select
              value={timeWindow}
              onChange={(e) => setTimeWindow(Number(e.target.value))}
              className={selectCls}
              aria-label="Observation window"
            >
              {TIME_WINDOWS.map((tw) => (
                <option key={tw} value={tw}>Last {tw} days</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[7.5px] font-mono uppercase text-[var(--text-muted)]">Detection</span>
            {(Object.keys(SENSITIVITY) as SensitivityKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setSensitivity(key)}
                title={SENSITIVITY[key].hint}
                className={`px-2 py-1.5 rounded-lg border text-[8.5px] font-mono uppercase font-bold transition-colors cursor-pointer ${
                  sensitivity === key
                    ? 'border-[#C94A2A]/60 text-[#C94A2A] bg-[#C94A2A]/10'
                    : 'border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
                }`}
              >
                {SENSITIVITY[key].label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-[7.5px] font-mono text-[var(--text-muted)] uppercase">
          Scope: {district || 'All districts'} · {category || 'All crime types'} · last {timeWindow} days · {sens.label} detection ({SENSITIVITY[sensitivity].hint.toLowerCase()}) — press “Run Fusion” to apply and record the analysis
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-3">
        <StatCard label="Emerging Patterns" value={String(total)} accent="#C94A2A" />
        <StatCard label="Do Now" value={String(kpis.critical)} hint="critical actions" accent="#C94A2A" />
        <StatCard label="High Priority" value={String(kpis.high)} hint="actions" accent="#D4820A" />
        <StatCard label="Indicators" value={String(kpis.signals)} hint="corroborating signals" />
        <StatCard label="Districts" value={String(kpis.districtCount)} hint="affected" />
        <StatCard label="Avg Confidence" value={`${kpis.avgConf}%`} accent="#0E9E78" />
      </div>

      {/* Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Patterns */}
        <div className="lg:col-span-8">
          <IntelligencePatternsFeed
            patterns={patterns}
            total={patterns.length}
            loading={loading}
            running={running}
            error={error}
            onRunFusion={runFusion}
            onInvestigate={setInvestigatePattern}
          />
        </div>

        {/* Recent runs + explainer */}
        <div className="lg:col-span-4 space-y-4">
          {/* Recent fusion runs */}
          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]/40 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-primary)] bg-[var(--bg-elevated)]/40">
              <span className="flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase tracking-wider text-[var(--text-primary)]">
                <History className="w-3.5 h-3.5 text-[#a855f7]" /> Recent Fusion Runs
              </span>
              <span className="text-[8px] font-mono text-[var(--text-muted)]">{runs.length}</span>
            </div>
            {runs.length === 0 ? (
              <div className="p-5 text-center">
                <Activity className="w-5 h-5 text-[var(--text-muted)] mx-auto mb-1.5" />
                <p className="text-[9px] font-mono text-[var(--text-muted)] uppercase">No fusion runs yet</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-primary)/50] max-h-[240px] overflow-y-auto custom-scrollbar">
                {runs.map((r) => (
                  <div key={r.id} className="group flex items-center gap-2.5 px-3 py-2">
                    <span className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 border border-[#a855f7]/40 bg-[#a855f7]/5 text-[#a855f7]">
                      <Flame className="w-3 h-3" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[9.5px] font-semibold text-[var(--text-primary)] truncate">{r.entity_label || 'Fusion Run'}</div>
                      <div className="text-[7.5px] font-mono text-[var(--text-muted)] truncate mt-0.5">{r.summary || '—'}</div>
                      <div className="text-[7px] font-mono text-[var(--text-muted)] mt-0.5">
                        {r.connections ?? 0} pattern{(r.connections ?? 0) === 1 ? '' : 's'} · {r.created_at ? new Date(r.created_at).toLocaleString() : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteRun(r.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-[var(--text-muted)] hover:text-[#C94A2A] hover:bg-[#C94A2A]/10 transition-all cursor-pointer shrink-0"
                      title="Remove run"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Explainable fusion */}
          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]/40 p-3.5">
            <span className="flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase tracking-wider text-[#C94A2A]">
              <TrendingUp className="w-3.5 h-3.5" /> How This Portal Works
            </span>
            <ul className="space-y-1.5 mt-2.5">
              {[
                { icon: <Activity className="w-3 h-3" />, text: 'Flags unusual activity spikes against historical baselines' },
                { icon: <MapPin className="w-3 h-3" />, text: 'Locates the pattern to stations / zones within the district' },
                { icon: <TrendingUp className="w-3 h-3" />, text: 'Projects the near-term trend so you can plan deployment' },
                { icon: <Flame className="w-3 h-3" />, text: 'Connects shared modus operandi, persons, vehicles and FIRs' },
              ].map((row, i) => (
                <li key={i} className="flex items-start gap-2 text-[8.5px] text-[var(--text-secondary)] leading-relaxed">
                  <span className="mt-0.5 shrink-0 text-[#D4820A]">{row.icon}</span>
                  {row.text}
                </li>
              ))}
            </ul>
            <div className="mt-3 pt-3 border-t border-[var(--border-primary)]/50">
              <span className="text-[7.5px] font-mono uppercase text-[var(--text-muted)]">Method availability</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {ML_MODES.map((m) => (
                  <span key={m} className={`px-1.5 py-0.5 rounded border text-[6.5px] font-mono uppercase font-bold ${
                    m === 'ML' ? 'text-emerald-400 border-emerald-500/40'
                      : m === 'HYBRID' ? 'text-[#D4820A] border-[#D4820A]/40'
                      : m === 'FALLBACK' ? 'text-amber-400 border-amber-500/40'
                      : 'text-[#1E6FD9] border-[#1E6FD9]/40'
                  }`}>
                    {m}
                  </span>
                ))}
              </div>
              <p className="text-[7px] font-mono text-[var(--text-muted)] uppercase mt-2">
                v{patterns[0]?.model_version || '—'} · {patterns[0]?.data_provenance || '—'} provenance
              </p>
            </div>
          </div>

          {/* Action pipeline */}
          <div className="rounded-xl border border-[#1E6FD9]/30 bg-[#1E6FD9]/5 p-3.5">
            <span className="flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase tracking-wider text-[#1E6FD9]">
              <Cpu className="w-3.5 h-3.5" /> Action Pipeline
            </span>
            <p className="text-[8.5px] text-[var(--text-secondary)] leading-relaxed mt-2">
              Each insight carries a recommended action (patrol surge, surveillance, checkpoint or investigation) you can dispatch straight into the interventions prevention loop from the pattern card.
            </p>
            {patterns.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {patterns.slice(0, 6).map((p) => {
                  const pr = p.recommended_action_input?.priority || 'MEDIUM';
                  return (
                    <span key={p.intelligence_id} className={`px-1.5 py-0.5 rounded border text-[6.5px] font-mono uppercase font-bold ${PRIORITY_STYLES[pr] || PRIORITY_STYLES.MEDIUM}`}>
                      {pr === 'CRITICAL' ? 'Do now' : pr}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#C94A2A]/40 bg-[#C94A2A]/5 px-3 py-2 text-[8.5px] font-mono text-[#C94A2A]">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" /> {error}
        </div>
      )}

      <IntelligenceInvestigationDrawer
        open={investigatePattern !== null}
        pattern={investigatePattern}
        onClose={() => setInvestigatePattern(null)}
      />
    </div>
  );
};

export default IntelligenceFusion;