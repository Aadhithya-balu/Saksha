import React, { useEffect, useState, useMemo } from 'react';
import KarnatakaMap, { type EmergingTrendItem } from '../components/map/KarnatakaMap';
import KarnatakaDistrictMap from '../components/map/KarnatakaDistrictMap';
import SpatiotemporalHeatmap from '../components/dashboard/SpatiotemporalHeatmap';
import IntelligenceStatusBadges from '../components/ui/IntelligenceStatusBadges';
import { 
  Compass, Download, Flame, TrendingUp,
  BarChart3, Map as MapIcon, ChevronRight, Globe
} from 'lucide-react';
import { downloadSecureDossier } from '../utils/downloader';
import { useAuditStore } from '../store/auditStore';
import { useAuthStore } from '../store/authStore';
import { useMapStore } from '../store/mapStore';
import { useNotificationStore } from '../store/notificationStore';
import { 
  getDistrictComparison, getHotspots, getRiskScores, getEmergingTrends, getRecentIncidents, getCrimeCases,
  getSociologicalSocioeconomic,
  getRedZones, getStationsSummary,
  type DistrictComparisonPoint, type HotspotPoint, type RiskScoresResponse, type RedZone
} from '../services/api';
import { getIntelligenceStatus } from '../services/intelligenceStatus';
import { useDataMode } from '../hooks/useDataMode';
import type { DistrictInfo } from '../store/mapStore';
import { PageHeader } from '../components/ui/PageHeader';
import { PageSkeleton } from '../components/ui/Skeleton';
import { useTranslation } from '../i18n';
import { useUserScope } from '../hooks/useUserScope';

type HotspotSource = 'backend' | 'stations' | 'demo';

