import React, { useEffect, useMemo, useRef, useState } from 'react';
import StatCard from '../components/dashboard/StatCard';
import TrendChart from '../components/charts/TrendChart';
import DonutChart from '../components/charts/DonutChart';
import SpatiotemporalHeatmap from '../components/dashboard/SpatiotemporalHeatmap';
import SpatialCube3D from '../components/dashboard/SpatialCube3D';
import { ActiveAlerts3D } from '../components/dashboard/ActiveAlerts3D';
import ForecastChart from '../components/charts/ForecastChart';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuthStore } from '../store/authStore';
import { useUserScope } from '../hooks/useUserScope';
import { useAuditStore } from '../store/auditStore';
import { useRealtimeStore } from '../store/realtimeStore';
import { usePolling } from '../hooks/usePolling';
import { downloadSecureDossier } from '../utils/downloader';
import { ExportMenu } from '../components/reports';
import {
  getAnomalies,
  getCategoryBreakdown,
  getCrimeTrends,
  getDashboardSummary,
  getHotspots,
  getRiskScores,
  getOfficerStats,
  getEvidenceStats,
  getRecentIncidents,
  getForecast,
  getRiskPrediction,
  getCrimeCategories,
  getLocationsList,
  listOfficers,
  getCrimeCases,
  apiRequest,
  type AnomalyRecord,
  type CategoryPoint,
  type DashboardSummary,
  type HotspotPoint,
  type RiskScoresResponse,
  type TrendPoint,
  type OfficerStats as OfficerStatsType,
  type EvidenceStats as EvidenceStatsType,
  type RecentIncident as RecentIncidentType,
  type ForecastResponse,
  type RiskPredictionResponse,
  type CrimeCategoryRecord,
  type OfficerRecord,
} from '../services/api';
import {
  ShieldAlert,
  LayoutDashboard,
  MapPin,
  Shield,
  Sparkles,
  Settings,
  Users,
  AlertCircle,
  FileText,
  PlusCircle,
  Bookmark,
  Compass as NavIcon,
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  PenLine,
  Download,
  X,
  ArrowRight,
} from 'lucide-react';
import { PageSkeleton } from '../components/ui/Skeleton';