export const Hotspots: React.FC = () => {
  const { user } = useAuthStore();
  const { addLog } = useAuditStore();
  const { district: scopeDistrict, canSelectDistrict } = useUserScope();
  const { selectedDistrict, selectedStation, setSelectedDistrict, setSelectedStation, setTimeOfDay, timeOfDay } = useMapStore();
  const { isProduction } = useDataMode();
  const t = useTranslation();

  const [hotspots, setHotspots] = useState<HotspotPoint[]>([]);
  // Provenance of the currently displayed hotspot list — reset on every load
  // so a stale LIVE badge can never attach to new data (issue 9 §23/§24).
  const [hotspotSource, setHotspotSource] = useState<HotspotSource | null>(null);
  const [hotspotAnalysisMode, setHotspotAnalysisMode] = useState<string | null>(null);
  const [hotspotDataProvenance, setHotspotDataProvenance] = useState<string | null>(null);
  const [districtMetrics, setDistrictMetrics] = useState<Record<string, DistrictInfo>>({});
  const [emergingTrends, setEmergingTrends] = useState<EmergingTrendItem[]>([]);
  const [recentCases, setRecentCases] = useState<any[]>([]);
  const [socioEconomicData, setSocioEconomicData] = useState<any[]>([]);
  const [redZones, setRedZones] = useState<RedZone[]>([]);
  const [viewMode, setViewMode] = useState<'map' | 'matrix' | 'karnataka'>('map');
  const [selectedCategoryFilter] = useState<string>('ALL');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // District-scoped officers always begin on their own district. Multi-district
    // operators (admin/SP/analyst) start on the statewide view — their home
    // district is often a HQ placeholder ("State HQ") that has no stations.
    if (!canSelectDistrict && scopeDistrict && !useMapStore.getState().selectedDistrict) {
      setSelectedDistrict(scopeDistrict);
      setSelectedStation(null);
    }
  }, [scopeDistrict, canSelectDistrict, setSelectedDistrict, setSelectedStation]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    // Clear stale status before the new request resolves (issue 9 §24).
    setHotspotSource(null);
    setHotspotAnalysisMode(null);
    setHotspotDataProvenance(null);

    // Check if navigating from Anomaly "Locate on Map" — command roles may
    // jump to any district; district-scoped officers skip the override.
    const override = sessionStorage.getItem('selected_district_override');
    if (override && canSelectDistrict) {
      sessionStorage.removeItem('selected_district_override');
      setSelectedDistrict(override);
      setSelectedStation(null);
    }

    // 1. Primary fast load: hotspots, live station summaries, and district comparison
    void Promise.allSettled([
      getHotspots(),
      getStationsSummary(),
      getDistrictComparison(),
    ]).then(([hotspotRes, stationRes, districtRes]) => {
      if (!isMounted) return;
      const hotspotsFailed = hotspotRes.status === 'rejected';
      const stations = stationRes.status === 'fulfilled' ? stationRes.value.stations : [];
      const districtFailed = districtRes.status === 'rejected';
      if (hotspotsFailed && districtFailed) {
        setHotspots([]);
        setDistrictMetrics({});
        setError('Unable to load hotspot and district intelligence data. Please retry.');
        setLoading(false);
        return;
      }
      const backendHotspots = hotspotRes.status === 'fulfilled' ? hotspotRes.value.hotspots : [];
      const stationHotspots: HotspotPoint[] = stations.map(station => ({
        district_id: station.district,
        name: station.station,
        lat: station.lat,
        lng: station.lng,
        score: station.risk_score,
        category: station.top_category,
        trend: station.trend,
      }));
      let source: HotspotSource;
      let hsList: HotspotPoint[] = [];

      if (hotspotRes.status === 'fulfilled') {
        setHotspotAnalysisMode(hotspotRes.value.analysis_mode ?? 'STATISTICAL');
        source = 'backend';
        hsList = backendHotspots;
      } else if (stationRes.status === 'fulfilled' && stationHotspots.length > 0) {
        source = 'stations';
        hsList = stationHotspots;
      } else {
        source = 'backend';
        hsList = [];
        if (hotspotRes.status === 'rejected') {
          setError('Hotspot intelligence service is currently unavailable. Please retry.');
        }
      }

      setHotspotSource(source);
      const distList = districtRes.status === 'fulfilled' ? districtRes.value : [];
      setHotspots(hsList);
      setDistrictMetrics(prev => ({
        ...prev,
        ...buildDistrictMetrics(distList, { district_id: null, window: 'next_7d', grid_predictions: [], model_version: '' }, hsList)
      }));
      setLoading(false);
    }).catch(() => {
      if (!isMounted) return;
      setLoading(false);
      setHotspots([]);
      setDistrictMetrics({});
      setError('Unable to load hotspot and district intelligence data. Please retry.');
    });

    // 2. Secondary progressive load: trends, red zones, recent cases, and socio-economic data
    void getEmergingTrends().then(trendsData => {
      if (isMounted && Array.isArray(trendsData)) {
        setEmergingTrends(trendsData);
        // Dispatch critical spike notifications once per session (dedup via sessionStorage).
        // The backend also dedups identical broadcasts for a configurable window, so
        // reloads/tabs cannot flood the notification center. Only genuinely critical
        // surges (>= 100% change i.e. doubled volume, and meaningful recent volume)
        // are broadcast — the bell is reserved for critical/important alerts.
        const alreadySent = sessionStorage.getItem('spike_notifications_sent');
        if (!alreadySent) {
          const surges = trendsData.filter(
            (t: any) => t.direction === 'increasing' && t.change_percentage >= 100 && (t.recent_count ?? 0) >= 3,
          );
          if (surges.length > 0) {
            sessionStorage.setItem('spike_notifications_sent', '1');
            surges.slice(0, 2).forEach((surge: any) => {
              void useNotificationStore.getState().sendNotification({
                subject: `CRITICAL CRIME SURGE: ${surge.category}`,
                title: `Critical Crime Surge in ${surge.category}`,
                message: `Crime volume in ${surge.category} has doubled or worse (+${surge.change_percentage}%: ${surge.recent_count} recent vs ${surge.historical_count} baseline). Immediate review recommended.`,
                category: 'SPIKE_ALERT',
                priority: 'urgent',
                severity: 'critical',
                is_broadcast: true,
              }).catch(() => undefined);
            });
          }
        }
      }
    }).catch(() => undefined);

    void getRedZones().then(result => {
      if (isMounted) setRedZones(result.red_zones || []);
    }).catch(() => undefined);

    void getSociologicalSocioeconomic().then(socioRes => {
      if (isMounted && Array.isArray(socioRes?.districts)) {
        setSocioEconomicData(socioRes.districts);
      }
    }).catch(() => undefined);

    void Promise.allSettled([
      getRecentIncidents(),
      getCrimeCases('', undefined, 1, 50, canSelectDistrict ? undefined : { district: scopeDistrict || undefined }),
    ]).then(([recentRes, casesRes]) => {
      if (!isMounted) return;
      const recentList = recentRes.status === 'fulfilled' ? recentRes.value : [];
      const paginatedList = casesRes.status === 'fulfilled' ? (casesRes.value?.results || []) : [];
      
      // Combine and normalize cases
      const map = new Map<string, any>();
      [...recentList, ...paginatedList].forEach((c: any) => {
        const id = c.case_number || c.id;
        if (id && !map.has(id)) {
          map.set(id, {
            ...c,
            crime_type: c.crime_type || c.category || 'Incident Offense',
            location: c.location || c.station || '',
            priority: c.priority ?? null,
            status: c.status || 'Active',
            time: c.time || c.occurred_at || c.created_at,
          });
        }
      });
      setRecentCases(Array.from(map.values()));
    }).catch(() => undefined);

    // 3. Background AI risk predictions (non-blocking)
    void getRiskScores().then(riskData => {
      if (isMounted && riskData?.grid_predictions) {
        setDistrictMetrics(prev => {
          const updated = { ...prev };
          riskData.grid_predictions.forEach(item => {
            if (updated[item.district]) {
              updated[item.district] = {
                ...updated[item.district],
                riskScore: Math.round(item.risk_score),
              };
            }
          });
          return updated;
        });
      }
    }).catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [isProduction, scopeDistrict, canSelectDistrict, setSelectedDistrict, setSelectedStation]);

  // Filtered hotspots by category if specified
  const filteredHotspots = useMemo(() => {
    if (selectedCategoryFilter === 'ALL') return hotspots;
    return hotspots.filter(h => (h.category || '').toLowerCase().includes(selectedCategoryFilter.toLowerCase()));
  }, [hotspots, selectedCategoryFilter]);

  // High priority emerging trend alerts (increasing by >10%)
  const activeAlertSurges = useMemo(() => {
    return emergingTrends.filter(t => t.direction === 'increasing' && t.change_percentage > 10);
  }, [emergingTrends]);

  // Intelligence status — derived strictly from backend metadata / known
  // provenance of the displayed list (issue 9 §4/§5). Hotspots are a
  // statistical analysis of recorded history, never labelled as ML output.
  const hotspotStatusBadges = useMemo(() => {
    if (loading || !hotspotSource) return [];
    if (hotspotSource === 'backend') {
      return getIntelligenceStatus({
        analysisMode: hotspotAnalysisMode ?? 'STATISTICAL',
        dataProvenance: hotspotDataProvenance ?? 'UNKNOWN',
        historicalOnly: true,
      });
    }
    if (hotspotSource === 'stations') {
      return getIntelligenceStatus({ dataProvenance: 'LIVE_DB', historicalOnly: true });
    }
    return getIntelligenceStatus({ predictionMode: 'FALLBACK', dataProvenance: 'DEMO' });
  }, [loading, hotspotSource, hotspotAnalysisMode, hotspotDataProvenance]);

  // Top telemetry cards: Show active police station & district stations if selected, otherwise statewide top 3
  const displayedTopHotspots = useMemo(() => {
    const map = new Map<string, HotspotPoint>();

    // 1. If a specific station is currently selected, ensure it is the leading card
    if (selectedStation) {
      const match = filteredHotspots.find(
        (h) => (h.name || '').toLowerCase() === selectedStation.toLowerCase()
      );
      // No fabricated entry for unmatched stations — only real records render
      // a score (issue 9 §20).
      if (match) {
        map.set(match.name, match);
      }
    }

    // 2. If a district is selected, add its stations
    if (selectedDistrict) {
      const targetDist = (selectedDistrict || '').toLowerCase();
      filteredHotspots
        .filter((h) => (h.district_id || '').toLowerCase() === targetDist)
        .forEach((h) => {
          if (!map.has(h.name)) map.set(h.name, h);
        });
    }

    // 3. If fewer than 3 cards, fill with top statewide hotspots
    if (map.size < 3) {
      filteredHotspots.forEach((h) => {
        if (map.size < 3 && !map.has(h.name)) {
          map.set(h.name, h);
        }
      });
    }

    return Array.from(map.values()).slice(0, 3);
  }, [filteredHotspots, selectedDistrict, selectedStation]);

  const handleExportGeoJSON = () => {
    const geojsonData = {
      type: 'FeatureCollection',
      features: filteredHotspots.map((hotspot) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [hotspot.lng, hotspot.lat] },
        properties: {
          name: hotspot.name,
          district: hotspot.district_id,
          threat: `${hotspot.score}%`,
          category: hotspot.category,
          trend: hotspot.trend,
        },
      }))
    };

    downloadSecureDossier(
      'Statewide Hotspots GeoJSON', 
      geojsonData, 
      user ? `CONFIDENTIAL - ${user.badgeId}` : 'CONFIDENTIAL - STATE POLICE'
    );

    if (user) {
      addLog(
        user.name,
        user.badgeId,
        'EXPORT',
        'Exported statewide incident hotspots overlay database (GEOJSON)'
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-[84vh] flex flex-col gap-4 md:p-1">
        <PageHeader title={t.page_hotspot_title} subtitle={t.page_hotspot_subtitle} icon={<Compass className="w-5 h-5" />} />
        <PageSkeleton />
      </div>
    );
  }

  if (error && hotspots.length === 0) {
    return (
      <div className="min-h-[84vh] flex flex-col gap-4 md:p-1">
        <PageHeader title={t.page_hotspot_title} icon={<Compass className="w-5 h-5" />} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-[var(--accent-coral-subtle)] border border-[var(--accent-coral)]/20 flex items-center justify-center mx-auto text-[var(--accent-coral)]">
              <Compass className="w-6 h-6" />
            </div>
            <p className="text-sm text-[var(--text-secondary)]">{error}</p>
            <button onClick={() => { setError(null); setLoading(true); window.location.reload(); }} className="sk-btn sk-btn-primary">
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[84vh] flex flex-col gap-4 md:p-1">

      {/* Page header */}
      <PageHeader
        title={t.page_hotspot_title}
        subtitle={t.page_hotspot_subtitle}
        icon={<Compass className="w-5 h-5" />}
        actions={
          <div className="flex items-center gap-2">
            {/* Intelligence status chip — compact, tooltip-backed (issue 9 §5) */}
            {hotspotStatusBadges.length > 0 && (
              <IntelligenceStatusBadges badges={hotspotStatusBadges} className="mr-1" />
            )}
            {/* View Mode Toggle */}
            <div className="flex bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded p-0.5">
              <button
                onClick={() => setViewMode('map')}
                className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                  viewMode === 'map' ? 'bg-[var(--accent-blue)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                {t.page_hotspot_vector_map}
              </button>
              <button
                onClick={() => setViewMode('karnataka')}
                className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                  viewMode === 'karnataka' ? 'bg-[var(--accent-teal)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                Karnataka Map
              </button>
              <button
                onClick={() => setViewMode('matrix')}
                className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                  viewMode === 'matrix' ? 'bg-[var(--accent-blue)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                {t.page_hotspot_matrix}
              </button>
            </div>

            <button onClick={handleExportGeoJSON} className="sk-btn sk-btn-secondary">
              <Download className="w-4 h-4" />
              {t.page_hotspot_export}
            </button>
          </div>
        }
      />

      {/* EMERGING TREND ALERTS REAL-TIME TICKER (Surge alerts > 10%) */}
      {activeAlertSurges.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 flex flex-col md:flex-row md:items-center justify-between gap-2 font-mono text-[9px]">
          <div className="flex items-center gap-2 shrink-0">
            <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold uppercase flex items-center gap-1 animate-pulse border border-red-500/40">
              <Flame className="w-3 h-3 text-red-400" />
              {t.page_hotspot_emerging_alerts}
            </span>
            <span className="text-[var(--text-secondary)] hidden lg:inline">
              Crime categories exhibiting significant surge vs 30-day baseline:
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {activeAlertSurges.slice(0, 3).map((trend) => (
              <button
                key={trend.category}
                onClick={() => {
                  // Find a district associated with this top category or default to Bengaluru Urban
                  const matchingDist = Object.values(districtMetrics).find(d => d.topCrimeType.toLowerCase().includes(trend.category.toLowerCase()))?.name || 'Bengaluru Urban';
                  setSelectedDistrict(matchingDist);
                  setSelectedStation(null);
                }}
                className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 rounded flex items-center gap-1.5 cursor-pointer text-left transition-colors shrink-0"
                title={`Click to focus map on districts experiencing ${trend.category} surge`}
              >
                <span className="font-bold text-red-300">{trend.category}:</span>
                <span className="text-red-400 font-extrabold flex items-center gap-0.5">
                  <TrendingUp className="w-3 h-3" />
                  +{trend.change_percentage}%
                </span>
                <span className="text-[8px] text-[var(--text-muted)] hidden sm:inline">
                  ({trend.recent_count} vs {trend.historical_count} baseline)
                </span>
                <ChevronRight className="w-2.5 h-2.5 text-red-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {redZones.length > 0 && (
        <div className="bg-red-950/40 border border-red-500/40 rounded-xl px-4 py-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 shrink-0 mr-1">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-red-400">Red-zone spikes</span>
          </div>
          <div className="w-px h-4 bg-red-500/30 shrink-0" />
          {redZones.slice(0, 4).map(zone => (
            <button
              key={`${zone.district}-${zone.category}`}
              onClick={() => { setSelectedDistrict(zone.district); setSelectedStation(null); }}
              title={`Focus ${zone.district} on the map`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 hover:bg-red-500/25 border border-red-500/30 hover:border-red-400/60 transition-all group"
            >
              <span className="text-xs text-red-200 group-hover:text-white font-medium">{zone.category}</span>
              <span className="text-[10px] text-red-400/70">·</span>
              <span className="text-xs text-red-300/80 group-hover:text-red-200">{zone.district}</span>
              <span className="text-xs font-bold text-red-400 group-hover:text-red-300">×{zone.spike_ratio}</span>
            </button>
          ))}
        </div>
      )}

      {/* TOP SUMMARY TELEMETRY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {displayedTopHotspots.map((hotspot) => {
          const isCurrentActive = (selectedStation || '').toLowerCase() === hotspot.name.toLowerCase();
          return (
            <div 
              key={`${hotspot.name}-${hotspot.district_id}`} 
              onClick={() => {
                setSelectedDistrict(hotspot.district_id);
                setSelectedStation(hotspot.name);
              }}
              className={`sk-panel px-4 py-3 flex items-center justify-between gap-3 cursor-pointer transition-all shadow-sm ${
                isCurrentActive
                  ? 'border-[var(--accent-blue)] ring-1 ring-[var(--accent-blue)] bg-[var(--accent-blue-subtle)]'
                  : 'hover:border-[var(--accent-blue)]/60'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{hotspot.name}</p>
                  {isCurrentActive && (
                    <span className="px-1.5 py-0.5 text-[8px] font-bold rounded bg-[var(--accent-blue)] text-white uppercase shrink-0">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)] truncate">{hotspot.district_id} · {hotspot.category}</p>
                {/* Explicit status on every card whose data is not live backend
                    statistical output (issue 9 §21). */}
                {hotspotSource !== 'backend' && hotspotStatusBadges.length > 0 && (
                  <IntelligenceStatusBadges badges={hotspotStatusBadges} withInfo={false} className="mt-1" />
                )}
              </div>
              <span
                className={`sk-chip shrink-0 ${hotspot.score >= 75 ? 'sk-chip-error' : hotspot.score >= 55 ? 'sk-chip-warning' : 'sk-chip-success'}`}
              >
                {hotspot.score}%
              </span>
            </div>
          );
        })}
      </div>

      {/* MAIN VISUALIZATION VIEWPORT */}
      <div className={`w-full relative ${viewMode === 'karnataka' ? 'min-h-[700px] h-[760px]' : 'min-h-[620px] h-[680px]'}`}>
        {viewMode === 'map' && (
          <KarnatakaMap
            hotspots={filteredHotspots}
            districtDataOverride={districtMetrics}
            emergingTrends={emergingTrends}
            crimeCases={recentCases}
            socioEconomicData={socioEconomicData}
          />
        )}

        {viewMode === 'karnataka' && (
          <div className="w-full h-full flex flex-col rounded-xl overflow-hidden border border-[var(--border-primary)]">
            <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--bg-secondary)] border-b border-[var(--border-primary)] shrink-0">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[var(--accent-teal)]" />
                <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide">Karnataka District Hotspot Map</span>
                <span className="px-2 py-0.5 rounded-full bg-[var(--accent-teal)]/15 border border-[var(--accent-teal)]/30 text-[10px] font-mono text-[var(--accent-teal)] uppercase">
                  {filteredHotspots.length} active hotspots
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-mono text-[var(--text-muted)]">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />High Risk</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Medium</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Low</span>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <KarnatakaDistrictMap
                hotspots={filteredHotspots}
                districtDataOverride={districtMetrics}
                emergingTrends={emergingTrends}
              />
            </div>
          </div>
        )}
        {viewMode === 'matrix' && (
          <div className="w-full h-full">
            <SpatiotemporalHeatmap
              selectedHour={timeOfDay}
              onCellClick={(_day, hour) => {
                const h = parseInt(hour.split(':')[0], 10);
                setTimeOfDay(h);
                setViewMode('map');
              }}
            />
          </div>
        )}
      </div>

    </div>
  );
};

export default Hotspots;

const buildDistrictMetrics = (
  districtRows: DistrictComparisonPoint[],
  riskScores: RiskScoresResponse,
  hotspots: HotspotPoint[]
): Record<string, DistrictInfo> => {
  const risks = new Map(riskScores.grid_predictions.map((item) => [item.district, item.risk_score]));
  return districtRows.reduce<Record<string, DistrictInfo>>((acc, row) => {
    const districtHotspots = hotspots.filter((hotspot) => hotspot.district_id === row.district);
    const topHotspot = districtHotspots[0];
    // Risk comes ONLY from the backend risk model; hotspot-score averaging was
    // a locally fabricated substitute (issue 161 §1).
    const backendRisk = risks.get(row.district);
    acc[row.district] = {
      name: row.district,
      crimeCount: row.count,
      riskScore: backendRisk != null ? Math.round(backendRisk) : null,
      beatRatio: backendRisk != null ? Math.max(0, Math.round(100 - backendRisk)) : null,
      topCrimeType: topHotspot?.category ?? 'No active category',
      weeklyTrend: topHotspot?.trend === 'up' ? 'up' : topHotspot?.trend === 'down' ? 'down' : 'stable',
    };
    return acc;
  }, {});
};