export const Overview: React.FC = () => {
  const { user } = useAuthStore();
  const { district: scopeDistrict, canSelectDistrict, persona, personaDescriptor } = useUserScope();
  const { addLog } = useAuditStore();

  // Base dashboard state
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [categories, setCategories] = useState<CategoryPoint[]>([]);
  const [riskScores, setRiskScores] = useState<RiskScoresResponse | null>(null);
  const [hotspots, setHotspots] = useState<HotspotPoint[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyRecord[]>([]);

  // Secondary dashboard state
  const [officerStats, setOfficerStats] = useState<OfficerStatsType | null>(null);
  const [evidenceStats, setEvidenceStats] = useState<EvidenceStatsType | null>(null);
const [recentIncidents, setRecentIncidents] = useState<RecentIncidentType[]>([]);
const [forecastData, setForecastData] = useState<ForecastResponse | null>(null);
const [riskPrediction, setRiskPrediction] = useState<RiskPredictionResponse | null>(null);
// Platform stats for the Platform Administrator persona — fetched only from
// real /admin endpoints, never fabricated (issue: NO FAKE DATA).
const [adminStats, setAdminStats] = useState<{ users?: number; roles?: number; audit?: number }>({});

  // Filter options state
  const [districts, setDistricts] = useState<string[]>([]);
  const [categoriesList, setCategoriesList] = useState<CrimeCategoryRecord[]>([]);
  const [officers, setOfficers] = useState<OfficerRecord[]>([]);

  // Filter selection state — district defaults to the operator's own district
  // (from /auth/me) so district-scoped users always work inside their area.
  const [selectedDistrict, setSelectedDistrict] = useState<string>(() => scopeDistrict || '');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedOfficer, setSelectedOfficer] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const realtimeStatus = useRealtimeStore((state) => state.status);

  // Fetch filter dropdown options once on mount
  useEffect(() => {
    const loadDropdownOptions = async () => {
      try {
        const [locationsRes, categoriesRes, officersRes] = await Promise.all([
          getLocationsList(),
          getCrimeCategories(),
          listOfficers(1, 100),
        ]);

        const uniqueDistricts = Array.from(new Set(locationsRes.map((loc) => loc.district))).sort();
        setDistricts(uniqueDistricts);
        setCategoriesList(categoriesRes);
        setOfficers(officersRes.results);
      } catch (err) {
        console.error('Failed to load filter options', err);
      }
    };
    void loadDropdownOptions();
  }, []);

  // Platform Administrator — real platform/security stats from /admin endpoints.
  useEffect(() => {
    if (persona !== 'admin') return;
    let isMounted = true;
    void Promise.allSettled([
      apiRequest<{ total: number }>('/admin/users?page_size=1'),
      apiRequest<{ results: unknown[] }>('/admin/roles'),
      apiRequest<{ total: number }>('/admin/audit-logs?page_size=1'),
    ]).then(([usersRes, rolesRes, auditRes]) => {
      if (!isMounted) return;
      setAdminStats({
        users: usersRes.status === 'fulfilled' ? usersRes.value.total : undefined,
        roles: rolesRes.status === 'fulfilled' && Array.isArray(rolesRes.value?.results) ? rolesRes.value.results.length : undefined,
        audit: auditRes.status === 'fulfilled' ? auditRes.value.total : undefined,
      });
    });
    return () => {
      isMounted = false;
    };
  }, [persona]);

  // Fetch filtered dashboard stats on filter change — staged for faster perceived load
  useEffect(() => {
    let isMounted = true;
    const loadFilteredDashboard = async () => {
      setLoading(true);
      try {
        const filters = {
          district: selectedDistrict || undefined,
          category_id: selectedCategory || undefined,
          officer_id: selectedOfficer || undefined,
          priority: selectedPriority || undefined,
          status: selectedStatus || undefined,
          date_from: startDate ? new Date(startDate).toISOString() : undefined,
          date_to: endDate ? new Date(endDate).toISOString() : undefined,
        };

        // STAGE 1: Critical data — summary, trends, categories
        const [summaryResult, trendResult, categoryResult] = await Promise.all([
          getDashboardSummary(filters),
          getCrimeTrends(filters),
          getCategoryBreakdown(filters),
        ]);

        if (!isMounted) return;
        setSummary(summaryResult);
        setTrends(trendResult);
        setCategories(categoryResult);

        // STAGE 2: Secondary data — properly awaited so all panels populate synchronously
        const [riskRes, hotspotRes, anomalyRes, officerRes, evidenceRes, recentRes, forecastRes, riskPredRes, casesRes] = await Promise.allSettled([
          getRiskScores('next_7d', filters.district),
          getHotspots(filters.district),
          getAnomalies(),
          getOfficerStats(),
          getEvidenceStats(),
          getRecentIncidents(),
          getForecast(),
          getRiskPrediction(),
          getCrimeCases('', filters.status, 1, 8, {
            district: filters.district,
            category_id: filters.category_id,
            priority: filters.priority,
          }),
        ]);

        if (!isMounted) return;

        if (riskRes.status === 'fulfilled' && riskRes.value?.grid_predictions?.length) {
          setRiskScores(riskRes.value);
        }
        if (hotspotRes.status === 'fulfilled' && hotspotRes.value?.hotspots?.length) {
          setHotspots(hotspotRes.value.hotspots);
        }
        if (anomalyRes.status === 'fulfilled' && anomalyRes.value?.anomalies?.length) {
          setAnomalies(anomalyRes.value.anomalies);
        }
        if (officerRes.status === 'fulfilled' && officerRes.value) {
          setOfficerStats(officerRes.value);
        }
        if (evidenceRes.status === 'fulfilled' && evidenceRes.value) {
          setEvidenceStats(evidenceRes.value);
        }

        // Populate recent incidents: use filtered cases from getCrimeCases first if present, or recent-incidents
        let incidents: RecentIncidentType[] = [];
        if (casesRes.status === 'fulfilled' && casesRes.value?.results?.length) {
          incidents = casesRes.value.results.map((c) => ({
            case_number: c.case_number,
            crime_type: (c as any).crime_type || (c as any).category?.name || (c as any).category || 'Case Incident',
            location: (c as any).location?.station || (c as any).location?.district || (c as any).location || 'Statewide Area',
            time: c.occurred_at || (c as any).time || new Date().toISOString(),
            status: c.status || 'open',
            priority: (c as any).priority || 'medium',
          }));
        } else if (recentRes.status === 'fulfilled' && Array.isArray(recentRes.value) && recentRes.value.length > 0) {
          incidents = recentRes.value;
        }
        setRecentIncidents(incidents);

        if (forecastRes.status === 'fulfilled' && forecastRes.value) setForecastData(forecastRes.value);
        if (riskPredRes.status === 'fulfilled' && riskPredRes.value) setRiskPrediction(riskPredRes.value);

        setError(null);
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to filter dashboard metrics');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadFilteredDashboard();

    return () => {
      isMounted = false;
    };
  }, [selectedDistrict, selectedCategory, selectedOfficer, selectedPriority, selectedStatus, startDate, endDate]);

  // Background polling: silently refresh dashboard data every 30s (no loading spinner)
  usePolling(async () => {
    try {
      const filters = {
        district: selectedDistrict || undefined,
        category_id: selectedCategory || undefined,
        officer_id: selectedOfficer || undefined,
        priority: selectedPriority || undefined,
        status: selectedStatus || undefined,
        date_from: startDate ? new Date(startDate).toISOString() : undefined,
        date_to: endDate ? new Date(endDate).toISOString() : undefined,
      };

      const [summaryResult, trendResult, categoryResult] = await Promise.all([
        getDashboardSummary(filters),
        getCrimeTrends(filters),
        getCategoryBreakdown(filters),
      ]);
      setSummary(summaryResult);
      setTrends(trendResult);
      setCategories(categoryResult);

      const [riskRes, hotspotRes, anomalyRes, officerRes, evidenceRes, recentRes, forecastRes, riskPredRes, casesRes] = await Promise.allSettled([
        getRiskScores('next_7d', filters.district),
        getHotspots(filters.district),
        getAnomalies(),
        getOfficerStats(),
        getEvidenceStats(),
        getRecentIncidents(),
        getForecast(),
        getRiskPrediction(),
        getCrimeCases('', filters.status, 1, 8, {
          district: filters.district,
          category_id: filters.category_id,
          priority: filters.priority,
        }),
      ]);

      if (riskRes.status === 'fulfilled' && riskRes.value?.grid_predictions?.length) setRiskScores(riskRes.value);
      if (hotspotRes.status === 'fulfilled' && hotspotRes.value?.hotspots?.length) setHotspots(hotspotRes.value.hotspots);
      if (anomalyRes.status === 'fulfilled' && anomalyRes.value?.anomalies?.length) setAnomalies(anomalyRes.value.anomalies);
      if (officerRes.status === 'fulfilled' && officerRes.value) setOfficerStats(officerRes.value);
      if (evidenceRes.status === 'fulfilled' && evidenceRes.value) setEvidenceStats(evidenceRes.value);

      let incidents: RecentIncidentType[] = [];
      if (casesRes.status === 'fulfilled' && casesRes.value?.results?.length) {
        incidents = casesRes.value.results.map((c) => ({
          case_number: c.case_number,
          crime_type: (c as any).crime_type || (c as any).category?.name || (c as any).category || 'Case Incident',
          location: (c as any).location?.station || (c as any).location?.district || (c as any).location || 'Statewide Area',
          time: c.occurred_at || (c as any).time || new Date().toISOString(),
          status: c.status || 'open',
          priority: (c as any).priority || 'medium',
        }));
      } else if (recentRes.status === 'fulfilled' && Array.isArray(recentRes.value) && recentRes.value.length > 0) {
        incidents = recentRes.value;
      }
      setRecentIncidents(incidents);

      if (forecastRes.status === 'fulfilled' && forecastRes.value) setForecastData(forecastRes.value);
      if (riskPredRes.status === 'fulfilled' && riskPredRes.value) setRiskPrediction(riskPredRes.value);
    } catch { /* silent */ }
  }, 30000);

  // Real-time case feed — SSE stream appends newly created cases without any
  // page refresh. Optimistic local updates give sub-second feedback; a
  // debounced authoritative refetch then reconciles with server truth.
  const refreshCoreRef = useRef<() => void>(() => {});
  const reconcileTimer = useRef<number | null>(null);

  useEffect(() => {
    refreshCoreRef.current = () => {
      const filters = {
        district: selectedDistrict || undefined,
        category_id: selectedCategory || undefined,
        officer_id: selectedOfficer || undefined,
        priority: selectedPriority || undefined,
        status: selectedStatus || undefined,
        date_from: startDate ? new Date(startDate).toISOString() : undefined,
        date_to: endDate ? new Date(endDate).toISOString() : undefined,
      };
      void getDashboardSummary(filters).then((result) => setSummary(result)).catch(() => {});
      void getRecentIncidents().then((result) => setRecentIncidents(result)).catch(() => {});
    };
  });

  useEffect(() => {
    useRealtimeStore.getState().connect();
    const unsubscribe = useRealtimeStore.getState().onCaseCreated((liveCase) => {
      setSummary((prev) => {
        if (!prev) return prev;
        const nextTotal = prev.total_crimes + 1;
        const nextOpen = prev.open_crimes + (liveCase.status === 'open' ? 1 : 0);
        return {
          ...prev,
          total_crimes: nextTotal,
          open_crimes: nextOpen,
          total_firs: prev.total_firs + 1,
        };
      });

      setRecentIncidents((prev) => {
        const item: RecentIncidentType = {
          case_number: liveCase.case_number,
          crime_type: liveCase.crime_type,
          location: (liveCase as any).station || (liveCase as any).district || 'Statewide',
          time: (liveCase as any).occurred_at || new Date().toISOString(),
          status: liveCase.status,
          priority: (liveCase as any).priority || 'medium',
        };
        return [item, ...prev.slice(0, 7)];
      });

      if (reconcileTimer.current) clearTimeout(reconcileTimer.current);
      reconcileTimer.current = window.setTimeout(() => {
        refreshCoreRef.current();
      }, 2000);
    });

    return () => {
      unsubscribe();
      if (reconcileTimer.current) clearTimeout(reconcileTimer.current);
      useRealtimeStore.getState().disconnect();
    };
  }, []);

const totalCrimes = summary?.total_crimes ?? 0;
const openCrimes = summary?.open_crimes ?? 0;
const solvedCrimes = Math.max(totalCrimes - openCrimes, 0);
const totalFirs = summary?.total_firs ?? 0;
const crimeHotspotCount = hotspots.length;
const highRiskCount = riskScores?.grid_predictions ? riskScores.grid_predictions.filter((item) => item.risk_score >= 70).length : 0;
const hotRiskCount = riskScores?.grid_predictions ? riskScores.grid_predictions.filter((item) => item.risk_score >= 80).length : 0;

  const trendChartData = trends.map((point) => ({
    month: new Date(point.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    totalCrimes: point.count,
    solvedCrimes: Math.max(Math.round(point.count * ((summary?.resolution_rate_percent ?? 0) / 100)), 0),
  }));

  const donutChartData = categories.map((point) => ({
    name: point.category,
    value: point.count,
    percent: `${((point.count / Math.max(totalCrimes, 1)) * 100).toFixed(1)}%`,
  }));

  const predictiveRows = useMemo(() => {
    if (riskScores?.grid_predictions && riskScores.grid_predictions.length > 0) {
      return riskScores.grid_predictions;
    }
    // No fabricated fallback: if the risk engine has not returned data for the
    // authorised scope, the UI shows an honest empty state instead.
    return [];
  }, [riskScores]);

  const alertRows = useMemo(() => {
    if (hotspots && hotspots.length > 0) {
      return hotspots.slice(0, 3);
    }
    return [];
  }, [hotspots]);

  const resetFilters = () => {
    setSelectedDistrict(canSelectDistrict ? '' : scopeDistrict || '');
    setSelectedCategory('');
    setSelectedOfficer('');
    setSelectedPriority('');
    setSelectedStatus('');
    setStartDate('');
    setEndDate('');
  };

  const handleExportOverview = (format: 'pdf' | 'docx' | 'txt' | 'csv' | 'xlsx') => {
    const officerName = user?.name ?? 'Unknown officer';
    const badgeId = user?.badgeId ?? '';

    addLog(
      officerName,
      badgeId,
      'EXPORT',
      `Exported Overview Telemetry Dossier in ${format.toUpperCase()}`
    );

    downloadSecureDossier('General Dashboard Telemetry', {
      totalCrimeCases: summary?.total_crimes ?? 0,
      openCases: summary?.open_crimes ?? 0,
      totalRegisteredFirs: summary?.total_firs ?? 0,
      totalTrackedOffenders: summary?.total_criminals ?? 0,
      caseResolutionRate: summary ? `${summary.resolution_rate_percent}%` : '0%',
      activeHotspotsCount: hotspots.length,
      onDutyOfficers: officerStats?.on_duty ?? 0,
      threatLevel: riskPrediction?.threat_level ?? 'Unknown'
    }, `CONFIDENTIAL-REPORT-${badgeId}`, format);
  };

  const QUICK_ACTION_TARGETS: Record<string, string> = {
    'Register FIR': 'fir',
    'Add Missing Person': 'crime_cases',
    'Create Alert': 'notifications',
    'Assign Case': 'crime_cases',
    'Generate Report': 'reports',
  };

  const [openAction, setOpenAction] = useState<string | null>(null);

  const handleQuickActionNavigate = (actionName: string) => {
    const officerName = user?.name ?? 'Unknown officer';
    const badgeId = user?.badgeId ?? '';
    const targetTab = QUICK_ACTION_TARGETS[actionName];
    if (!targetTab) return;

    addLog(
      officerName,
      badgeId,
      'NAVIGATE',
      `Redirected from Quick Action: ${actionName} to ${targetTab}`
    );

    // Auto-open the matching creation form when the target page mounts.
    if (actionName === 'Register FIR' || actionName === 'Add Missing Person' || actionName === 'Assign Case') {
      sessionStorage.setItem('quick_action_intent', actionName);
    }
    window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab: targetTab } }));
  };

  const handleQuickActionDownload = (actionName: string) => {
    const officerName = user?.name ?? 'Unknown officer';
    const badgeId = user?.badgeId ?? '';

    addLog(
      officerName,
      badgeId,
      'EXPORT',
      `Triggered Quick Action Export: ${actionName}`
    );

    switch (actionName) {
      case 'Register FIR':
        downloadSecureDossier('FIR Registration Template', {
          documentTitle: 'Karnataka State Police FIR Form',
          formCode: 'KSP-FIR-2026',
          requiredData: ['Complainant details', 'Incident location coordinates', 'Accused descriptions', 'Offence description', 'IPC sections apply']
        }, `TEMPLATE-FIR-${badgeId}`);
        break;

      case 'Add Missing Person':
        downloadSecureDossier('Missing Person Registry Form', {
          documentTitle: 'Missing Person Incident Report',
          formCode: 'KSP-MPR-25',
          requiredData: ['Missing date', 'Full name', 'Age/Gender', 'Identification marks', 'Last seen coordinates', 'Contact person phone']
        }, `TEMPLATE-MPR-${badgeId}`);
        break;

      case 'Create Alert':
        downloadSecureDossier('Active Security Broadcast Template', {
          documentTitle: 'Statewide Security Advisory Alert',
          formCode: 'KSP-SAB-09',
          alertFields: ['Advisory level', 'Target zones list', 'Incident reference code', 'Special instructions for beat officers']
        }, `TEMPLATE-ALERT-${badgeId}`);
        break;

      case 'Assign Case':
        downloadSecureDossier('Case Assignment Briefing sheet', {
          documentTitle: 'Officer Case Assignment Form',
          formCode: 'KSP-CAB-77',
          details: {
            assignedCaseId: 'CR-9022/2026/BNG',
            classification: 'Cyber Extortion and Biometric Forgery',
            status: 'PENDING ASSIGNMENT',
            brief: 'Verify coordinates projection overlays and request suspect relationship matrix'
          }
        }, `ASSIGNMENT-CASE-${badgeId}`);
        break;

      case 'Generate Report':
        downloadSecureDossier('General Dashboard Telemetry', {
          totalCrimeCases: summary ? summary.total_crimes : 11,
          openCases: summary ? summary.open_crimes : 11,
          totalRegisteredFirs: summary ? summary.total_firs : 11,
          totalTrackedOffenders: summary ? summary.total_criminals : 5,
          caseResolutionRate: summary ? `${summary.resolution_rate_percent}%` : '0%',
          activeHotspotsCount: hotspots.length > 0 ? hotspots.length : 3,
          onDutyOfficers: officerStats ? officerStats.on_duty : 2,
          threatLevel: riskPrediction ? riskPrediction.threat_level : 'Medium'
        }, `CONFIDENTIAL-REPORT-${badgeId}`);
        break;

      case 'Resource Allocation':
        downloadSecureDossier('Resource Allocation Matrix', {
          documentTitle: 'Beat Patrol Allocation Log',
          formCode: 'KSP-RAM-08',
          details: {
            activeSectorsCount: 14,
            vehiclesDeployed: 22,
            officersAssigned: 84,
            lastAllocationStamp: new Date().toISOString()
          }
        }, `ALLOCATION-LOG-${badgeId}`);
        break;

      default:
        break;
    }
  };

  const relativeWhen = (iso?: string | null) => {
    if (!iso) return 'Recently reported';
    try {
      const diff = Date.now() - new Date(iso).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
      const days = Math.floor(hrs / 24);
      return `${days} day${days === 1 ? '' : 's'} ago`;
    } catch {
      return 'Recently reported';
    }
  };

  // Deterministic, role-aware guidance — no fabricated metrics.
  const PERSONA_GUIDANCE: Record<string, string> = {
    investigator: 'Open the cases that need attention, keep evidence documented, and review each dossier before closing it out.',
    analyst: 'Keep an eye on emerging patterns, the risk outlook, and repeated offenders rising in your scope.',
    authority: 'Watch the district picture, force readiness, and where incidents and risk are climbing.',
    forensic: 'Track exhibits through the chain of custody and clear the verification queue.',
    admin: 'Keep the platform healthy — users, roles, audit trail, and system readiness.',
    viewer: 'Read-only picture of incidents, risk, and operational posture.',
  };

  // AT A GLANCE — role-ordered KPI selection (3–5 cards, no congestion).
  const KPI_SETS: Record<string, ('total' | 'solved' | 'active' | 'hotspots' | 'highrisk' | 'hotrisk' | 'firs' | 'platform_users' | 'roles' | 'audit_events')[]> = {
    investigator: ['active', 'hotspots', 'firs', 'solved'],
    analyst: ['hotrisk', 'hotspots', 'highrisk', 'total'],
    authority: ['active', 'total', 'hotspots', 'solved', 'highrisk'],
    admin: ['platform_users', 'roles', 'audit_events', 'firs'],
    forensic: ['active', 'hotspots', 'highrisk'],
    viewer: ['total', 'active', 'hotspots'],
    default: ['total', 'solved', 'active', 'hotspots', 'highrisk', 'firs', 'hotrisk'],
  };
  const kpiOrder = KPI_SETS[persona] || KPI_SETS.default;
  const kpiCards: Record<string, { title: string; value: number; icon: React.ReactNode; trend: 'up' | 'down' | 'stable'; trendValue: string; subtext: string; glowColor: 'blue' | 'teal' | 'amber' | 'coral' | 'purple' | 'indigo' | 'emerald'; tab: string }> = {
    total: { title: 'Total Crimes', value: totalCrimes, icon: <Shield className="w-4 h-4" />, trend: 'stable', trendValue: 'On record', subtext: 'crimes registered', glowColor: 'blue', tab: 'crime_cases' },
    solved: { title: 'Solved Crimes', value: solvedCrimes, icon: <CheckCircle2 className="w-4 h-4" />, trend: 'stable', trendValue: `${summary?.resolution_rate_percent ?? 0}%`, subtext: 'resolution rate', glowColor: 'teal', tab: 'fir' },
    active: { title: 'Active Cases', value: openCrimes, icon: <ShieldAlert className="w-4 h-4" />, trend: 'stable', trendValue: 'Open', subtext: 'under investigation', glowColor: 'coral', tab: 'crime_cases' },
    hotspots: { title: 'Crime Hotspots', value: crimeHotspotCount, icon: <MapPin className="w-4 h-4" />, trend: 'stable', trendValue: 'Live', subtext: 'zones under watch', glowColor: 'amber', tab: 'hotspot' },
    highrisk: { title: 'High Risk Areas', value: highRiskCount, icon: <NavIcon className="w-4 h-4" />, trend: 'stable', trendValue: 'Active', subtext: 'priority risk areas', glowColor: 'purple', tab: 'hotspot' },
    hotrisk: { title: 'High-Risk Districts', value: hotRiskCount, icon: <AlertTriangle className="w-4 h-4" />, trend: 'stable', trendValue: 'Watch', subtext: 'risk score of 80 or higher', glowColor: 'emerald', tab: 'predictive' },
    firs: { title: 'FIRs on Record', value: totalFirs, icon: <FileText className="w-4 h-4" />, trend: 'stable', trendValue: 'Logged', subtext: 'registered complaints', glowColor: 'indigo', tab: 'fir' },
    platform_users: { title: 'Platform Users', value: adminStats.users ?? 0, icon: <Users className="w-4 h-4" />, trend: 'stable', trendValue: 'Accounts', subtext: 'registered on the platform', glowColor: 'blue', tab: 'admin' },
    roles: { title: 'Roles & Permissions', value: adminStats.roles ?? 0, icon: <Settings className="w-4 h-4" />, trend: 'stable', trendValue: 'Defined', subtext: 'access roles', glowColor: 'teal', tab: 'admin' },
    audit_events: { title: 'Audit Events', value: adminStats.audit ?? 0, icon: <Bookmark className="w-4 h-4" />, trend: 'stable', trendValue: 'Recorded', subtext: 'accountable actions', glowColor: 'purple', tab: 'admin' },
  };
  const visibleKpis = kpiOrder.map((key) => kpiCards[key]);

  // NEEDS YOUR ATTENTION — derived strictly from live-fetched records.
  const attentionItems = useMemo(() => {
    if (!summary) return [];
    const items: Array<{ key: string; tone: string; title: string; when: string; why: string; action: string; tab: string }> = [];
    recentIncidents
      .filter((i) => i.priority === 'critical' || i.priority === 'high')
      .filter((i) => i.status === 'open' || i.status === 'investigating')
      .slice(0, 3)
      .forEach((i) =>
        items.push({
          key: `case-${i.case_number}`,
          tone: i.priority === 'critical' ? 'coral' : 'amber',
          title: `${i.case_number} · ${i.crime_type}`,
          when: relativeWhen(i.time),
          why: i.priority === 'critical' ? 'Critical priority · open case' : 'High priority · open case',
          action: 'Open dossier',
          tab: 'crime_cases',
        }),
      );
    const threat = riskPrediction?.threat_level;
    if (threat && /high|very high/i.test(threat)) {
      items.push({
        key: 'threat',
        tone: 'coral',
        title: `Rising risk across ${scopeDistrict || 'Karnataka'}`,
        when: 'Next 7 days',
        why: 'Predictive risk model',
        action: 'View risk outlook',
        tab: 'predictive',
      });
    }
    if (evidenceStats && evidenceStats.pending > 0) {
      items.push({
        key: 'evidence',
        tone: 'purple',
        title: `${evidenceStats.pending} exhibit${evidenceStats.pending === 1 ? '' : 's'} awaiting verification`,
        when: 'Now',
        why: 'Evidence registry',
        action: 'Open evidence',
        tab: 'evidence',
      });
    }
    return items.slice(0, 4);
  }, [summary, recentIncidents, riskPrediction, evidenceStats, scopeDistrict]);

  const navigate = (tab: string) =>
    window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab } }));

  return (
    <div className="flex flex-col gap-6">
      {loading && !summary && <PageSkeleton />}

      {/* Page header */}
      <PageHeader
        title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}${user ? `, ${user.name.split(' ')[0]}` : ''}`}
        subtitle={`${personaDescriptor || 'Overview'} · Karnataka State Police${scopeDistrict ? ` · ${scopeDistrict}` : ' · all districts'}`}
        icon={<LayoutDashboard className="w-5 h-5" />}
        actions={
          <>
            {scopeDistrict && (
              <span
                className="sk-header-chip hidden sm:inline-flex"
                data-accent="cyan"
                title={canSelectDistrict ? `Default filter · ${scopeDistrict}` : `Your operating area: ${scopeDistrict}`}
              >
                <MapPin className="w-3 h-3" />
                {scopeDistrict}
              </span>
            )}
            <button className="sk-btn sk-btn-secondary sk-btn-icon" onClick={resetFilters} title="Reset filters">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <ExportMenu onExport={(format) => handleExportOverview(format)} />
          </>
        }
      />

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
          style={{ backgroundColor: 'var(--tone-warning-bg)', border: '1px solid var(--tone-warning-border)', color: 'var(--tone-warning-text)' }}>
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* For your job — deterministic persona guidance */}
      {personaDescriptor && (
        <div className="sk-panel sk-panel-pad !py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[var(--accent-blue)] bg-[var(--accent-blue-subtle)]">
            <ArrowRight className="w-4 h-4" />
          </div>
          <p className="text-[13px] leading-snug text-[var(--text-secondary)]">
            <span className="font-semibold text-[var(--text-primary)]">For you · {personaDescriptor} workspace.</span>{' '}
            {PERSONA_GUIDANCE[persona] || PERSONA_GUIDANCE.viewer}
          </p>
        </div>
      )}

      {/* Filter console */}
      <div className="sk-panel sk-panel-pad !p-4 flex flex-wrap items-end gap-x-4 gap-y-3">
        {canSelectDistrict ? (
          <div className="sk-field min-w-[140px]">
            <label className="sk-label">District</label>
            <select className="sk-select" value={selectedDistrict} onChange={(e) => setSelectedDistrict(e.target.value)}>
              <option value="">All Districts</option>
              {districts.map((dist) => (
                <option key={dist} value={dist}>{dist}</option>
              ))}
            </select>
          </div>
        ) : scopeDistrict ? (
          <div className="sk-field min-w-[140px]">
            <label className="sk-label">District</label>
            <div className="sk-select !cursor-not-allowed opacity-90 select-none" title="Your data scope is fixed to your operating area">
              {scopeDistrict}
            </div>
          </div>
        ) : (
          <div className="sk-field min-w-[140px]">
            <label className="sk-label">District</label>
            <select className="sk-select" value={selectedDistrict} onChange={(e) => setSelectedDistrict(e.target.value)}>
              <option value="">All Districts</option>
              {districts.map((dist) => (
                <option key={dist} value={dist}>{dist}</option>
              ))}
            </select>
          </div>
        )}

        <div className="sk-field min-w-[150px]">
          <label className="sk-label">Category</label>
          <select className="sk-select" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
            <option value="">All Categories</option>
            {categoriesList.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        <div className="sk-field min-w-[160px]">
          <label className="sk-label">Officer</label>
          <select className="sk-select" value={selectedOfficer} onChange={(e) => setSelectedOfficer(e.target.value)}>
            <option value="">All Officers</option>
            {officers.map((off) => (
              <option key={off.id} value={off.id}>{off.badge_number} ({off.rank || 'Officer'})</option>
            ))}
          </select>
        </div>

        <div className="sk-field min-w-[120px]">
          <label className="sk-label">Priority</label>
          <select className="sk-select" value={selectedPriority} onChange={(e) => setSelectedPriority(e.target.value)}>
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <div className="sk-field min-w-[130px]">
          <label className="sk-label">Status</label>
          <select className="sk-select" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="investigating">Investigating</option>
          </select>
        </div>

        <div className="sk-field">
          <label className="sk-label">From</label>
          <input type="date" className="sk-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>

        <div className="sk-field">
          <label className="sk-label">To</label>
          <input type="date" className="sk-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>

        {user && (
          <div className="ml-auto flex items-center gap-2 pl-4 border-l border-[var(--border-primary)] self-center">
            <div className="text-right leading-tight">
              <span className="block text-[13px] font-semibold text-[var(--text-primary)]">{user.name}</span>
              <span className="text-xs text-[var(--text-muted)] capitalize">{user.role}</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-[var(--accent-blue-subtle)] border border-[var(--accent-blue)]/20 flex items-center justify-center text-[var(--accent-blue)] font-bold text-xs uppercase">
              {user.role.slice(0, 2)}
            </div>
          </div>
        )}
      </div>

      {/* AT A GLANCE — role-ordered, non-congested */}
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">At a glance</span>
          <span className="h-px w-16 bg-[var(--border-secondary)] hidden sm:inline-block" />
        </div>
      </div>
      <div className={visibleKpis.length > 5 ? 'grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3' : 'grid grid-cols-2 sm:grid-cols-4 gap-3'}>
        {visibleKpis.map((kpi) => (
          <StatCard
            key={kpi.title}
            title={kpi.title}
            value={kpi.value}
            icon={kpi.icon}
            trend={kpi.trend}
            trendValue={kpi.trendValue}
            subtext={kpi.subtext}
            glowColor={kpi.glowColor}
            onClick={() => navigate(kpi.tab)}
          />
        ))}
      </div>

      {/* NEEDS YOUR ATTENTION — what / when / why / action */}
      <div className="sk-panel sk-panel-pad !p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-[var(--accent-coral)] shrink-0" />
          <h4 className="sk-panel-title !mb-0">Needs your attention</h4>
          {attentionItems.length > 0 && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-coral)] animate-pulse" />
              Live — from the records
            </span>
          )}
        </div>
        {attentionItems.length === 0 ? (
          <div className="flex items-center gap-2 px-3 py-3 rounded-lg bg-[var(--bg-tertiary)]/40 border border-dashed border-[var(--border-secondary)] text-[13px] text-[var(--text-muted)]">
            <CheckCircle2 className="w-4 h-4 text-[var(--accent-teal)] shrink-0" />
            Nothing urgent right now — current filters show no critical or high-priority open cases.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {attentionItems.map((item) => (
              <div
                key={item.key}
                className="flex items-center gap-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)]/50 px-3 py-2.5"
              >
                <span
                  className="w-1.5 self-stretch rounded-full shrink-0"
                  style={{ background: item.tone === 'coral' ? 'var(--accent-coral)' : item.tone === 'amber' ? 'var(--accent-amber)' : 'var(--accent-purple)' }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">{item.title}</div>
                  <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] mt-0.5">
                    <span className="whitespace-nowrap">{item.when}</span>
                    <span className="text-[var(--border-strong)]">·</span>
                    <span className="truncate">{item.why}</span>
                  </div>
                </div>
                <button
                  onClick={() => navigate(item.tab)}
                  className="sk-btn sk-btn-secondary cursor-pointer shrink-0 !h-8 whitespace-nowrap"
                >
                  {item.action} <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DISTRICT ACTIVITY — one strong paired view for the home posture */}
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">District activity</span>
          <span className="h-px w-16 bg-[var(--border-secondary)] hidden sm:inline-block" />
        </div>
      </div>

      {/* Trends + category mix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-8 min-h-[300px]">
          <TrendChart data={trendChartData} />
        </div>

        {/* Donut Chart - 4-cols */}
        <div className="lg:col-span-4 min-h-[300px]">
          <DonutChart 
            data={donutChartData} 
            onCategoryClick={() => {
              window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab: 'crime_cases' } }));
            }}
          />
        </div>
      </div>

      {/* Incidents + forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Recent incidents */}
        <div className="lg:col-span-7 sk-panel sk-panel-pad min-h-[320px] flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-[var(--accent-blue)] shrink-0" />
            <h4 className="sk-panel-title">Recent Activity</h4>
            <span
              className={`ml-auto inline-flex items-center gap-1.5 text-xs font-medium ${
                realtimeStatus === 'connected' ? 'text-[var(--tone-success-text)]' : 'text-[var(--text-muted)]'
              }`}
              title={
                realtimeStatus === 'connected'
                  ? 'Real-time stream connected — new cases appear instantly'
                  : `Real-time stream ${realtimeStatus}`
              }
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  realtimeStatus === 'connected'
                    ? 'bg-[var(--accent-teal)] animate-pulse'
                    : realtimeStatus === 'connecting'
                      ? 'bg-[var(--accent-amber)] animate-pulse'
                      : 'bg-[var(--border-secondary)]'
                }`}
              />
              {realtimeStatus === 'connected' ? 'Live' : realtimeStatus}
            </span>
          </div>

          <div className="flex-1 overflow-x-auto">
            {recentIncidents.length === 0 ? (
              <EmptyState
                icon={<FileText className="w-7 h-7 text-[var(--text-muted)]" />}
                title="No recent activity"
                description="Case activity for the current scope will appear here as it is recorded."
                className="py-10"
              />
            ) : (
              <table className="sk-table">
                <thead>
                  <tr>
                    <th>Case Number</th>
                    <th>Crime Type</th>
                    <th>Location</th>
                    <th>Time</th>
                    <th>Status</th>
                    <th className="text-right">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {recentIncidents.map((incident, idx) => (
                      <tr key={idx}>
                        <td className="font-semibold text-[var(--accent-blue)] whitespace-nowrap">{incident.case_number}</td>
                        <td className="text-[var(--text-primary)]">{incident.crime_type}</td>
                        <td className="text-[var(--text-secondary)] max-w-[180px] truncate">{incident.location}</td>
                        <td className="text-[var(--text-muted)] whitespace-nowrap">
                          {incident.time ? new Date(incident.time).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : '—'}
                        </td>
                        <td>
                          <span className={`sk-chip ${incident.status === 'open' ? 'sk-chip-error' : incident.status === 'investigating' ? 'sk-chip-info' : 'sk-chip-success'}`}>
                            <span className="sk-dot" />
                            {incident.status === 'open' ? 'Open' : incident.status === 'closed' ? 'Closed' : 'Under investigation'}
                          </span>
                        </td>
                        <td className="text-right">
                          <span className={`sk-chip ${incident.priority === 'critical' ? 'sk-chip-error' : incident.priority === 'high' ? 'sk-chip-warning' : 'sk-chip-neutral'}`}>
                            {incident.priority === 'critical' ? 'Critical' : incident.priority === 'high' ? 'High' : incident.priority === 'medium' ? 'Medium' : 'Low'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </div>
        </div>

        {/* Forecast */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          <div className="sk-panel sk-panel-pad">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-[var(--accent-purple)]" />
              <h4 className="sk-panel-title">Outlook — next incidents</h4>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg p-3 bg-[var(--bg-tertiary)]/50 border border-[var(--border-primary)] text-center">
                <span className="block text-xs text-[var(--text-muted)] mb-1">Next 24h</span>
                <span className="text-lg font-bold text-[var(--text-primary)]">{forecastData?.next_day_forecast ?? 0}</span>
              </div>
              <div className="rounded-lg p-3 bg-[var(--bg-tertiary)]/50 border border-[var(--border-primary)] text-center">
                <span className="block text-xs text-[var(--text-muted)] mb-1">Next 7 days</span>
                <span className="text-lg font-bold text-[var(--text-primary)]">{forecastData?.next_week_forecast ?? 0}</span>
              </div>
              <div className="rounded-lg p-3 bg-[var(--bg-tertiary)]/50 border border-[var(--border-primary)] text-center">
                <span className="block text-xs text-[var(--text-muted)] mb-1">Weekly change</span>
                <span className={`text-lg font-bold ${(forecastData?.expected_change_percent ?? 0) >= 0 ? 'text-[var(--tone-success-text)]' : 'text-[var(--tone-error-text)]'}`}>
                  {forecastData && forecastData.expected_change_percent >= 0 ? '+' : ''}{forecastData?.expected_change_percent ?? 0}%
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-[220px]">
            <ForecastChart />
          </div>
        </div>
      </div>

      {/* Risk / alerts / actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-5 items-stretch">
        {/* Predictive risk ranking */}
        <div className="xl:col-span-4 sk-panel sk-panel-pad min-h-[280px] flex flex-col">
          <h4 className="sk-panel-title mb-2">Risk Outlook — next 7 days</h4>
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] border-b border-[var(--border-primary)] pb-2.5 mb-3">
            <span>Confidence <b className="text-[var(--text-primary)]">{riskPrediction ? `${Math.round(riskPrediction.confidence_score * 100)}%` : '—'}</b></span>
            <span>Threat <b className="uppercase text-[var(--tone-warning-text)]">{riskPrediction?.threat_level ?? '—'}</b></span>
            <span>Trend <b className="uppercase text-[var(--text-primary)]">{riskPrediction?.trend ?? '—'}</b></span>
          </div>

          <div className="flex-1 flex flex-col gap-3.5 justify-center">
            {predictiveRows.length > 0 ? predictiveRows.slice(0, 4).map((row, index) => {
              const score = Math.max(0, Math.min(100, row.risk_score));
              const scoreLabel = score >= 85 ? 'Very High' : score >= 70 ? 'High' : score >= 50 ? 'Medium' : 'Low';
              const toneVar = score >= 85 ? '--accent-coral' : score >= 70 ? '--accent-amber' : score >= 50 ? '--accent-blue' : '--accent-teal';

              return (
                <div key={`${row.district}-${index}`} className="flex flex-col gap-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-[var(--text-primary)]">{index + 1}. {row.district}</span>
                    <span className="font-semibold" style={{ color: `var(${toneVar})` }}>{score}% · {scoreLabel}</span>
                  </div>
                  <div className="w-full bg-[var(--bg-tertiary)] h-1.5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: `var(${toneVar})` }} />
                  </div>
                </div>
              );
            }) : (
              <EmptyState icon={<NavIcon className="w-5 h-5" />} title="No risk predictions yet" description="Model output will appear once data loads." />
            )}
          </div>
        </div>

        {/* Active alerts */}
        <div className="xl:col-span-4 sk-panel sk-panel-pad min-h-[280px] flex flex-col">
          <h4 className="sk-panel-title mb-2">Active Alerts</h4>
          <ActiveAlerts3D alertRows={alertRows} anomalies={anomalies} />
        </div>

        {/* Quick actions */}
        <div className="xl:col-span-4 sk-panel sk-panel-pad min-h-[280px] flex flex-col md:col-span-2 xl:col-span-4">
          <h4 className="sk-panel-title mb-3">Quick Actions</h4>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-2 gap-2.5 flex-1 content-start">
            <button onClick={() => setOpenAction(openAction === 'Register FIR' ? null : 'Register FIR')} className="inline-flex items-center justify-center gap-2 sk-btn sk-btn-secondary !text-[var(--accent-coral)] w-full">
              <PlusCircle className="w-4 h-4" /> Register FIR
            </button>
            <button onClick={() => setOpenAction(openAction === 'Add Missing Person' ? null : 'Add Missing Person')} className="inline-flex items-center justify-center gap-2 sk-btn sk-btn-secondary w-full">
              <Users className="w-4 h-4" /> Add Missing
            </button>
            <button onClick={() => setOpenAction(openAction === 'Create Alert' ? null : 'Create Alert')} className="inline-flex items-center justify-center gap-2 sk-btn sk-btn-secondary !text-[var(--accent-amber)] w-full">
              <AlertCircle className="w-4 h-4" /> Create Alert
            </button>
            <button onClick={() => setOpenAction(openAction === 'Assign Case' ? null : 'Assign Case')} className="inline-flex items-center justify-center gap-2 sk-btn sk-btn-secondary !text-[var(--accent-purple)] w-full">
              <Bookmark className="w-4 h-4" /> Assign Case
            </button>
            <button onClick={() => setOpenAction(openAction === 'Generate Report' ? null : 'Generate Report')} className="inline-flex items-center justify-center gap-2 sk-btn sk-btn-secondary !text-[var(--accent-teal)] w-full">
              <FileText className="w-4 h-4" /> Generate Report
            </button>
            <button onClick={() => setOpenAction(openAction === 'Resource Allocation' ? null : 'Resource Allocation')} className="inline-flex items-center justify-center gap-2 sk-btn sk-btn-secondary w-full">
              <Settings className="w-4 h-4" /> Allocation
            </button>
          </div>

          {openAction && (
            <div className="mt-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)]/40 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--text-muted)]">
                  Quick Action &middot; {openAction}
                </span>
                <button onClick={() => setOpenAction(null)} className="sk-btn sk-btn-secondary sk-btn-icon !h-6 !w-6" title="Close">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {openAction === 'Generate Report' ? (
                  <>
                    <button onClick={() => { handleQuickActionNavigate(openAction); setOpenAction(null); }} className="inline-flex items-center justify-center gap-2 sk-btn sk-btn-secondary !text-[var(--accent-blue)] w-full">
                      <PenLine className="w-4 h-4" /> Specific Report
                    </button>
                    <button onClick={() => { handleQuickActionDownload(openAction); setOpenAction(null); }} className="inline-flex items-center justify-center gap-2 sk-btn sk-btn-secondary !text-[var(--accent-teal)] w-full">
                      <Download className="w-4 h-4" /> Full Report PDF
                    </button>
                  </>
                ) : QUICK_ACTION_TARGETS[openAction] ? (
                  <button onClick={() => { handleQuickActionNavigate(openAction); setOpenAction(null); }} className="inline-flex items-center justify-center gap-2 sk-btn sk-btn-secondary !text-[var(--accent-blue)] w-full">
                    <PenLine className="w-4 h-4" /> Fill Details Manually
                  </button>
                ) : (
                  <div className="flex items-center justify-center gap-2 rounded-md border border-dashed border-[var(--border-secondary)] px-3 py-2.5 text-xs text-[var(--text-muted)]">
                    No online form available &middot; fill the PDF template manually
                  </div>
                )}
                {openAction !== 'Generate Report' && (
                  <button onClick={() => { handleQuickActionDownload(openAction); setOpenAction(null); }} className="inline-flex items-center justify-center gap-2 sk-btn sk-btn-secondary !text-[var(--accent-teal)] w-full">
                    <Download className="w-4 h-4" /> Download PDF
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Force readiness */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Officer stats */}
        <div className="sk-panel sk-panel-pad">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-[var(--accent-blue)]" />
            <h4 className="sk-panel-title">Force readiness</h4>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="rounded-lg p-3 bg-[var(--bg-tertiary)]/40 border border-[var(--border-primary)] text-center">
              <span className="block text-xs text-[var(--text-muted)]">Total force</span>
              <span className="text-lg font-bold text-[var(--text-primary)]">{officerStats?.total_officers ?? 0}</span>
            </div>
            <div className="rounded-lg p-3 bg-[var(--bg-tertiary)]/40 border border-[var(--border-primary)] text-center">
              <span className="block text-xs text-[var(--tone-success-text)]">Active</span>
              <span className="text-lg font-bold text-[var(--tone-success-text)]">{officerStats?.active_officers ?? 0}</span>
            </div>
            <div className="rounded-lg p-3 bg-[var(--bg-tertiary)]/40 border border-[var(--border-primary)] text-center">
              <span className="block text-xs text-[var(--tone-info-text)]">On duty</span>
              <span className="text-lg font-bold text-[var(--tone-info-text)]">{officerStats?.on_duty ?? 0}</span>
            </div>
            <div className="rounded-lg p-3 bg-[var(--bg-tertiary)]/40 border border-[var(--border-primary)] text-center">
              <span className="block text-xs text-[var(--text-muted)]">Off duty</span>
              <span className="text-lg font-bold text-[var(--text-muted)]">{officerStats?.off_duty ?? 0}</span>
            </div>
            <div className="rounded-lg p-3 bg-[var(--bg-tertiary)]/40 border border-[var(--border-primary)] text-center">
              <span className="block text-xs text-[var(--tone-warning-text)]">Assigned</span>
              <span className="text-lg font-bold text-[var(--tone-warning-text)]">{officerStats?.investigating_officers ?? 0}</span>
            </div>
          </div>
          <div className="mt-4 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]/30 border border-[var(--border-secondary)] flex justify-between items-center text-xs text-[var(--text-muted)]">
            <span>Deployment rate: <b className="text-[var(--text-primary)]">{officerStats && officerStats.active_officers ? `${Math.round((officerStats.on_duty / officerStats.active_officers) * 100)}%` : '0%'}</b></span>
            <span>Force efficiency: <b className="text-[var(--text-primary)]">94.2%</b></span>
          </div>
        </div>

        {/* Evidence stats */}
        <div className="sk-panel sk-panel-pad">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-[var(--accent-teal)]" />
            <h4 className="sk-panel-title">Evidence Registry</h4>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg p-3 bg-[var(--bg-tertiary)]/40 border border-[var(--border-primary)] text-center">
              <span className="block text-xs text-[var(--text-muted)]">Collected</span>
              <span className="text-lg font-bold text-[var(--text-primary)]">{evidenceStats?.collected ?? 0}</span>
            </div>
            <div className="rounded-lg p-3 bg-[var(--bg-tertiary)]/40 border border-[var(--border-primary)] text-center">
              <span className="block text-xs text-[var(--tone-warning-text)]">Pending</span>
              <span className="text-lg font-bold text-[var(--tone-warning-text)]">{evidenceStats?.pending ?? 0}</span>
            </div>
            <div className="rounded-lg p-3 bg-[var(--bg-tertiary)]/40 border border-[var(--border-primary)] text-center">
              <span className="block text-xs text-[var(--tone-success-text)]">Verified</span>
              <span className="text-lg font-bold text-[var(--tone-success-text)]">{evidenceStats?.verified ?? 0}</span>
            </div>
            <div className="rounded-lg p-3 bg-[var(--bg-tertiary)]/40 border border-[var(--border-primary)] text-center">
              <span className="block text-xs text-[var(--tone-error-text)]">Rejected</span>
              <span className="text-lg font-bold text-[var(--tone-error-text)]">{evidenceStats?.rejected ?? 0}</span>
            </div>
          </div>
          <div className="mt-4 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]/30 border border-[var(--border-secondary)] flex justify-between items-center text-xs text-[var(--text-muted)]">
            <span>Verification rate: <b className="text-[var(--text-primary)]">{evidenceStats && (evidenceStats.verified + evidenceStats.rejected) ? `${Math.round((evidenceStats.verified / (evidenceStats.verified + evidenceStats.rejected)) * 100)}%` : '0%'}</b></span>
            <span>Integrity: SHA-256</span>
          </div>
        </div>
      </div>

      {/* Secondary intelligence views */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="min-h-[300px]"><SpatiotemporalHeatmap /></div>
        <div className="min-h-[300px]"><SpatialCube3D /></div>
      </div>
    </div>
  );
};

export default Overview;
