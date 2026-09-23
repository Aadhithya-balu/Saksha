import type { UserRole } from '../store/authStore';

const DEFAULT_API_BASE_URL = '/api/v2';
const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.toString().trim();
const normalizedConfiguredApiBaseUrl = configuredApiBaseUrl && configuredApiBaseUrl !== ''
  ? configuredApiBaseUrl.replace(/\/+$/, '')
  : undefined;

export const API_BASE_URL = normalizedConfiguredApiBaseUrl ?? DEFAULT_API_BASE_URL;

export let isEmulatorActive = false;

export function setEmulatorActive(active: boolean) {
  if (isEmulatorActive !== active) {
    isEmulatorActive = active;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('emulator-status-changed', { detail: active }));
    }
  }
}

const ACCESS_TOKEN_KEY = 'saksha_access_token';
const REFRESH_TOKEN_KEY = 'saksha_refresh_token';

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}


export interface PaginatedResponse<T> {
  total: number;
  page: number;
  page_size: number;
  results: T[];
}

export interface CrimeCaseRecord {
  id: string;
  case_number: string;
  category_id: string;
  location_id: string;
  occurred_at: string;
  reported_at: string;
  description: string | null;
  mo_tags: string | null;
  status: string;
  created_at: string;
}

export interface CriminalRecord {
  id: string;
  full_name: string;
  aliases: string | null;
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  identifying_marks: string | null;
  mo_summary: string | null;
  status: string;
  created_at: string;
}

export interface OffenderDossier {
  id: string;
  name: string;
  alias: string;
  age: number;
  gender: string;
  classification: 'A-CATEGORY' | 'B-CATEGORY' | 'WATCHLIST';
  activeDistricts: string[];
  status: 'ACTIVE' | 'INCARCERATED' | 'UNDER_SURVEILLANCE';
  riskScore: number;
  gangAffiliation: string;
  mugshotDesc: string;
}

export interface OffenderDossiersResponse {
  offenders: OffenderDossier[];
}
export interface BackendUser {
  id: string;
  username: string;
  email: string;
  full_name: string;
  district: string | null;
  station: string | null;
  is_active: boolean;
  role: string;
  created_at: string;
}

export interface DashboardSummary {
  total_crimes: number;
  open_crimes: number;
  total_firs: number;
  total_criminals: number;
  resolution_rate_percent: number;
}

export interface TrendPoint {
  date: string;
  count: number;
}

export interface CategoryPoint {
  category: string;
  count: number;
}

export interface DistrictComparisonPoint {
  district: string;
  count: number;
}

export interface RiskScorePoint {
  district: string;
  risk_score: number;
  confidence?: number;
}

export interface RiskScoresResponse {
  district_id: string | null;
  window: string;
  grid_predictions: RiskScorePoint[];
  model_version: string;
  /** Authoritative status metadata (issue 9) — 'ML' | 'FALLBACK' | 'UNAVAILABLE' | ... */
  prediction_mode?: string;
  risk_model_loaded?: boolean | null;
  data_provenance?: string;
}

export interface HotspotPoint {
  district_id: string;
  name: string;
  lat: number;
  lng: number;
  score: number;
  category: string;
  trend: string;
}

export interface HotspotsResponse {
  hotspots: HotspotPoint[];
  hour?: number | null;
  /** Authoritative status metadata (issue 9). */
  analysis_mode?: string;
  data_provenance?: string;
  statistics?: {
    method?: string;
    locations_assessed?: number;
    incidents_assessed?: number;
    [key: string]: unknown;
  };
}

export interface StationSummary {
  district: string;
  station: string;
  lat: number;
  lng: number;
  total_cases: number;
  recent_30d: number;
  prior_30d: number;
  open_cases: number;
  top_category: string;
  top_category_count: number;
  trend: 'up' | 'down' | 'stable';
  last_incident_at: string | null;
  risk_score: number;
}

export interface StationsSummaryResponse {
  stations: StationSummary[];
  count: number;
  source: string;
}

export interface RedZone {
  district: string;
  category: string;
  current_count: number;
  baseline_count: number;
  spike_ratio: number;
  severity: 'high' | 'critical';
  stations: string[];
  window: string;
}

export interface RedZonesResponse {
  generated_at: string;
  thresholds: { min_current: number; ratio_threshold: number };
  red_zones: RedZone[];
}

export interface RedZoneNotifyResponse {
  status: string;
  zones_detected: number;
  created: number;
  skipped: number;
  broadcast_by: string;
}

export interface AnomalyRecord {
  case_id: string;
  case_uuid?: string;
  case_number?: string;
  district?: string | null;
  station?: string | null;
  category?: string | null;
  filed_at?: string | null;
  label: string;
  score: number;
  reason: string;
}

export interface AnomaliesResponse {
  anomalies: AnomalyRecord[];
}

export type NetworkNodeCategory = 'suspect' | 'offender' | 'case' | 'location' | 'victim' | 'gang' | 'vehicle' | 'weapon' | 'officer' | 'evidence';

export interface NetworkNode {
  id: string;
  name: string;
  category: NetworkNodeCategory;
  /** Risk score 0-100. Optional: not every node has a computed risk score. */
  riskScore?: number;
  details: string;
  casesCount: number;
  phone?: string | null;
  gangAffiliation?: string | null;
  status?: string | null;
  district?: string | null;
  date?: string | null;
  lat?: number | null;
  lng?: number | null;
  extra?: Record<string, any>;
  /** True when the record originates from the bundled demo seed dataset (gap 132.4). */
  isSeed?: boolean;
}

export interface RelationshipEvidenceItem {
  record_type?: string;
  record_id?: string;
  record_number?: string;
  details?: string;
  timestamp?: string | null;
  sections?: string;
  factors?: string[];
}

export interface NetworkEdge {
  source: string;
  target: string;
  relationship: string;
  weight?: number;
  first_seen?: string | null;
  last_seen?: string | null;
  provenance?: 'DIRECT_DATABASE' | 'ANALYTICAL_INFERENCE' | 'DEMO_SEED' | 'MIXED' | 'UNKNOWN' | string;
  verification_status?: 'VERIFIED' | 'POTENTIAL' | 'UNVERIFIED' | 'DEMO' | 'RESTRICTED' | string;
  relationship_type?: string;
  evidence?: RelationshipEvidenceItem[];
  confidence?: number | null;
  confidence_level?: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN' | string;
  is_demo_derived?: boolean;
  operational_warning?: string | null;
}

export interface ProvenanceSummary {
  total_nodes: number;
  total_edges: number;
  verified_relationships: number;
  analytical_relationships: number;
  potential_relationships: number;
  demo_relationships: number;
  mixed_relationships: number;
  unknown_relationships: number;
}

export interface NetworkResponse {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}

export interface NetworkGraphResponse {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  total_nodes: number;
  total_edges: number;
  is_neo4j_backed: boolean;
  seed_node_count?: number;
  dataset_scope?: 'live_records' | 'contains_seed_demo_records' | string;
  provenance_summary?: ProvenanceSummary;
  entity_counts?: Record<string, number>;
  warnings?: string[];
  confidence_summary?: Record<string, number>;
}

export interface GangHierarchyMember {
  id: string;
  name: string;
  role: string;
  rank_level: number;
  riskScore: number;
  status: string;
  casesCount: number;
  isSeed?: boolean;
}

export interface GangNetworkSummary {
  gang_id: string;
  name: string;
  leader_name: string;
  leader_id?: string | null;
  active_members: number;
  risk_level: string;
  territory: string;
  primary_racket: string;
  members: GangHierarchyMember[];
  relationships: NetworkEdge[];
  is_demo_derived?: boolean;
}

export interface ShortestPathResult {
  found: boolean;
  distance: number;
  path_nodes: NetworkNode[];
  path_edges: NetworkEdge[];
  explanation: string;
}

export type NetworkPathEntityCategory =
  | 'suspect'
  | 'offender'
  | 'victim'
  | 'officer';
export type NetworkPathEntityCategoryRaw =
  | NetworkPathEntityCategory
  | NetworkNodeCategory
  | 'case'
  | 'location'
  | 'gang'
  | 'vehicle'
  | 'weapon';

export interface NetworkPathNodeRecord {
  id: string;
  name: string;
  category: NetworkPathEntityCategoryRaw;
  riskScore?: number;
  casesCount?: number;
  district?: string | null;
  status?: string | null;
  isSeed?: boolean;
}

export interface NetworkPathRelationshipRecord {
  source_id: string;
  target_id: string;
  relationship_type: string;
  relationship: string;
  fir_numbers: string[];
  case_numbers: string[];
  crime_types: string[];
  districts: string[];
  stations: string[];
  dates: string[];
  roles: Record<string, string>;
}

export interface NetworkPathResponse {
  found: boolean;
  distance: number;
  source?: NetworkPathNodeRecord | null;
  target?: NetworkPathNodeRecord | null;
  nodes: NetworkPathNodeRecord[];
  relationships: NetworkPathRelationshipRecord[];
  message: string;
  explanation?: string;
  summary?: {
    entities: number;
    hops: number;
    supporting_firs: number;
    crime_types: number;
    districts: number;
  };
}

export async function findNetworkPath(
  sourceId: string,
  targetId: string,
  maxHops: number,
  filters?: NetworkFilterParams
): Promise<NetworkPathResponse> {
  const params: Record<string, string | number> = {
    source_id: sourceId,
    target_id: targetId,
    max_hops: maxHops,
  };
  if (filters) {
    if (filters.criminalName) params.criminal_name = filters.criminalName;
    if (filters.crimeTypes?.length) params.crime_type = filters.crimeTypes.join(',');
    if (filters.districts?.length) params.district = filters.districts.join(',');
    if (filters.policeStations?.length) params.police_station = filters.policeStations.join(',');
    if (filters.firNumbers?.length) params.fir_number = filters.firNumbers.join(',');
    if (filters.victimName) params.victim_name = filters.victimName;
    if (filters.dateFrom) params.date_from = filters.dateFrom;
    if (filters.dateTo) params.date_to = filters.dateTo;
  }
  return apiRequest<NetworkPathResponse>(`/network/path${buildQueryString(params)}`);
}

export interface CentralityMetric {
  node_id: string;
  node_name: string;
  category: string;
  degree_centrality: number;
  betweenness_score: number;
  is_bridge_node: boolean;
  riskScore: number;
}

export interface LinkAnalysisData {
  graph_density: number;
  total_clusters: number;
  top_broker_nodes: CentralityMetric[];
  high_impact_nodes: CentralityMetric[];
  bridge_nodes: CentralityMetric[];
}

export interface AIGraphInsightData {
  id: string;
  insight_type: string;
  title: string;
  description: string;
  threat_level: string;
  target_node_ids: string[];
  recommendation: string;
  timestamp: string;
}

export interface ChatCitation {
  source: string;
  title: string;
  score: number;
}

export interface ChatQueryResponse {
  answer: string;
  data: Array<Record<string, unknown>>;
  sources: string[];
  chart_suggestion: string | null;
  citations?: ChatCitation[];
  summary?: string;
  entities?: string[];
  classification?: string;
  engine?: string | null;
}

/* --- Persistent AI chat history --- */

export interface ChatHistoryMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  classification?: string | null;
  sources?: string[] | null;
  citations?: ChatCitation[] | null;
  created_at: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  is_temporary: boolean;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationDetail extends ConversationSummary {
  messages: ChatHistoryMessage[];
  total_messages: number;
}

export interface ConversationListResponse {
  items: ConversationSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateConversationPayload {
  title?: string;
  temporary?: boolean;
  messages?: Array<{
    role: 'user' | 'assistant';
    content: string;
    classification?: string;
    sources?: string[];
    citations?: ChatCitation[];
  }>;
}

export interface ReportRecord {
  id: string;
  report_type: string;
  template: string;
  title: string | null;
  district: string | null;
  status: string;
  format: string;
  file_url: string | null;
  provenance: string;
  version: number;
  integrity_hash: string | null;
  generation_method: string | null;
  ai_reported: boolean;
  source_record_count: number;
  evidence_count: number;
  case_id: string | null;
  created_at: string;
  updated_at: string | null;
  requested_by: string | null;
}

export interface ReportSourceRef {
  source_type: string;
  source_id: string;
  source_label?: string | null;
}

export interface ReportAuditEntry {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  result: string;
  details: string | null;
  ip: string | null;
}

export interface ReportDetail extends ReportRecord {
  case_number: string | null;
  failure_reason: string | null;
  generated_at: string | null;
  reviewed_at: string | null;
  finalized_at: string | null;
  archived_at: string | null;
  reviewed_by: string | null;
  finalized_by: string | null;
  ai_metadata: Record<string, unknown> | null;
  snapshot_headers: string[];
  snapshot_row_count: number;
  sources: Array<{ source_type: string; source_id: string; source_label: string | null }>;
  evidence: Array<{ evidence_id: string; title: string | null; evidence_type: string | null; role: string }>;
  versions: Array<{ id: string; version_number: number; created_at: string; reason: string | null; status: string; integrity_hash: string | null; created_by: string | null }>;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const hasWindow = typeof window !== 'undefined';

// Security: tokens are kept in sessionStorage (per-tab, cleared when the
// browser tab closes) rather than localStorage (indefinite persistence).
// This shrinks the XSS theft window. The Bearer-token architecture keeps the
// API immune to CSRF, so no cookie-based auth is used.
export const getStoredTokens = (): AuthTokens => ({
  accessToken: hasWindow ? window.sessionStorage.getItem(ACCESS_TOKEN_KEY) ?? '' : '',
  refreshToken: hasWindow ? window.sessionStorage.getItem(REFRESH_TOKEN_KEY) ?? '' : '',
});

export const setStoredTokens = (tokens: AuthTokens) => {
  if (!hasWindow) {
    return;
  }

  window.sessionStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  window.sessionStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
};

export const clearStoredTokens = () => {
  if (!hasWindow) {
    return;
  }

  window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
};

export const mapBackendRoleToUiRole = (role: string): UserRole => {
  switch (role) {
    case 'admin':
      return 'ADMIN';
    case 'crime_analyst':
      return 'SCRB';
    case 'investigator':
      return 'IO';
    case 'inspector':
      return 'INSPECTOR';
    case 'policymaker':
      return 'SP';
    case 'forensic':
      return 'FORENSIC';
    case 'viewer':
      return 'VIEWER';
    default:
      // Fail closed: an unrecognised backend role must not be granted
      // analyst-level clearance. Least privilege is read-only.
      return 'VIEWER';
  }
};

const buildQueryString = (params?: Record<string, string | number | boolean | null | undefined>) => {
  if (!params) {
    return '';
  }

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      return;
    }

    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

const readErrorMessage = async (response: Response) => {
  try {
    const payload = await response.json();
    if (payload?.error?.message) return String(payload.error.message);
    const detail = payload?.detail;
    if (!detail) return payload?.message || response.statusText;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail.map((err: any) => {
        const field = err.loc && err.loc.length > 1 ? err.loc.slice(1).join('.') : '';
        return `${field ? `Field '${field}': ` : ''}${err.msg || 'Invalid value'}`;
      }).join('; ');
    }
    if (typeof detail === 'object') return JSON.stringify(detail);
    return String(detail);
  } catch {
    return response.statusText;
  }
};

// Tracks in-flight resilient retries of safe (GET) requests that hit a
// transient DB pool exhaustion, so they retry at most once per path.
const busyRetryKeys = new Set<string>();

// Tracks an ongoing degraded period so the UI can show a persistent "DB lost"
// alert once failures last >1 min, and clear it when traffic recovers.
let backendBusy = false;

const markBackendHealthy = () => {
  if (backendBusy) {
    backendBusy = false;
    window.dispatchEvent(new CustomEvent('system:backend-ok'));
  }
};

export async function apiRequest<T>(path: string, options: RequestInit = {}, includeAuth = true): Promise<T> {
  const { accessToken } = getStoredTokens();

  const headers = new Headers(options.headers ?? {});

  if (includeAuth && accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (err) {
    backendBusy = true;
    window.dispatchEvent(new CustomEvent('system:backend-busy', {
      detail: {
        message: 'Connection to the backend was lost. The database may be temporarily throttled. Please wait a moment.',
      },
    }));
    throw err;
  }

  if (response.status === 401 && !path.startsWith('/auth/')) {
    clearStoredTokens();
    window.dispatchEvent(new CustomEvent('auth:session-expired'));
    throw new Error('Session expired. Please log in again.');
  }

  // Transient infrastructure pressure (DB pool exhaustion, cold start, DB
  // warm-up) is not a hard failure: notify the UI so the operator knows to wait,
  // and automatically retry once safe reads AND auth requests so login keeps
  // working through a blip.
  if (response.status === 503) {
    let code = '';
    let detail = '';
    try {
      const payload = await response.clone().json();
      code = payload?.error?.code ?? payload?.detail?.code ?? '';
      detail = payload?.error?.message ?? payload?.detail?.message ?? '';
    } catch {
      // non-JSON 503 body (e.g. nginx boot-window response)
    }
    const TRANSIENT_CODES = new Set(['DB_POOL_EXHAUSTED', 'SERVICE_UNAVAILABLE', 'STARTING', 'BACKEND_BOOTING']);
    if (TRANSIENT_CODES.has(code) || code === '') {
      backendBusy = true;
      const message = detail
        ? `${detail} We'll retry automatically in a few seconds.`
        : 'The system is temporarily under load or still warming up. Please wait a moment and try again.';
      window.dispatchEvent(new CustomEvent('system:backend-busy', { detail: { message } }));
      // GETs are retry-safe; auth login/refresh is retried once so users can
      // log in even through a transient blip (POSTs elsewhere are NOT retried).
      const method = (options.method ?? 'GET').toUpperCase();
      const isAuthRetryable = path.startsWith('/auth/login') || path.startsWith('/auth/refresh');
      const isSafeRead = method === 'GET';
      const isRetryable = isSafeRead || isAuthRetryable;
      const retryKey = `DB_POOL_EXHAUSTED:${method}:${path}`;
      if (!busyRetryKeys.has(retryKey) && isRetryable) {
        busyRetryKeys.add(retryKey);
        try {
          const retryAfter = Math.min(Math.max(Number(response.headers.get('Retry-After')) || 5, 3), 15);
          await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
          return await apiRequest<T>(path, options, includeAuth);
        } finally {
          busyRetryKeys.delete(retryKey);
        }
      }
      throw new Error(message);
    }
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  if (response.status === 204) {
    markBackendHealthy();
    return undefined as T;
  }

  markBackendHealthy();
  return response.json() as Promise<T>;
}

// --- Issue #190 §3 / §5: Runtime data mode -------------------------------
// Consumed by the global DataModeBadge and any page that needs to know
// whether demo/seed fallback is permitted and whether the source is live.
export interface SystemDataModeResponse {
  mode: 'production' | 'demo' | 'test';
  allow_demo_fallback: boolean;
  show_demo_badges: boolean;
  provenance: Record<string, Record<string, number>>;
  seed_record_count: number;
  live_record_count: number;
}

export async function getSystemDataMode(): Promise<SystemDataModeResponse> {
  return apiRequest<SystemDataModeResponse>('/system/data-mode', {}, false);
}
export async function login(username: string, password: string) {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  }, false);
}

export async function logout() {
  // Send the refresh token so the backend can revoke it server-side
  // (rotation denylist) before the client discards its copy.
  const { refreshToken } = getStoredTokens();
  try {
    return await apiRequest<{ message: string }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken || null }),
    });
  } finally {
    clearStoredTokens();
  }
}

export async function refreshSession(refreshToken: string) {
  return apiRequest<LoginResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  }, false);
}

export async function getMe() {
  return apiRequest<BackendUser>('/auth/me');
}

export async function updateProfile(payload: {
  full_name?: string;
  email?: string;
  district?: string;
  station?: string;
}) {
  return apiRequest<BackendUser>('/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function changePassword(oldPassword: string, newPassword: string) {
  return apiRequest<{ message: string }>('/auth/change-password', {
    method: 'PUT',
    body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
  });
}

export interface DashboardFilters {
  date_from?: string;
  date_to?: string;
  district?: string;
  category_id?: string;
  officer_id?: string;
  priority?: string;
  status?: string;
}

export interface OfficerStats {
  total_officers: number;
  active_officers: number;
  on_duty: number;
  off_duty: number;
  investigating_officers: number;
}

export interface EvidenceStats {
  collected: number;
  pending: number;
  verified: number;
  rejected: number;
}

export interface RecentIncident {
  case_number: string;
  crime_type: string;
  location: string;
  time: string | null;
  status: string;
  priority: string;
}

export interface ForecastPoint {
  day: string;
  value: number;
  type: 'historical' | 'predicted' | 'today';
  color: number;
  hexColor: string;
}

export interface ForecastResponse {
  next_day_forecast: number;
  next_week_forecast: number;
  expected_change_percent: number;
  trend_direction: 'up' | 'down' | 'stable';
  series: ForecastPoint[];
}

export interface RiskPredictionResponse {
  crime_risk_percent: number;
  threat_level: 'Low' | 'Medium' | 'High' | 'Critical';
  trend: 'increasing' | 'decreasing' | 'stable';
  confidence_score: number;
  prediction_time: string;
}

export async function getDashboardSummary(filters?: DashboardFilters) {
  return apiRequest<DashboardSummary>(`/dashboard/summary${buildQueryString(filters as any)}`);
}

export async function getCrimeTrends(filters?: DashboardFilters) {
  return apiRequest<TrendPoint[]>(`/dashboard/crime-trends${buildQueryString(filters as any)}`);
}

export async function getCategoryBreakdown(filters?: DashboardFilters) {
  return apiRequest<CategoryPoint[]>(`/dashboard/category-breakdown${buildQueryString(filters as any)}`);
}

export async function getDistrictComparison(filters?: DashboardFilters) {
  return apiRequest<DistrictComparisonPoint[]>(`/dashboard/district-comparison${buildQueryString(filters as any)}`);
}

export async function getOfficerStats() {
  return apiRequest<OfficerStats>('/dashboard/officer-stats');
}

export async function getEvidenceStats() {
  return apiRequest<EvidenceStats>('/dashboard/evidence-stats');
}

export async function getRecentIncidents() {
  return apiRequest<RecentIncident[]>('/dashboard/recent-incidents');
}

export async function getForecast() {
  return apiRequest<ForecastResponse>('/dashboard/forecast');
}

export async function getRiskPrediction() {
  return apiRequest<RiskPredictionResponse>('/dashboard/risk-prediction');
}

export async function getRiskScores(window = 'next_7d', districtId?: string) {
  return apiRequest<RiskScoresResponse>(`/ai/predictions/risk-scores${buildQueryString({ window, district_id: districtId })}`);
}

export async function getHotspots(districtId?: string, hour?: number) {
  return apiRequest<HotspotsResponse>(`/ai/hotspots${buildQueryString({ district_id: districtId, hour })}`);
}

export async function getAnomalies() {
  return apiRequest<AnomaliesResponse>('/ai/predictions/anomalies');
}

export async function getStationsSummary(params?: { district?: string; q?: string }) {
  return apiRequest<StationsSummaryResponse>(`/stations/summary${buildQueryString({ district: params?.district, q: params?.q })}`);
}

export async function getRedZones(minCurrent = 3, ratioThreshold = 1.5) {
  return apiRequest<RedZonesResponse>(`/alerts/red-zones${buildQueryString({ min_current: minCurrent, ratio_threshold: ratioThreshold })}`);
}

export async function broadcastRedZones(minCurrent = 3, ratioThreshold = 1.5) {
  return apiRequest<RedZoneNotifyResponse>(`/alerts/red-zones/notify${buildQueryString({ min_current: minCurrent, ratio_threshold: ratioThreshold })}`, { method: 'POST' });
}

export async function getNetworkPerson(
  personId: string,
  depth = 1,
  provenanceFilter?: string,
  excludeDemo?: boolean
) {
  return apiRequest<NetworkGraphResponse>(
    `/network/person/${encodeURIComponent(personId)}${buildQueryString({
      depth,
      provenance_filter: provenanceFilter,
      exclude_demo: excludeDemo,
    })}`
  );
}

export interface NetworkSearchResult {
  id: string;
  type: 'criminal' | 'victim' | 'officer' | 'case' | 'location';
  name: string;
  detail: string;
  status?: string;
  risk_score?: number;
}

export async function searchNetworkEntities(query: string, limit = 20) {
  return apiRequest<{ results: NetworkSearchResult[]; query: string; total: number }>(
    `/network/search${buildQueryString({ q: query, limit })}`
  );
}

export async function getNetworkCase(
  caseId: string,
  provenanceFilter?: string,
  excludeDemo?: boolean
) {
  return apiRequest<NetworkGraphResponse>(
    `/network/case/${encodeURIComponent(caseId)}${buildQueryString({
      provenance_filter: provenanceFilter,
      exclude_demo: excludeDemo,
    })}`
  );
}

export interface NetworkFilterParams {
  criminalName?: string;
  crimeTypes?: string[];
  districts?: string[];
  policeStations?: string[];
  firNumbers?: string[];
  victimName?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function getFullNetworkGraph(
  categoryFilter?: string,
  minRisk?: number,
  provenanceFilter?: string,
  excludeDemo?: boolean,
  filters?: NetworkFilterParams
) {
  return apiRequest<NetworkGraphResponse>(
    `/network/graph${buildQueryString({
      category_filter: categoryFilter,
      min_risk: minRisk,
      provenance_filter: provenanceFilter,
      exclude_demo: excludeDemo,
      criminal_name: filters?.criminalName,
      crime_type: filters?.crimeTypes?.length ? filters.crimeTypes.join(',') : undefined,
      district: filters?.districts?.length ? filters.districts.join(',') : undefined,
      police_station: filters?.policeStations?.length ? filters.policeStations.join(',') : undefined,
      fir_number: filters?.firNumbers?.length ? filters.firNumbers.join(',') : undefined,
      victim_name: filters?.victimName,
      date_from: filters?.dateFrom,
      date_to: filters?.dateTo,
    })}`
  );
}

export async function getGangNetworks() {
  return apiRequest<GangNetworkSummary[]>('/network/gangs');
}

export async function calculateShortestPath(sourceId: string, targetId: string, maxDepth = 5) {
  return apiRequest<ShortestPathResult>('/network/shortest-path', {
    method: 'POST',
    body: JSON.stringify({ source_id: sourceId, target_id: targetId, max_depth: maxDepth }),
  });
}

export async function getLinkAnalysis() {
  return apiRequest<LinkAnalysisData>('/network/link-analysis', {
    method: 'POST',
  });
}

export async function getAIGraphInsights() {
  return apiRequest<AIGraphInsightData[]>('/network/insights');
}

export async function triggerNeo4jSync() {
  return apiRequest<{ status: string; message: string; neo4j_active: boolean }>('/network/sync-neo4j', {
    method: 'POST',
  });
}

export async function chatQuery(message: string, sessionId?: string, options?: { conversationId?: string | null; persist?: boolean }) {
  return apiRequest<ChatQueryResponse>('/ai/chat/query', {
    method: 'POST',
    body: JSON.stringify({
      message,
      session_id: sessionId ?? null,
      conversation_id: options?.conversationId ?? null,
      persist: options?.persist ?? true,
    }),
  });
}

export interface ChatStreamChunk {
  type: 'status' | 'token' | 'final' | 'error' | 'meta' | 'notice';
  content: any;
}

export interface ChatStreamOptions {
  conversationId?: string | null;
  persist?: boolean;
}

export async function* chatQueryStream(
  message: string,
  sessionId?: string,
  options?: ChatStreamOptions,
): AsyncGenerator<ChatStreamChunk, void, unknown> {
  const { accessToken: token } = getStoredTokens();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}/ai/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message,
      session_id: sessionId ?? null,
      stream: true,
      conversation_id: options?.conversationId ?? null,
      persist: options?.persist ?? true,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Chat API error ${response.status}: ${errText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Response body is not readable');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const chunk: ChatStreamChunk = JSON.parse(trimmed);
        yield chunk;
      } catch {
        // skip malformed lines
      }
    }
  }

  if (buffer.trim()) {
    try {
      const chunk: ChatStreamChunk = JSON.parse(buffer.trim());
      yield chunk;
    } catch {
      // ignore
    }
  }
}

/* --- Conversation history management --- */

export async function listConversations(params?: { q?: string; limit?: number; offset?: number }) {
  return apiRequest<ConversationListResponse>(`/ai/chat-history/conversations${buildQueryString(params)}`);
}

export async function getConversation(id: string, params?: { limit?: number; offset?: number }) {
  return apiRequest<ConversationDetail>(`/ai/chat-history/conversations/${id}${buildQueryString(params)}`);
}

export async function createConversation(payload: CreateConversationPayload = {}) {
  return apiRequest<ConversationDetail>('/ai/chat-history/conversations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateConversation(
  id: string,
  payload: { title?: string; is_temporary?: boolean },
) {
  return apiRequest<ConversationSummary>(`/ai/chat-history/conversations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteConversation(id: string) {
  return apiRequest<void>(`/ai/chat-history/conversations/${id}`, { method: 'DELETE' });
}

export async function deleteAllConversations() {
  return apiRequest<{ deleted: number }>('/ai/chat-history/conversations', { method: 'DELETE' });
}

export async function appendConversationMessage(
  id: string,
  payload: {
    role: 'user' | 'assistant';
    content: string;
    classification?: string;
    sources?: string[];
    citations?: ChatCitation[];
  },
) {
  return apiRequest<ChatHistoryMessage>(`/ai/chat-history/conversations/${id}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listCrimes(page = 1, pageSize = 100) {
  return apiRequest<PaginatedResponse<CrimeCaseRecord>>(`/crimes${buildQueryString({ page, page_size: pageSize })}`);
}

export async function listCriminals(q?: string, page = 1, pageSize = 100) {
  return apiRequest<PaginatedResponse<CriminalRecord>>(`/criminals${buildQueryString({ q, page, page_size: pageSize })}`);
}

export async function createCriminal(payload: Partial<CriminalRecord>) {
  return apiRequest<CriminalRecord>('/criminals', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getCriminal(criminalId: string) {
  return apiRequest<CriminalRecord & {
    firs: Array<{ id: string; fir_number: string; complainant_name: string; status: string; filed_at: string | null; sections: string | null; crime_case_id: string | null; crime_case_number: string | null }>;
    ai_risk: { risk_score: number; risk_band: string; confidence: number; top_factors: string[] };
    ai_repeat: { will_reoffend: boolean; probability: number; risk_factors: string[] };
    ai_similar: { similar: Array<{ criminal_id: string; name: string; similarity: number; rank: number; matching_factors: string[]; match_level: string }> };
    ai_recommendations: string[];
    network: { nodes: NetworkNode[]; edges: NetworkEdge[] };
    neo4j_node_id: string | null;
    gang_affiliation: string | null;
    image_url: string | null;
  }>(`/criminals/${criminalId}`);
}

export async function updateCriminal(
  criminalId: string,
  payload: {
    status?: string;
    full_name?: string;
    aliases?: string | null;
    gender?: string | null;
    date_of_birth?: string | null;
    address?: string | null;
    identifying_marks?: string | null;
    mo_summary?: string | null;
    gang_affiliation?: string | null;
  },
) {
  return apiRequest<CriminalRecord>(`/criminals/${criminalId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function getOffenderDossiers() {
  return apiRequest<OffenderDossiersResponse>('/ai/offenders/dossiers');
}

export async function listReports(page = 1, pageSize = 100) {
  return apiRequest<PaginatedResponse<ReportRecord>>(`/reports${buildQueryString({ page, page_size: pageSize })}`);
}

// --- Issue #176: Production report lifecycle API ---
export async function createReport(payload: {
  report_type: string;
  title?: string;
  case_id?: string;
  district?: string;
  format?: string;
  provenance?: string;
  ai_reported?: boolean;
}) {
  return apiRequest<ReportDetail>('/reports', { method: 'POST', body: JSON.stringify(payload) });
}

export async function getReportDetail(reportId: string) {
  return apiRequest<ReportDetail>(`/reports/${reportId}`);
}

export async function generateReportContent(
  reportId: string,
  payload: {
    content?: { headers: string[]; rows: Array<Array<string | number | null>> };
    title?: string;
    sources?: ReportSourceRef[];
    evidence_ids?: string[];
    ai_metadata?: Record<string, unknown>;
    require_verified_references?: boolean;
    analysis_fingerprint?: string;
  },
) {
  return apiRequest<ReportDetail>(`/reports/${reportId}/generate`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function validateReportReferences(
  reportId: string,
  payload: { sources: ReportSourceRef[]; evidence_ids: string[] },
) {
  return apiRequest<{ verified_records: ReportSourceRef[]; missing_records: ReportSourceRef[]; can_finalize_as_verified: boolean }>(
    `/reports/${reportId}/validate`,
    { method: 'POST', body: JSON.stringify(payload) },
  );
}

export async function reviewReport(reportId: string, notes?: string) {
  return apiRequest<ReportDetail>(`/reports/${reportId}/review`, {
    method: 'POST',
    body: JSON.stringify({ notes: notes ?? null }),
  });
}

export async function finalizeReport(reportId: string, notes?: string) {
  return apiRequest<ReportDetail>(`/reports/${reportId}/finalize`, {
    method: 'POST',
    body: JSON.stringify({ notes: notes ?? null }),
  });
}

export async function archiveReport(reportId: string) {
  return apiRequest<ReportDetail>(`/reports/${reportId}/archive`, { method: 'POST' });
}

export async function createReportVersion(reportId: string, reason?: string) {
  return apiRequest<ReportDetail>(`/reports/${reportId}/versions`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason ?? null }),
  });
}

export async function getReportAudit(reportId: string, page = 1, pageSize = 20) {
  return apiRequest<PaginatedResponse<ReportAuditEntry>>(
    `/reports/${reportId}/audit${buildQueryString({ page, page_size: pageSize })}`,
  );
}

export async function downloadManagedReport(reportId: string, format: 'pdf' | 'csv' | 'docx' | 'txt' | 'xlsx') {
  return apiRequest<unknown>(`/reports/${reportId}/download?export_format=${format}`, { method: 'GET' });
}

// --- Crime Case Management Types & Routes ---

export interface InvestigationNote {
  id: string;
  officer_name: string;
  officer_badge: string;
  created_at: string;
  content: string;
}

export interface TimelineEvent {
  timestamp: string;
  event: string;
  actor: string | null;
}

export interface AIRecommendation {
  type: string;
  title: string;
  description: string;
}

export interface CrimeCaseDetailRecord extends CrimeCaseRecord {
  priority: string;
  progress: number;
  is_locked: boolean;
  assigned_officer_id: string | null;
  assigned_officer?: {
    id: string;
    badge_number: string;
    rank: string | null;
    full_name: string;
  } | null;
  notes: InvestigationNote[];
  timeline: TimelineEvent[];
  firs: Array<{
    id: string;
    fir_number: string;
    complainant_name: string;
    sections: string | null;
    status: string;
    filed_at: string;
  }>;
  ai_recommendations: AIRecommendation[];
  location?: {
    id: string;
    district: string;
    station: string;
    pincode?: string | null;
  } | null;
  category?: {
    id: string;
    name: string;
    section_code?: string | null;
    severity?: string | null;
  } | null;
}

export interface OfficerWithUserRecord {
  id: string;
  user_id: string;
  badge_number: string;
  rank: string | null;
  district: string;
  station: string;
  created_at: string;
  full_name: string;
}

// FIR Lifecycle Management additions
export interface FIRRecord {
  id: string;
  fir_number: string;
  crime_case_id: string;
  investigating_officer_id: string | null;
  complainant_name: string;
  complainant_contact: string | null;
  sections: string | null;
  narrative: string | null;
  status: 'registered' | 'in_progress' | 'closed';
  filed_at: string;
  created_at: string;
  attachments?: Array<{ name: string; size: number }>;
}

export interface FIRDetailRecord extends FIRRecord {
  crime_case: CrimeCaseRecord | null;
  investigating_officer: OfficerRecord | null;
  criminals: CriminalRecord[];
  victims: VictimRecord[];
  evidence: FIDEvidenceRecord[];
  attachments: Array<{ name: string; size: number }>;
  ai_risk_score: number;
  ai_analysis_reasons: string[];
}

/** Evidence item embedded in a FIR detail response (mirrors backend EvidenceOut). */
export interface FIDEvidenceRecord {
  id: string;
  case_id: string;
  title: string;
  evidence_type: string;
  description: string | null;
  status: string;
  created_by: string | null;
  assigned_to: string | null;
  storage_path: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface OfficerRecord {
  id: string;
  user_id: string;
  badge_number: string;
  rank: string | null;
  district: string;
  station: string;
  created_at: string;
}

export interface VictimRecord {
  id: string;
  full_name: string;
  contact_number: string | null;
  address: string | null;
  gender: string | null;
  age: number | null;
  statement: string | null;
  image_url: string | null;
  created_at: string;
}

export interface CrimeCategoryRecord {
  id: string;
  name: string;
  section_code: string | null;
  severity: string | null;
}

export interface LocationSimpleRecord {
  id: string;
  district: string;
  station: string;
  pincode: string | null;
}

export interface FIRListQueryParams {
  status?: string;
  section?: string;
  search?: string;
  district?: string;
  officer_id?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
}

export interface CrimeCaseListFilters {
  category_id?: string;
  district?: string;
  priority?: string;
}

export async function getCrimeCases(
  q?: string,
  status?: string,
  page = 1,
  pageSize = 20,
  filters?: CrimeCaseListFilters,
) {
  return apiRequest<PaginatedResponse<CrimeCaseDetailRecord>>(
    `/crime-cases${buildQueryString({
      q,
      status,
      page,
      page_size: pageSize,
      ...(filters ?? {}),
    })}`,
  );
}

export interface CrimeCaseInsights {
  total_cases: number;
  open: number;
  investigating: number;
  charge_sheet: number;
  closed: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  avg_progress: number;
  clearance_rate: number;
}

export async function getCrimeCaseInsights(params?: {
  status?: string;
  category_id?: string;
  district?: string;
  priority?: string;
}) {
  return apiRequest<CrimeCaseInsights>(
    `/crime-cases/insights${buildQueryString(params as any)}`,
  );
}

export async function getCrimeCase(caseId: string) {
  return apiRequest<CrimeCaseDetailRecord>(`/crime-cases/${caseId}`);
}

export async function createCrimeCase(
  payload: Omit<CrimeCaseRecord, 'id' | 'reported_at' | 'created_at'> & {
    assigned_officer_id?: string | null;
    priority?: string;
    progress?: number;
    found_by_police?: boolean;
  },
) {
  return apiRequest<CrimeCaseRecord>('/crime-cases', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateCrimeCase(caseId: string, payload: Partial<CrimeCaseRecord> & { priority?: string; progress?: number; assigned_officer_id?: string | null }) {
  return apiRequest<CrimeCaseRecord>(`/crime-cases/${caseId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteCrimeCase(caseId: string) {
  return apiRequest<{ message: string }>(`/crime-cases/${caseId}`, {
    method: 'DELETE',
  });
}

export async function listFIRs(params?: FIRListQueryParams) {
  return apiRequest<PaginatedResponse<FIRRecord>>(`/firs${buildQueryString(params as any)}`);
}

export async function getFIR(firId: string) {
  return apiRequest<FIRDetailRecord>(`/firs/${firId}`);
}

export async function createFIR(data: {
  fir_number: string;
  crime_case_id: string;
  investigating_officer_id?: string | null;
  complainant_name: string;
  complainant_contact?: string | null;
  sections?: string | null;
  narrative?: string | null;
  status?: string;
  criminal_ids?: string[];
  victim_ids?: string[];
  attachments?: Array<{ name: string; size: number }>;
  found_by_police?: boolean;
}) {
  return apiRequest<FIRRecord>('/firs', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateFIR(firId: string, data: {
  investigating_officer_id?: string | null;
  status?: string | null;
  narrative?: string | null;
  sections?: string | null;
  complainant_name?: string | null;
  complainant_contact?: string | null;
  criminal_ids?: string[] | null;
  victim_ids?: string[] | null;
  attachments?: Array<{ name: string; size: number }> | null;
}) {
  return apiRequest<FIRRecord>(`/firs/${firId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteFIR(firId: string) {
  return apiRequest<{ message: string }>(`/firs/${firId}`, {
    method: 'DELETE',
  });
}

export interface FIRAttachmentRecord {
  id: string;
  name: string;
  size: number;
  mime_type?: string;
  uploaded_at?: string;
  uploaded_by?: string;
  has_file?: boolean;
}

export async function uploadFIRAttachment(firId: string, file: File): Promise<FIRAttachmentRecord[]> {
  const form = new FormData();
  form.append('file', file);
  return apiRequest<FIRAttachmentRecord[]>(`/firs/${firId}/attachments`, {
    method: 'POST',
    body: form,
  });
}

export async function deleteFIRAttachment(firId: string, attachmentId: string): Promise<FIRAttachmentRecord[]> {
  return apiRequest<FIRAttachmentRecord[]>(`/firs/${firId}/attachments/${attachmentId}`, {
    method: 'DELETE',
  });
}

export async function downloadFIRAttachment(firId: string, attachmentId: string, filename?: string): Promise<void> {
  const tokens = getStoredTokens();
  const response = await fetch(`${API_BASE_URL}/firs/${firId}/attachments/${attachmentId}/download`, {
    headers: {
      ...(tokens?.accessToken ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download attachment (${response.statusText})`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'attachment';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 500);
}

export async function addInvestigationNote(caseId: string, content: string) {
  return apiRequest<{ message: string; content: string }>(`/crime-cases/${caseId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export async function deleteInvestigationNote(caseId: string, noteId: string) {
  return apiRequest<{ message: string }>(`/crime-cases/${caseId}/notes/${noteId}`, {
    method: 'DELETE',
  });
}

export async function linkFIRs(caseId: string, firIds: string[]) {
  return apiRequest<{ message: string }>(`/crime-cases/${caseId}/link-firs`, {
    method: 'POST',
    body: JSON.stringify({ fir_ids: firIds }),
  });
}

export async function getUnassignedOfficers() {
  return apiRequest<OfficerWithUserRecord[]>('/crime-cases/unassigned-officers');
}

export async function getUnlinkedFIRs() {
  return apiRequest<Array<{ id: string; fir_number: string; crime_case_id: string; complainant_name: string; sections: string | null; status: string; filed_at: string }>>('/crime-cases/unlinked-firs');
}

export async function getCrimeCategories() {
  return apiRequest<CrimeCategoryRecord[]>('/crime-cases/categories');
}

export async function getLocationsList() {
  return apiRequest<LocationSimpleRecord[]>('/crime-cases/locations');
}

export async function listOfficers(page = 1, pageSize = 100) {
  return apiRequest<PaginatedResponse<OfficerRecord>>(`/officers${buildQueryString({ page, page_size: pageSize })}`);
}

// Issue #107: person image upload helpers
export async function uploadCriminalImage(criminalId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return apiRequest<{ image_url: string }>(`/criminals/${criminalId}/image`, { method: 'POST', body: form });
}

export async function uploadVictimImage(victimId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return apiRequest<{ image_url: string }>(`/victims/${victimId}/image`, { method: 'POST', body: form });
}

export async function uploadOfficerImage(officerId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return apiRequest<{ image_url: string }>(`/officers/${officerId}/image`, { method: 'POST', body: form });
}

export async function listVictims(q?: string, page = 1, pageSize = 100) {
  return apiRequest<PaginatedResponse<VictimRecord>>(`/victims${buildQueryString({ q, page, page_size: pageSize })}`);
}

export async function getVictim(victimId: string) {
  return apiRequest<VictimRecord & {
    firs: Array<{ id: string; fir_number: string; status: string; filed_at: string | null }>;
    image_url: string | null;
  }>(`/victims/${victimId}`);
}

export async function createVictim(payload: Partial<Omit<VictimRecord, 'id' | 'created_at'>>) {
  return apiRequest<VictimRecord>('/victims', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateVictim(victimId: string, payload: Partial<VictimRecord>) {
  return apiRequest<VictimRecord>(`/victims/${victimId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

// ── Unified Investigation Interface ──

export interface InvestigationOfficer {
  id: string;
  badge_number: string;
  rank: string | null;
  full_name: string;
  district: string;
  station: string;
}

export interface InvestigationVehicle {
  id: string;
  registration: string;
  make_model?: string | null;
  color?: string | null;
  status: string;
  source_type: string;
  source_reference?: string | null;
  verification_status: string;
  confidence: number;
}

export interface InvestigationLocation {
  id: string;
  name: string;
  type: string;
  station?: string | null;
  district?: string | null;
  address?: string | null;
}

export interface InvestigationOrganization {
  id: string;
  name: string;
  type: string;
  leader_name?: string | null;
  active_members: number;
  risk_level: string;
  territory?: string | null;
}

export interface InvestigationDigitalAccount {
  id: string;
  account_type: string;
  identifier: string;
  associated_person?: string | null;
  source: string;
  verification_status: string;
}

export interface InvestigationCase {
  id: string;
  case_number: string;
  description: string | null;
  mo_tags: string | null;
  status: string;
  priority: string;
  progress: number;
  occurred_at: string;
  reported_at: string;
  created_at: string;
  assigned_officer: InvestigationOfficer | null;
  crime_type?: string | null;
  location?: string | null;
  station?: string | null;
  district?: string | null;
  updated_at?: string | null;
}

export interface InvestigationFIR {
  id: string;
  fir_number: string;
  complainant_name: string;
  complainant_contact: string | null;
  sections: string | null;
  status: string;
  filed_at: string;
  narrative: string | null;
  criminals: Array<{ id: string; full_name: string; aliases: string | null; status: string }>;
  victims: Array<{ id: string; full_name: string; contact_number: string | null; gender: string | null; age: number | null; statement: string | null }>;
  police_station?: string | null;
}

export interface InvestigationCriminal {
  id: string;
  full_name: string;
  aliases: string | null;
  gender: string | null;
  date_of_birth: string | null;
  identifying_marks: string | null;
  mo_summary: string | null;
  status: string;
  risk_score: number;
  linked_fir_count: number;
  gang_affiliation?: string | null;
  phone_number?: string | null;
  total_cases_count?: number;
}

export interface InvestigationEvidence {
  id: string;
  evidence_type: string;
  description: string | null;
  file_url: string | null;
  collected_by: string | null;
  chain_of_custody: string | null;
  created_at: string;
  title?: string | null;
  status?: string | null;
  current_custody?: string | null;
}

export interface InvestigationTimelineEvent {
  id?: string | null;
  timestamp: string;
  event: string;
  actor: string | null;
  category: string;
  source?: string | null;
  source_id?: string | null;
  evidence_id?: string | null;
  details?: string | null;
}

export interface InvestigationAIRecommendation {
  type: string;
  title: string;
  description: string;
  priority: string;
}

export interface InvestigationHistoryEntry {
  timestamp: string;
  action: string;
  resource_type: string;
  details: string | null;
  officer_name: string | null;
  officer_badge: string | null;
}

export interface ForensicReportRecord {
  id: string;
  case_id: string;
  evidence_id?: string | null;
  title: string;
  forensic_type: string;
  examiner_name: string;
  lab_name: string;
  status: string;
  findings?: string | null;
  methodology?: string | null;
  ai_assisted: boolean;
  ai_notes?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface ForensicReportCreatePayload {
  case_id: string;
  evidence_id?: string | null;
  title: string;
  forensic_type: string;
  examiner_name?: string | null;
  lab_name?: string | null;
  status?: string;
  findings?: string | null;
  methodology?: string | null;
  ai_assisted?: boolean;
  ai_notes?: string | null;
}

export interface ForensicReportVerifyPayload {
  status?: string;
  verification_notes?: string | null;
}

export interface EvidenceHashVerification {
  evidence_id: string;
  filename: string;
  recorded_hash: string;
  current_hash: string;
  verified: boolean;
  message: string;
  checked_at: string;
}

export interface CustodyTransferPayload {
  to_user: string;
  action?: string;
  to_state?: string;
  location?: string | null;
  reason?: string | null;
}

export interface InvestigationData {
  case: InvestigationCase;
  firs: InvestigationFIR[];
  criminals: InvestigationCriminal[];
  evidence: InvestigationEvidence[];
  timeline: InvestigationTimelineEvent[];
  ai_recommendations: InvestigationAIRecommendation[];
  history: InvestigationHistoryEntry[];
  vehicles?: InvestigationVehicle[];
  locations?: InvestigationLocation[];
  organizations?: InvestigationOrganization[];
  digital_accounts?: InvestigationDigitalAccount[];
  forensic_reports_count?: number;
}

export async function getInvestigation(caseId: string) {
  return apiRequest<InvestigationData>(`/investigation/${caseId}`);
}

export async function getInvestigationTimeline(caseId: string) {
  return apiRequest<InvestigationTimelineEvent[]>(`/investigation/${caseId}/timeline`);
}

export async function getInvestigationHistory(caseId: string) {
  return apiRequest<InvestigationHistoryEntry[]>(`/investigation/${caseId}/history`);
}

export async function investigationChat(caseId: string, message: string, sessionId?: string) {
  return apiRequest<{ answer: string; sources: string[]; citations?: ChatCitation[] }>(`/investigation/chat`, {
    method: 'POST',
    body: JSON.stringify({ case_id: caseId, message, session_id: sessionId ?? null }),
  });
}

export async function getCaseNetworkGraph(caseId: string) {
  return apiRequest<NetworkGraphResponse>(`/network/case/${caseId}`);
}

export async function getCaseForensics(caseId: string) {
  return apiRequest<ForensicReportRecord[]>(`/forensics/case/${caseId}`);
}

export async function createForensicReport(payload: ForensicReportCreatePayload) {
  return apiRequest<ForensicReportRecord>('/forensics', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function verifyForensicReport(reportId: string, payload: ForensicReportVerifyPayload) {
  return apiRequest<ForensicReportRecord>(`/forensics/${reportId}/verify`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function downloadForensicReportPDF(reportId: string, filename?: string): Promise<void> {
  const tokens = getStoredTokens();
  const response = await fetch(`${API_BASE_URL}/forensics/${reportId}/export`, {
    headers: {
      ...(tokens?.accessToken ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download forensic report PDF (${response.statusText})`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `KSP_Forensic_Report_${reportId.slice(0, 8)}.pdf`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 500);
}

export async function verifyEvidenceHash(evidenceId: string) {
  return apiRequest<EvidenceHashVerification>(`/evidence/${evidenceId}/verify-hash`, {
    method: 'POST',
  });
}

export async function transferEvidenceCustody(evidenceId: string, payload: CustodyTransferPayload) {
  return apiRequest<any>(`/evidence/${evidenceId}/custody/transfer`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ── Notification Types & Routes ──

export interface NotificationRecord {
  id: string;
  user_id: string | null;
  sender_id: string | null;
  sender_name: string | null;
  sender_badge: string | null;
  recipient_name: string | null;
  subject: string;
  notification_type: string;
  category: string;
  title: string;
  message: string;
  severity: string;
  priority: string;
  status: string;
  resource_type: string | null;
  resource_id: string | null;
  related_case_number: string | null;
  related_fir_number: string | null;
  is_read: boolean;
  is_dismissed: boolean;
  is_broadcast: boolean;
  parent_id: string | null;
  attachment_url: string | null;
  created_at: string;
  read_at: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
}

export interface NotificationCount {
  total: number;
  unread: number;
  critical: number;
}

export interface NotificationListResponse {
  total: number;
  page: number;
  page_size: number;
  unread_count: number;
  results: NotificationRecord[];
}

export interface NotificationDashboardSummary {
  unread_count: number;
  critical_alerts: number;
  today_messages: number;
  pending_acknowledgements: number;
  investigation_requests: number;
  broadcast_messages: number;
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  event_type: string;
  title: string;
  description: string;
  actor: string | null;
  actor_badge: string | null;
  resource_type: string;
  resource_id: string | null;
  severity: string;
}

export interface ActivityFeedResponse {
  total: number;
  results: ActivityEvent[];
}

export interface ServiceStatus {
  name: string;
  status: string;
  latency_ms: number;
  last_check: string;
  details: string | null;
}

export interface SystemHealthResponse {
  overall: string;
  services: ServiceStatus[];
  uptime_hours: number;
  last_updated: string;
}

export async function getNotifications(
  page = 1,
  pageSize = 20,
  unreadOnly = false,
  notificationType?: string,
  severity?: string,
  priority?: string,
  category?: string,
  status?: string,
  senderId?: string,
  search?: string,
) {
  return apiRequest<NotificationListResponse>(`/notifications${buildQueryString({
    page,
    page_size: pageSize,
    unread_only: unreadOnly,
    notification_type: notificationType,
    severity,
    priority,
    category,
    status,
    sender_id: senderId,
    search,
  } as any)}`);
}

export async function getNotificationCount() {
  return apiRequest<NotificationCount>('/notifications/count');
}

export async function getRecentNotifications(limit = 5) {
  return apiRequest<NotificationRecord[]>(`/notifications/recent${buildQueryString({ limit })}`);
}

export async function getNotificationDashboard() {
  return apiRequest<NotificationDashboardSummary>('/notifications/dashboard');
}

export async function createNotification(payload: {
  recipient_id?: string | null;
  subject: string;
  notification_type?: string;
  category?: string;
  title: string;
  message: string;
  priority?: string;
  severity?: string;
  related_case_number?: string | null;
  related_fir_number?: string | null;
  is_broadcast?: boolean;
  attachment_url?: string | null;
}) {
  return apiRequest<NotificationRecord>('/notifications', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function markNotificationRead(notificationId: string) {
  return apiRequest<{ success: boolean; message: string }>(`/notifications/${notificationId}/read`, { method: 'PUT' });
}

export async function markAllNotificationsRead() {
  return apiRequest<{ success: boolean; message: string }>('/notifications/read-all', { method: 'PUT' });
}

export async function acknowledgeNotification(notificationId: string) {
  return apiRequest<{ success: boolean; message: string }>(`/notifications/${notificationId}/acknowledge`, { method: 'PUT' });
}

export async function resolveNotification(notificationId: string) {
  return apiRequest<{ success: boolean; message: string }>(`/notifications/${notificationId}/resolve`, { method: 'PUT' });
}

export async function dismissNotification(notificationId: string) {
  return apiRequest<{ success: boolean; message: string }>(`/notifications/${notificationId}`, { method: 'DELETE' });
}

export async function deleteNotification(notificationId: string) {
  return apiRequest<{ success: boolean; message: string }>(`/notifications/${notificationId}/remove`, { method: 'DELETE' });
}

export async function deleteAllBroadcasts() {
  return apiRequest<{ success: boolean; message: string }>('/notifications/clear?scope=broadcasts', { method: 'DELETE' });
}

export async function getActivityFeed(limit = 50, eventType?: string, resourceType?: string) {
  return apiRequest<ActivityFeedResponse>(`/notifications/activity-feed${buildQueryString({ limit, event_type: eventType, resource_type: resourceType } as any)}`);
}

export async function getLiveTimeline(caseId?: string, limit = 30) {
  return apiRequest<any[]>(`/notifications/live-timeline${buildQueryString({ case_id: caseId, limit })}`);
}

export interface ModelInfo {
  model_name: string;
  risk_algorithm: string;
  forecast_algorithm: string;
  version: string;
  trained_on: string | null;
  training_rows: number;
  risk_metrics: Record<string, any>;
  forecast_metrics: Record<string, any>;
  risk_model_loaded: boolean;
  forecast_model_loaded: boolean;
}

export interface HotspotModelVersion {
  model_version: string;
  trained_at: string;
  dataset_version: string | null;
  training_records: number;
  metrics: Record<string, any>;
  status: string;
  deployment_status: string;
  previous_version: string | null;
  reason?: string | null;
}

export interface HotspotModelStatus {
  current: {
    model_name: string;
    model_version: string | null;
    algorithm: string;
    trained_at: string | null;
    training_rows: number;
    dataset_version: string | null;
    feature_version: string;
    previous_version: string | null;
    status: string;
    deployment_status: string;
    metrics: Record<string, any>;
    versions: HotspotModelVersion[];
  };
  versions: HotspotModelVersion[];
  retrain_policy: {
    min_new_cases: number;
    min_dataset_change_pct: number;
    min_rmse_improvement_pct: number;
    scheduled_enabled: boolean;
  };
  active_job: Record<string, any> | null;
}

export async function getModelInfo() {
  return apiRequest<ModelInfo>('/ai/predictions/model-info');
}

/** Admin-triggered risk model retrain (backend POST /ai/predictions/train). */
export async function trainRiskModels() {
  return apiRequest<{ status: string; retrained_by: string; metrics: Record<string, unknown> }>(
    '/ai/predictions/train',
    { method: 'POST' },
  );
}

export async function getHotspotModelStatus() {
  return apiRequest<HotspotModelStatus>('/ai/hotspot/current');
}

export async function getHotspotModelVersions() {
  return apiRequest<{ results: HotspotModelVersion[] }>('/ai/hotspot/versions');
}

export async function retrainHotspotModel(reason?: string) {
  return apiRequest<{ status: string; job_id: string; current_version: string | null }>(
    '/ai/hotspot/retrain',
    { method: 'POST', body: JSON.stringify({ reason, explicit: true }) },
  );
}

// ── Unified Model Management (continuous retraining) ─────────────────────────

export interface ModelDomainStatus {
  model_name: string;
  model_version: string | null;
  algorithm: string;
  trained_at: string | null;
  training_rows: number;
  dataset_version: string | null;
  feature_version: string;
  previous_version: string | null;
  status: string;
  deployment_status: string;
  artifacts_present: boolean;
  metrics: Record<string, any>;
}

export interface ModelDomainVersion {
  model_version: string;
  trained_at: string;
  dataset_version: string | null;
  training_records: number;
  metrics: Record<string, any>;
  status: string;
  deployment_status: string;
  previous_version: string | null;
  reason?: string | null;
  improvement_pct?: number;
}

export interface ModelDomainRetrainPolicy {
  min_new_records: number;
  min_dataset_change_pct: number;
  min_improvement_pct: number;
  scheduled_enabled: boolean;
}

export interface ModelDomainFullStatus {
  current: ModelDomainStatus;
  versions: ModelDomainVersion[];
  retrain_policy: ModelDomainRetrainPolicy;
  is_stale?: boolean | null;
  trainer_available?: boolean;
  staleness?: Record<string, any> | null;
}

export interface AllModelsStatus {
  models: Record<string, ModelDomainFullStatus>;
  auto_retrain_enabled: boolean;
  min_interval_seconds: number;
  refresh_status?: Record<string, any> | null;
}

export interface ModelRetrainJob {
  id: string;
  model_name: string;
  trigger_type: string;
  reason: string | null;
  status: string;
  previous_version: string | null;
  new_version: string | null;
  dataset_version: string | null;
  training_records: number;
  evaluation_metrics: Record<string, any> | null;
  deployment_status: string | null;
  error_message: string | null;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export async function getAllModelsStatus() {
  return apiRequest<AllModelsStatus>('/ai/models/status');
}

export async function getModelDomainStatus(domain: string) {
  return apiRequest<ModelDomainFullStatus>(`/ai/models/${domain}/status`);
}

export async function getModelDomainVersions(domain: string) {
  return apiRequest<{ domain: string; versions: ModelDomainVersion[] }>(`/ai/models/${domain}/versions`);
}

export async function retrainModelDomain(domain: string, reason?: string) {
  return apiRequest<{ status: string; job_id: string; domain: string; current_version: string | null }>(
    `/ai/models/${domain}/retrain`,
    { method: 'POST', body: JSON.stringify({ reason, explicit: true }) },
  );
}

export async function getModelRetrainJobs(limit = 20) {
  return apiRequest<{ jobs: ModelRetrainJob[]; total: number }>(`/ai/models/jobs?limit=${limit}`);
}

export async function getModelRetrainJob(jobId: string) {
  return apiRequest<ModelRetrainJob>(`/ai/models/jobs/${jobId}`);
}

// ── Season Breakdown ────────────────────────────────────────────────────────

export interface SeasonData {
  season: string;
  count: number;
  percentage: number;
  top_district: string;
}

export interface SeasonBreakdownResponse {
  seasons: SeasonData[];
  total_cases: number;
  karnataka_climate_note?: string;
}

export async function getSeasonBreakdown() {
  return apiRequest<SeasonBreakdownResponse>('/dashboard/season-breakdown');
}

// ── Sociological Insights ───────────────────────────────────────────────────

export interface AgeGroupData {
  group: string;
  count: number;
  percentage: number;
}

export interface GenderData {
  gender: string;
  count: number;
  percentage: number;
}

export interface DemographicAnalysis {
  age_groups: AgeGroupData[];
  gender_distribution: GenderData[];
  total_victims: number;
}

export interface UrbanRuralData {
  type: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
  classification_status?: 'AVAILABLE' | 'DATA_UNAVAILABLE';
}

export interface DistrictDensity {
  district: string;
  canonical_district?: string | null;
  match_method?: string;
  mapping_status?: 'MATCHED' | 'UNMAPPED';
  crime_count: number;
  crime_per_lakh: number | null;
  crime_per_sqkm: number | null;
  population_lakhs: number | null;
  area_sq_km: number | null;
  type: string | null;
}

export interface UrbanRuralAnalysis {
  urban_rural_distribution: UrbanRuralData[];
  unmapped_districts?: string[];
  district_crime_density: DistrictDensity[];
  total_crimes: number;
}

export interface CorrelationDetail {
  coefficient: number | null;
  sample_size: number;
  excluded_missing?: number;
  status: string;
}

export interface DistrictOverlay {
  district: string;
  canonical_district?: string | null;
  mapping_status?: 'MATCHED' | 'UNMAPPED';
  match_method?: string;
  limitation?: string;
  crime_count: number;
  population_lakhs: number | null;
  area_sq_km: number | null;
  population_density: number | null;
  crime_per_lakh: number | null;
  crime_per_sqkm: number | null;
  data_status?: Record<string, 'AVAILABLE' | 'DATA_UNAVAILABLE'>;
  urbanization_type: string | null;
  literacy_rate: number | null;
  sex_ratio: number | null;
  avg_income_lakhs: number | null;
  unemployment_rate: number | null;
  risk_index?: number | null;
  source_period?: number | null;
  period_label?: string | null;
  record_completeness_pct?: number;
  correlation_flags: string[];
}

export interface SocioeconomicAnalysis {
  districts: DistrictOverlay[];
  correlations: {
    literacy_vs_crime: number | null;
    income_vs_crime: number | null;
    unemployment_vs_crime: number | null;
  };
  correlation_details?: Record<string, CorrelationDetail>;
  unmapped_districts?: string[];
  provenance?: {
    dataset_name: string;
    version: string;
    origin: string;
    source_key: string | null;
  };
  dataset?: {
    version: string;
    file?: string;
    demo_data?: boolean;
    notes?: string[];
    indicators?: unknown[];
    partial_records?: Array<{ district: string; available_indicators: number; total_indicators: number }>;
    duplicate_district_keys?: string[];
    records_missing_period?: string[];
    data_years?: number[];
  } | null;
  insights: Array<{
    type: string;
    title: string;
    description: string;
  }>;
}

export interface ScatterPoint {
  district: string;
  canonical_district?: string | null;
  match_method?: string;
  mapping_status?: 'MATCHED' | 'UNMAPPED';
  limitation?: string;
  crime_count: number;
  crime_per_lakh: number | null;
  population_density: number | null;
  urbanization_type: string | null;
  color: string;
}

export interface TemporalDemographic {
  hourly_distribution: Array<{ hour: string; count: number; percentage: number }>;
  day_of_week_distribution: Array<{ day: string; count: number; percentage: number }>;
  monthly_trend: Array<{ month: string; count: number }>;
  night_crime_percentage: number;
  weekend_crime_percentage: number;
}

export interface OffenderDemographics {
  age_groups: AgeGroupData[];
  gender_distribution: GenderData[];
  status_distribution: Array<{ status: string; count: number; percentage: number }>;
  total_offenders: number;
}

export async function getSociologicalDemographics() {
  return apiRequest<DemographicAnalysis>('/sociological/demographics');
}

export async function getSociologicalUrbanRural() {
  return apiRequest<UrbanRuralAnalysis>('/sociological/urban-rural');
}

export async function getSociologicalSocioeconomic() {
  return apiRequest<SocioeconomicAnalysis>('/sociological/socioeconomic');
}

export async function getSociologicalPopulationCorrelation() {
  return apiRequest<{ scatter: ScatterPoint[]; total_districts: number }>('/sociological/population-correlation');
}

export async function getSociologicalTemporal() {
  return apiRequest<TemporalDemographic>('/sociological/temporal-demographics');
}

/** Hour x day-of-week incident matrix (issue #143 gap 131.3). */
export interface TemporalMatrixCell {
  day: string;
  count: number;
  percentage: number;
  expected: number;
  std_residual: number;
}

export interface TemporalMatrixRow {
  hour: number;
  label: string;
  total: number;
  cells: TemporalMatrixCell[];
}

export interface TemporalMatrixPeak {
  hour: number;
  day: string;
  count: number;
  std_residual: number;
}

export interface TemporalMatrixResponse {
  filters: { district: string | null; location_id: string | null };
  days: string[];
  matrix: TemporalMatrixRow[];
  grand_total: number;
  hour_totals: Array<{ hour: number; count: number }>;
  day_totals: Array<{ day: string; count: number }>;
  peaks: TemporalMatrixPeak[];
  busiest_hour: number | null;
  night_share_pct: number;
  weekend_share_pct: number;
}

export async function getSociologicalTemporalMatrix(params?: { district?: string; location_id?: string }) {
  const query = new URLSearchParams();
  if (params?.district) query.set('district', params.district);
  if (params?.location_id) query.set('location_id', params.location_id);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<TemporalMatrixResponse>(`/sociological/temporal-matrix${suffix}`);
}

export async function getSociologicalOffenderDemographics() {
  return apiRequest<OffenderDemographics>('/sociological/offender-demographics');
}

// ── Strategic Intelligence ──────────────────────────────────────────────────

export interface StrategicBriefing {
  generated_at: string;
  summary: {
    total_crimes: number;
    recent_crimes_30d: number;
    weekly_crimes: number;
    open_cases: number;
    high_priority_cases: number;
    resolution_rate: number;
    crime_trend_change: number;
    total_firs: number;
    total_criminals: number;
    at_large_criminals: number;
    total_victims: number;
    total_officers: number;
    total_evidence: number;
    pending_evidence: number;
    unread_notifications: number;
  };
  top_categories: Array<{ category: string; count: number }>;
  districts_at_risk: Array<{
    district: string;
    crime_count: number;
    risk_level: string;
    trend: string;
    factors: string[];
  }>;
  monthly_trend: Array<{ month: string; count: number }>;
  emerging_trends: Array<{
    category: string;
    recent_count: number;
    historical_count: number;
    change_percentage: number;
    direction: string;
  }>;
  deployment_suggestions: Array<{
    priority: string;
    action: string;
    reason: string;
    district: string;
    resource_type: string;
  }>;
  top_criminals: Array<{
    id: string;
    name: string;
    status: string;
    aliases: string | null;
    risk_factors: string | null;
  }>;
  recent_firs: Array<{
    id: string;
    fir_number: string;
    complainant: string;
    status: string;
    filed_at: string | null;
  }>;
}

export interface DailySummary {
  date: string;
  today_crimes: number;
  yesterday_crimes: number;
  trend: string;
  today_firs: number;
  open_cases: number;
  at_large_criminals: number;
  categories_today: Array<{ category: string; count: number }>;
  districts_today: Array<{ district: string; count: number }>;
}

export interface ResourceAllocation {
  allocations: Array<{
    district: string;
    crime_share_pct: number;
    crime_count: number;
    allocation_priority: string;
    suggested_patrol_ratio: number;
  }>;
  total_districts: number;
  generated_at: string;
}

export async function getStrategicBriefing() {
  return apiRequest<StrategicBriefing>('/strategic/briefing');
}

export async function getHighRiskDistricts() {
  return apiRequest<any[]>('/strategic/high-risk-districts');
}

export interface EmergingTypology {
  category: string;
  recent_count: number;
  historical_count: number;
  change_percentage: number;
  direction: 'increasing' | 'decreasing' | 'stable';
}

export async function getEmergingTrends() {
  return apiRequest<EmergingTypology[]>('/strategic/emerging-trends');
}

export const getStrategicEmergingTrends = getEmergingTrends;

export async function getResourceAllocation() {
  return apiRequest<ResourceAllocation>('/strategic/resource-allocation');
}

export async function getDailySummary() {
  return apiRequest<DailySummary>('/strategic/daily-summary');
}

// ── Victimology (issue #139 M5) ─────────────────────────────────────────────

export interface VictimologyOverview {
  total_victims: number;
  victims_with_linked_firs: number;
  repeat_victims: number;
  repeat_victimization_rate: number | null;
  average_age: number | null;
  gender_distribution: Array<{ gender: string; count: number }>;
  top_risk_districts: Array<{ district: string; victim_count: number; avg_vulnerability: number }>;
}

export interface RepeatVictim {
  id: string;
  name: string;
  fir_count: number;
  districts: string[];
  categories: string[];
  vulnerability_index: number | null;
}

export interface VulnerabilityEntry {
  id: string;
  name: string;
  district: string | null;
  age: number | null;
  gender: string | null;
  fir_count: number;
  vulnerability_index: number;
  risk_factors: string[];
}

export async function getVictimologyOverview() {
  return apiRequest<VictimologyOverview>('/victimology/overview');
}

export async function getRepeatVictims(minFirCount = 2) {
  const raw = await apiRequest<{
    total_victims: number;
    repeat_victims: number;
    results: RepeatVictim[];
  }>(`/victimology/repeat-victims?min_fir_count=${minFirCount}`);
  return { count: raw.repeat_victims, repeat_victims: raw.results };
}

export async function getVulnerabilityIndex() {
  const raw = await apiRequest<{
    total_assessed: number;
    results: VulnerabilityEntry[];
  }>('/victimology/vulnerability-index');
  return { count: raw.total_assessed, entries: raw.results };
}

// ── Interventions (issue #139 M7 & Sentinel Workflow) ──────────────────────

export type InterventionStatus = 'planned' | 'active' | 'completed' | 'suspended';

export type InterventionWorkflowStage =
  | 'draft'
  | 'supervisor_review'
  | 'approved'
  | 'deployed'
  | 'outcome_review'
  | 'completed';

export interface InterventionRecord {
  id: string;
  district: string;
  intervention_type: string;
  title: string;
  description: string | null;
  started_at: string;
  ended_at: string | null;
  status: InterventionStatus;
  workflow_stage?: InterventionWorkflowStage;
  intelligence_id?: string | null;
  pattern_type?: string | null;
  affected_h3_cells?: string | null;
  relevant_time_period?: string | null;
  reason?: string | null;
  supporting_intelligence?: string | null;
  estimated_coverage?: number | null;
  assumptions?: string | null;
  simulation_data?: string | null;
  supervisor_notes?: string | null;
  subsequent_crime_count?: number | null;
  pattern_persisted?: string | null;
  observed_outcome?: string | null;
  review_notes?: string | null;
  target_category?: string | null;
  created_by_name?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface InterventionEffectiveness {
  intervention_id: string;
  title: string;
  district: string;
  status: string;
  window_days?: number;
  pre_window: { start: string; end: string; crime_count: number };
  post_window: { start: string; end: string; crime_count: number };
  change_percentage: number | null;
  verdict: 'effective' | 'partially_effective' | 'no_measurable_effect' | 'insufficient_data';
}

export interface InterventionCreateInput {
  district: string;
  intervention_type: string;
  title: string;
  description?: string;
  started_at?: string;
  ended_at?: string;
  status?: InterventionStatus;
  workflow_stage?: InterventionWorkflowStage;
  intelligence_id?: string | null;
  pattern_type?: string | null;
  affected_h3_cells?: string | null;
  relevant_time_period?: string | null;
  reason?: string | null;
  supporting_intelligence?: string | null;
  estimated_coverage?: number | null;
  assumptions?: string | null;
  simulation_data?: string | null;
  supervisor_notes?: string | null;
  subsequent_crime_count?: number | null;
  pattern_persisted?: string | null;
  observed_outcome?: string | null;
  review_notes?: string | null;
  target_category?: string;
  notes?: string;
}

export interface AdvanceStageInput {
  target_stage: InterventionWorkflowStage;
  notes?: string;
  outcome_data?: {
    subsequent_crime_count?: number;
    pattern_persisted?: string;
    observed_outcome?: string;
    review_notes?: string;
  };
}

export interface InterventionListResponse {
  total?: number;
  count?: number;
  page?: number;
  page_size?: number;
  results?: InterventionRecord[];
  interventions?: InterventionRecord[];
}

export async function listInterventions(params: {
  district?: string;
  status?: string;
  workflow_stage?: string;
  intelligence_id?: string;
} = {}) {
  const search = new URLSearchParams();
  if (params.district) search.set('district', params.district);
  if (params.status) search.set('status', params.status);
  if (params.workflow_stage) search.set('workflow_stage', params.workflow_stage);
  if (params.intelligence_id) search.set('intelligence_id', params.intelligence_id);
  const qs = search.toString();
  return apiRequest<InterventionListResponse>(
    `/interventions${qs ? `?${qs}` : ''}`
  );
}

export async function createIntervention(input: InterventionCreateInput) {
  return apiRequest<InterventionRecord>('/interventions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getInterventionEffectiveness(id: string, windowDays: number = 30) {
  return apiRequest<InterventionEffectiveness>(`/interventions/${id}/effectiveness?window_days=${windowDays}`);
}

export async function updateIntervention(id: string, patch: Partial<InterventionCreateInput>) {
  return apiRequest<InterventionRecord>(`/interventions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function advanceInterventionStage(id: string, input: AdvanceStageInput) {
  return apiRequest<InterventionRecord>(`/interventions/${id}/advance-stage`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}


// ── Semantic MO Search + NER (issue #139 M6) ────────────────────────────────

export interface MoSearchResult {
  doc_id: string;
  kind: string;
  title: string;
  similarity: number | null;
  excerpt: string;
  meta: Record<string, unknown>;
}

export async function searchModusOperandi(query: string, k = 8, kinds?: string[]) {
  const search = new URLSearchParams({ q: query, k: String(k) });
  if (kinds?.length) search.set('kinds', kinds.join(','));
  return apiRequest<{
    query: string;
    corpus_size: number;
    embedding_method: string;
    results: MoSearchResult[];
  }>(`/ai/mo/search?${search.toString()}`);
}

export interface ExtractedEntity {
  text: string;
  type: string;
  start: number;
  end: number;
  source: string;
}

export async function extractEntities(text: string) {
  return apiRequest<{
    entity_count: number;
    entities_by_type: Record<string, string[]>;
    entities: ExtractedEntity[];
  }>('/ai/mo/extract-entities', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function extractCaseEntities(caseId: string) {
  return apiRequest<{
    case_id: string;
    case_number: string;
    entity_count: number;
    entities_by_type: Record<string, string[]>;
    entities: ExtractedEntity[];
  }>(`/ai/mo/extract-case/${caseId}`);
}

// ── Recurring MO Pattern Detection (issue #144 gap 132.2) ───────────────────

export interface MOPatternMember {
  kind: 'case' | 'criminal';
  id: string;
  label: string;
  status?: string | null;
  district?: string | null;
}

export interface MOPattern {
  pattern_id: string;
  support: number;
  case_count: number;
  criminal_count: number;
  members: MOPatternMember[];
  shared_tags: string[];
  dominant_category: string | null;
  districts: string[];
  first_occurred: string | null;
  last_occurred: string | null;
  peak_time_window: string | null;
  at_large_members: number;
  threat_score: number;
  example_narrative: string;
}

export interface MOPatternResponse {
  patterns: MOPattern[];
  total_patterns: number;
  method: string;
  min_support: number;
  entities_analysed: { cases: number; criminals: number };
  generated_at: string;
}

export async function getRecurringMOPatterns(minSupport = 2, k = 10) {
  const search = new URLSearchParams({ min_support: String(minSupport), k: String(k) });
  return apiRequest<MOPatternResponse>(`/ai/mo/patterns?${search.toString()}`);
}

export interface MOTagSyncStats {
  cases_scanned: number;
  criminals_scanned: number;
  tags_created: number;
  case_links_created: number;
  criminal_links_created: number;
  already_synced: number;
}

export async function syncMOTags() {
  return apiRequest<MOTagSyncStats>('/ai/mo/sync-tags', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export interface MOMatchingCase {
  case_id: string;
  case_number: string;
  category: string | null;
  district: string | null;
  station: string | null;
  status: string;
  occurred_at: string | null;
  similarity_score: number;
  similarity_percent: number;
  match_level: 'high' | 'medium' | 'low' | 'none';
  confidence: number;
  is_confirmed_relationship?: boolean;
  relationship_label?: string;
  matching_factors: string[];
  divergent_factors: string[];
  insufficient_data: string[];
}

export interface MOMatchingSuspect {
  criminal_id: string;
  full_name: string;
  aliases: string | null;
  status: string;
  gang_affiliation: string | null;
  similarity_score: number;
  similarity_percent: number;
  match_level: 'high' | 'medium' | 'low' | 'none';
  confidence: number;
  is_confirmed_relationship: boolean;
  relationship_label: string;
  matching_factors: string[];
  divergent_factors: string[];
  insufficient_data: string[];
}

export interface MOMatchCaseResponse {
  target_case: {
    case_id: string;
    case_number: string;
    category: string | null;
    district: string | null;
    profile: Record<string, any>;
  };
  matching_cases: MOMatchingCase[];
  matching_suspects: MOMatchingSuspect[];
  total_cases_evaluated: number;
  total_criminals_evaluated: number;
  evaluated_at: string;
  error?: string;
}

export interface MOMatchCriminalResponse {
  target_criminal: {
    criminal_id: string;
    full_name: string;
    status: string;
    profile: Record<string, any>;
  };
  matching_cases: MOMatchingCase[];
  similar_criminals: MOMatchingSuspect[];
  total_cases_evaluated: number;
  total_criminals_evaluated: number;
  evaluated_at: string;
  error?: string;
}

export interface MOCompareResponse {
  entity_a: Record<string, any>;
  entity_b: Record<string, any>;
  similarity_score: number;
  similarity_percent: number;
  match_level: 'high' | 'medium' | 'low' | 'none';
  confidence: number;
  matching_factors: string[];
  divergent_factors: string[];
  insufficient_data: string[];
  dimension_scores: Record<string, number>;
  evaluated_at: string;
  error?: string;
}

export async function getCaseMOMatches(caseId: string, minSimilarity = 0.25, k = 5) {
  const params = new URLSearchParams({ min_similarity: String(minSimilarity), k: String(k) });
  return apiRequest<MOMatchCaseResponse>(`/ai/mo/match/case/${caseId}?${params.toString()}`);
}

export async function getCriminalMOMatches(criminalId: string, minSimilarity = 0.25, k = 5) {
  const params = new URLSearchParams({ min_similarity: String(minSimilarity), k: String(k) });
  return apiRequest<MOMatchCriminalResponse>(`/ai/mo/match/criminal/${criminalId}?${params.toString()}`);
}

export async function compareMOEntities(params: {
  entity_a_id: string;
  entity_a_type: 'case' | 'criminal';
  entity_b_id: string;
  entity_b_type: 'case' | 'criminal';
}) {
  return apiRequest<MOCompareResponse>('/ai/mo/compare', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// ── Data Import / Legacy Ingestion (issue #139 M1/M2) ───────────────────────

export interface ImportColumnSpec {
  name: string;
  required: boolean;
  type: string;
  choices?: string[];
}

export interface ImportEntitySpec {
  entity_type: string;
  columns: ImportColumnSpec[];
}

export interface ImportProfileInfo {
  profile: string;
  description: string;
  sample_mappings?: Record<string, string>;
}

export interface ImportPreviewReportItem {
  row_number: number;
  errors: string[];
  warnings: string[];
}

export interface ImportAnalysis {
  entity_type: string;
  profile: string;
  filename: string;
  detected_headers: string[];
  column_mapping: Record<string, string>;
  unmapped_headers: string[];
  missing_required_columns: string[];
  total_rows: number;
  sample_mapped_rows: Array<Record<string, unknown>>;
  validation_report: ImportPreviewReportItem[];
  truncated_report: boolean;
  estimated_valid_rows: number;
  estimated_invalid_rows: number;
}

export interface ImportCommitResult {
  job_id: string;
  status: string;
  entity_type: string;
  profile: string;
  filename: string;
  total_rows: number;
  imported_rows: number;
  failed_rows: number;
  validation_report: ImportPreviewReportItem[];
}

export interface ImportJobSummary {
  id: string;
  entity_type: string;
  source_format: string;
  mapping_profile: string;
  filename: string;
  status: string;
  total_rows: number;
  imported_rows: number;
  failed_rows: number;
  created_at: string | null;
  created_by: string | null;
}

export async function getImportEntities() {
  return apiRequest<{ profiles: ImportProfileInfo[]; entities: ImportEntitySpec[]; max_rows: number }>('/data-import/entities');
}

export async function analyzeImportFile(file: File, entityType: string, profile = 'standard') {
  const form = new FormData();
  form.append('file', file);
  form.append('entity_type', entityType);
  form.append('profile', profile);
  return apiRequest<ImportAnalysis>('/data-import/preview', {
    method: 'POST',
    body: form,
  });
}

export async function commitImportFile(
  file: File,
  entityType: string,
  profile = 'standard',
  dryRun = false
) {
  const form = new FormData();
  form.append('file', file);
  form.append('entity_type', entityType);
  form.append('profile', profile);
  if (dryRun) form.append('dry_run', 'true');
  return apiRequest<ImportCommitResult>('/data-import/commit', {
    method: 'POST',
    body: form,
  });
}

export async function listImportJobs(pageSize = 20) {
  return apiRequest<{ total: number; page: number; page_size: number; results: ImportJobSummary[] }>(`/data-import/jobs?page=1&page_size=${pageSize}`);
}

export interface DataQualityReport {
  summary: { total_records: number; by_provenance: Record<string, number> };
  entity_breakdown: Record<string, Record<string, number>>;
  warnings: { type: string; table: string; count: number; message: string; severity: string }[];
  provenance_values: string[];
}

export interface ModelHealthReport {
  hotspot: {
    model: string;
    overall_status: string;
    checks: { valid: boolean; artifact: string; error?: string }[];
    valid_count: number;
    invalid_count: number;
    model_loaded: boolean;
  };
  risk: {
    model: string;
    overall_status: string;
    checks: { valid: boolean; artifact: string; error?: string }[];
    valid_count: number;
    invalid_count: number;
    risk_model_loaded: boolean;
    forecast_model_loaded: boolean;
  };
  overall_status: string;
}

export async function getAdminDataQuality() {
  return apiRequest<DataQualityReport>('/admin/data-quality');
}

export async function getModelHealth() {
  return apiRequest<ModelHealthReport>('/ai/model-health');
}

export async function downloadEvidencePDF(evidenceId: string, filename?: string): Promise<void> {
  const tokens = getStoredTokens();
  const response = await fetch(`${API_BASE_URL}/evidence/${evidenceId}/download?format=pdf`, {
    headers: {
      ...(tokens?.accessToken ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download evidence PDF (${response.statusText})`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `KSP_Evidence_${evidenceId.slice(0, 8)}.pdf`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 500);
}

// ── Issue #200: Investigation Hub (officer-centric unified intelligence) ─────

export interface InvestigationSearchItem {
  id: string;
  type: string; // person | case | fir | location | station | mo
  name: string;
  detail: string;
  status?: string | null;
  subtitle?: string | null;
  meta: Record<string, any>;
}

export interface InvestigationGroupedSearchResponse {
  query: string;
  persons: InvestigationSearchItem[];
  victims: InvestigationSearchItem[];
  cases: InvestigationSearchItem[];
  firs: InvestigationSearchItem[];
  locations: InvestigationSearchItem[];
  stations: InvestigationSearchItem[];
  mo_matches: InvestigationSearchItem[];
  mo_intelligence: boolean;
  total: number;
  provenance: string;
}

export interface InvestigationInterpretation {
  query: string;
  detected_language: string; // kannada | english | mixed
  person_name?: string | null;
  case_number?: string | null;
  fir_number?: string | null;
  district?: string | null;
  station?: string | null;
  crime_type?: string | null;
  mo_keywords: string[];
  phone?: string | null;
  date_range_days?: number | null;
  search_term: string;
  confidence: string; // high | medium | low
  notes: string[];
}

export interface InvestigationImageSearchResponse {
  status: string; // unavailable | available
  message: string;
  safe_fallback: string;
  upload_required: boolean;
  matches: any[];
  capability: string;
}

export async function searchInvestigation(q: string, limit = 15) {
  return apiRequest<InvestigationGroupedSearchResponse>(
    `/investigation-hub/search${buildQueryString({ q, limit })}`,
  );
}

export async function interpretInvestigationQuery(q: string) {
  return apiRequest<InvestigationInterpretation>(
    `/investigation-hub/interpret${buildQueryString({ q })}`,
  );
}

export async function searchInvestigationImage() {
  return apiRequest<InvestigationImageSearchResponse>('/investigation-hub/image-search', {
    method: 'POST',
  });
}

// --- Issue #225: Data Security / Identity Resolution ----------------------
// Fake/duplicate record detection: duplicate-identity leads, proxy patterns,
// integrity alerts, and an entity↔identity graph. All raw values are hashed /
// masked server-side; review decisions are audited.

export interface IdentityDashboardResponse {
  records_analyzed: number;
  possible_duplicates: number;
  identity_conflicts: number;
  identifier_reuse_alerts: number;
  possible_aliases: number;
  possible_proxy_relationships: number;
  critical_reviews: number;
  open_reviews: number;
  assessment_counts: Record<string, number>;
  proxy_pattern_counts: Record<string, number>;
}

export interface IdentityRelationship {
  id: string;
  source_entity_type: string;
  source_entity_id: string;
  target_entity_type: string;
  target_entity_id: string;
  source_name: string | null;
  target_name: string | null;
  relationship_type: string;
  assessment: string;
  confidence: number;
  confidence_breakdown: Record<string, unknown> | null;
  evidence_summary: { supporting_count: number; counter_count: number; groups: string[] } | null;
  status: string;
  reviewed_by_id: string | null;
  reviewed_at: string | null;
  review_decision: string | null;
  review_note: string | null;
  created_at: string | null;
}

export interface IdentityRelationshipDetail extends Omit<IdentityRelationship, 'source_name' | 'target_name'> {
  source: { entity_type: string; entity_id: string; name: string | null };
  target: { entity_type: string; entity_id: string; name: string | null };
  evidence: Array<{
    id: string;
    evidence_group: string;
    signal_type: string;
    weight_delta: number;
    confidence: number;
    severity: string;
    source_label: string | null;
  }>;
  conflicts: Array<Record<string, unknown>>;
}

export interface IntegrityAlertRecord {
  id: string;
  alert_type: string;
  severity: string;
  entity_a_type: string | null;
  entity_a_id: string | null;
  entity_b_type: string | null;
  entity_b_id: string | null;
  identifier_type: string | null;
  value_hash: string | null;
  display_value: string | null;
  confidence: number;
  description: string;
  observation_count: number;
  status: string;
  source_summary: Record<string, unknown> | null;
  created_at: string | null;
}

export interface ProxyPatternRecord {
  id: string;
  rule_id: string;
  rule_version: string;
  pattern: string;
  severity: string;
  confidence: number;
  assessment: string;
  entities: Array<{ entity_type: string; entity_id: string; name: string }>;
  evidence: Array<{ description: string; rule_id: string }>;
  counter_evidence: string[];
  time_window: string | null;
  explanation: string;
  possible_explanations: string[];
  observation_count: number;
  status: string;
  reviewed_by_id: string | null;
  reviewed_at: string | null;
  review_decision: string | null;
  review_note: string | null;
  created_at: string | null;
}

export interface IdentityGraphNode {
  id: string;
  entity_type: string;
  entity_id: string;
  name: string;
  aliases: string[];
  identifiers: Array<{ type: string; display: string }>;
}

export interface IdentityGraphEdge {
  source: string;
  target: string;
  relationship_type: string;
  relationship_id: string;
  confidence: number;
  assessment: string;
  evidence_count: number;
  status: string;
}

export interface IdentityGraphResponse {
  nodes: IdentityGraphNode[];
  edges: IdentityGraphEdge[];
}

export interface IdentitySearchItem {
  entity_type: string;
  entity_id: string;
  name: string;
  aliases: string[];
  identifiers: string[];
  match_type: string;
  confidence: number;
}

export interface IdentitySearchResponse {
  exact: IdentitySearchItem[];
  probable: IdentitySearchItem[];
  possible: IdentitySearchItem[];
}

export interface IdentityRunSummary {
  profiles_analyzed: number;
  candidates_generated: number;
  relationships_proposed: number;
  identifier_links_written: number;
  identifier_reuse_alerts: number;
  proxy_patterns_detected: number;
}

export interface IdentityListResponse<T> {
  total: number | null;
  results: T[];
}

export async function getIdentityDashboard(): Promise<IdentityDashboardResponse> {
  return apiRequest<IdentityDashboardResponse>('/identity/dashboard');
}

export async function listIdentityRelationships(params?: {
  status?: string;
  assessment?: string;
  limit?: number;
}): Promise<IdentityListResponse<IdentityRelationship>> {
  return apiRequest<IdentityListResponse<IdentityRelationship>>(`/identity/relationships${buildQueryString(params)}`);
}

export async function getIdentityRelationship(id: string): Promise<IdentityRelationshipDetail> {
  return apiRequest<IdentityRelationshipDetail>(`/identity/relationships/${encodeURIComponent(id)}`);
}

export async function reviewIdentityRelationship(
  id: string,
  decision: string,
  note?: string,
): Promise<IdentityRelationship> {
  return apiRequest<IdentityRelationship>(`/identity/relationships/${encodeURIComponent(id)}/review${buildQueryString({ decision, note })}`, {
    method: 'POST',
  });
}

export async function listIdentityAlerts(params?: {
  status?: string;
  alert_type?: string;
  limit?: number;
}): Promise<IdentityListResponse<IntegrityAlertRecord>> {
  return apiRequest<IdentityListResponse<IntegrityAlertRecord>>(`/identity/alerts${buildQueryString(params)}`);
}

export async function reviewIdentityAlert(id: string, decision: string, note?: string): Promise<IntegrityAlertRecord> {
  return apiRequest<IntegrityAlertRecord>(`/identity/alerts/${encodeURIComponent(id)}/review${buildQueryString({ decision, note })}`, {
    method: 'POST',
  });
}

export async function listIdentifierReuse(params?: { status?: string; limit?: number }): Promise<IdentityListResponse<IntegrityAlertRecord>> {
  return apiRequest<IdentityListResponse<IntegrityAlertRecord>>(`/identity/identifiers/reuse${buildQueryString(params)}`);
}

export async function listIdentityAliases(params?: { entity_type?: string; entity_id?: string; limit?: number }) {
  return apiRequest<IdentityListResponse<Record<string, unknown>>>(`/identity/aliases${buildQueryString(params)}`);
}

export async function listIdentityIdentifiers(params?: {
  entity_type?: string;
  entity_id?: string;
  identifier_type?: string;
  limit?: number;
}) {
  return apiRequest<IdentityListResponse<Record<string, unknown>>>(`/identity/identifiers${buildQueryString(params)}`);
}

export async function getIdentityGraph(): Promise<IdentityGraphResponse> {
  return apiRequest<IdentityGraphResponse>('/identity/graph');
}

export async function searchIdentity(q: string): Promise<IdentitySearchResponse> {
  return apiRequest<IdentitySearchResponse>(`/identity/search${buildQueryString({ q })}`);
}

export async function getProxyRules() {
  return apiRequest<{ rules: Array<Record<string, unknown>>; thresholds: Record<string, unknown> }>('/identity/proxy/rules');
}

export async function listProxyPatterns(params?: {
  status?: string;
  severity?: string;
  limit?: number;
}): Promise<IdentityListResponse<ProxyPatternRecord>> {
  return apiRequest<IdentityListResponse<ProxyPatternRecord>>(`/identity/proxy${buildQueryString(params)}`);
}

export async function getProxyPattern(id: string): Promise<ProxyPatternRecord> {
  return apiRequest<ProxyPatternRecord>(`/identity/proxy/${encodeURIComponent(id)}`);
}

export async function reviewProxyPattern(id: string, decision: string, note?: string): Promise<ProxyPatternRecord> {
  return apiRequest<ProxyPatternRecord>(`/identity/proxy/${encodeURIComponent(id)}/review${buildQueryString({ decision, note })}`, {
    method: 'POST',
  });
}

export async function runIdentityResolution(): Promise<IdentityRunSummary> {
  return apiRequest<IdentityRunSummary>('/identity/run', { method: 'POST' });
}

export async function runProxyDetection(): Promise<{ patterns_detected: number; patterns: ProxyPatternRecord[] }> {
  return apiRequest<{ patterns_detected: number; patterns: ProxyPatternRecord[] }>('/identity/proxy/run', { method: 'POST' });
}

// ── Intelligence Engine ─────────────────────────────────────────────────────

export interface IntelligenceConnection {
  entity_type: string;
  entity_id: string;
  entity_name: string;
  entity_detail: string;
  connection_type: string;
  confidence: 'confirmed' | 'probable' | 'possible' | 'insufficient';
  confidence_score: number;
  explanation: string;
  source_records: Array<{ type: string; id: string; label: string }>;
}

export interface IntelligenceThread {
  attribute: string;
  value: string;
  case_count: number;
  confidence: 'confirmed' | 'probable' | 'possible' | 'insufficient';
  source_records: Array<{ type: string; id: string; label: string }>;
}

export interface IntelligenceComparisonItem {
  attribute: string;
  primary_value: string | null;
  compare_value: string | null;
  status: 'matching' | 'different' | 'missing' | 'conflicting';
  source_records: Array<{ type: string; id: string; label: string }>;
}

export interface IntelligenceComparison {
  case_number: string;
  case_id: string;
  similarity_score: number;
  matching_attributes: IntelligenceComparisonItem[];
  different_attributes: IntelligenceComparisonItem[];
  missing_attributes: IntelligenceComparisonItem[];
  conflicting_attributes: IntelligenceComparisonItem[];
}

export interface IntelligenceCrimeDNA {
  profile: Record<string, string>;
  similar_cases: Array<{
    case_id: string;
    case_number: string;
    similarity_score: number;
    matching_attributes: string[];
    explanation: string;
    kind?: string;
  }>;
  method: string;
}

export interface IntelligenceLead {
  rank: number;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  entity_detail: string;
  reason: string;
  relevance_score: number;
  source_records: Array<{ type: string; id: string; label: string }>;
}

export interface IntelligenceTimelineEvent {
  timestamp: string;
  event: string;
  event_type: string;
  source_type: string;
  source_id: string;
  source_label: string;
}

export interface IntelligencePatternBreak {
  pattern_type: string;
  baseline: string;
  deviation: string;
  confidence: 'confirmed' | 'probable' | 'possible' | 'insufficient';
  supporting_records: Array<{ type: string; id: string; label: string }>;
}

export interface IntelligenceReport {
  entity_info: {
    entity_type: string;
    entity_id: string;
    entity_name: string;
    entity_detail: string;
  };
  summary: string;
  connections: IntelligenceConnection[];
  common_threads: IntelligenceThread[];
  case_comparison: IntelligenceComparison[];
  crime_dna: IntelligenceCrimeDNA;
  investigation_leads: IntelligenceLead[];
  timeline: IntelligenceTimelineEvent[];
  network_snapshot: {
    nodes: Array<{ id: string; name: string; type: string; detail: string }>;
    edges: Array<{ source: string; target: string; relationship: string; confidence: string }>;
  };
  pattern_breaks: IntelligencePatternBreak[];
  confidence_summary: {
    confirmed: number;
    probable: number;
    possible: number;
    insufficient: number;
  };
  explainability: {
    method: string;
    data_sources: string[];
    limitations: string[];
    entity_type?: string;
    entity_id?: string;
  };
  emerging_intelligence?: UnifiedIntelligenceResult | null;
}

export async function buildIntelligence(
  entityType: string,
  entityId: string
): Promise<IntelligenceReport> {
  return apiRequest<IntelligenceReport>('/intelligence/build', {
    method: 'POST',
    body: JSON.stringify({ entity_type: entityType, entity_id: entityId }),
  });
}

export async function searchIntelligenceEntities(
  query: string,
  entityType?: string
): Promise<Array<{ id: string; type: string; name: string; subtitle: string }>> {
  const params = new URLSearchParams({ q: query });
  if (entityType) params.set('entity_type', entityType);
  const response = await apiRequest<{ results: Array<{ id: string; type: string; name: string; subtitle: string }> }>(
    `/intelligence/entity-search?${params.toString()}`
  );
  return response.results || [];
}

export interface IntelligenceHistoryItem {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_label: string;
  summary: string | null;
  connections: number;
  leads: number;
  threads: number;
  timeline_events: number;
  confirmed: number;
  probable: number;
  possible: number;
  created_at: string | null;
}

export async function getIntelligenceHistory(limit = 20): Promise<IntelligenceHistoryItem[]> {
  return apiRequest<IntelligenceHistoryItem[]>(
    `/intelligence/history?limit=${limit}`
  );
}

export async function deleteIntelligenceHistory(runId: string): Promise<{ deleted: boolean }> {
  return apiRequest<{ deleted: boolean }>(`/intelligence/history/${runId}`, {
    method: 'DELETE',
  });
}

// ── Intelligence Fusion & Action Pipeline ─────────────────────────────────

export interface ChangeFromBaseline {
  baseline_count: number;
  current_count: number;
  change_percentage: number;
  direction: string;
  baseline_window_days?: number;
  current_window_days?: number;
}

export interface SupportingSignal {
  signal_type: string;
  description: string;
  score: number | null;
  status: string;
  evidence_details: Record<string, any>;
}

export interface ForecastResult {
  predicted_crime_count: number;
  lower_bound: number | null;
  upper_bound: number | null;
  trend: string;
  prediction_mode: string;
  period: string;
}

export interface RecommendedActionInput {
  title: string;
  action_type: string;
  description: string;
  priority: string;
  suggested_intervention: {
    district: string;
    intervention_type: string;
    title: string;
    description: string;
    started_at?: string;
    status?: string;
  } | null;
}

export interface UnifiedIntelligenceResult {
  intelligence_id: string;
  pattern_type: string;
  location: {
    district: string;
    stations: string[];
    latitude: number | null;
    longitude: number | null;
  };
  affected_h3_cells: string[];
  time_window: string;
  change_from_baseline: ChangeFromBaseline;
  risk_score: number;
  forecast: ForecastResult | null;
  confidence: number;
  supporting_signals: SupportingSignal[];
  related_fir_ids: string[];
  related_entity_ids: string[];
  recommended_action_input: RecommendedActionInput;
  ml_status: string;
  model_name: string;
  model_version: string;
  detection_timestamp: string;
  explanation: string;
  contributing_analytics: Record<string, any>;
  data_provenance: string;
}

export interface IntelligenceFusionResponse {
  total: number;
  generated_at: string;
  patterns: UnifiedIntelligenceResult[];
  thresholds_applied: Record<string, any>;
}

export interface FusionThresholdsInput {
  min_anomaly_score?: number;
  min_percentage_change?: number;
  min_risk_score?: number;
  min_confidence?: number;
  min_supporting_signals?: number;
  min_current_incidents?: number;
  current_window_days?: number;
  baseline_window_days?: number;
}

export interface EmergingPatternsParams {
  district?: string;
  category?: string;
  min_signals?: number;
  min_risk?: number;
  min_confidence?: number;
  time_window_days?: number;
}

export async function getEmergingPatterns(params?: EmergingPatternsParams): Promise<IntelligenceFusionResponse> {
  const qs = new URLSearchParams();
  if (params) {
    if (params.district) qs.set('district', params.district);
    if (params.category) qs.set('category', params.category);
    if (params.min_signals) qs.set('min_signals', String(params.min_signals));
    if (params.min_risk) qs.set('min_risk', String(params.min_risk));
    if (params.min_confidence) qs.set('min_confidence', String(params.min_confidence));
    if (params.time_window_days) qs.set('time_window_days', String(params.time_window_days));
  }
  const q = qs.toString();
  return apiRequest<IntelligenceFusionResponse>(`/intelligence/emerging-patterns${q ? `?${q}` : ''}`);
}

export async function runIntelligenceFusion(payload?: {
  district?: string;
  category?: string;
  thresholds?: FusionThresholdsInput;
}): Promise<IntelligenceFusionResponse> {
  return apiRequest<IntelligenceFusionResponse>('/intelligence/fuse', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  });
}

export async function getEmergingPatternById(intelligenceId: string): Promise<UnifiedIntelligenceResult> {
  return apiRequest<UnifiedIntelligenceResult>(`/intelligence/emerging-patterns/${intelligenceId}`);
}

export async function dispatchIntelligenceAction(
  intelligenceId: string,
  payload?: { title?: string; description?: string; intervention_type?: string }
): Promise<{
  dispatched: boolean;
  intelligence_id: string;
  intervention_id: string;
  district: string;
  intervention_type: string;
  title: string;
  status: string;
}> {
  return apiRequest(`/intelligence/emerging-patterns/${intelligenceId}/action`, {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  });
}

// ── Pattern-to-Network Investigation & Evidence Intelligence (issue #250) ───

export type VerificationState = 'VERIFIED' | 'POTENTIAL' | 'DEMO' | 'RESTRICTED' | 'UNVERIFIED';

export interface IntelligenceInvestigationFIR {
  id: string;
  fir_number: string;
  complainant_name: string;
  complainant_contact?: string | null;
  sections?: string | null;
  status: string;
  filed_at?: string | null;
  narrative?: string | null;
  case_id?: string | null;
  case_number?: string | null;
  verification_status: VerificationState;
  provenance?: string;
  is_demo_derived: boolean;
  is_restricted: boolean;
  evidence_count: number;
}

export interface IntelligenceInvestigationCase {
  id: string;
  case_number: string;
  category?: string | null;
  district?: string | null;
  station?: string | null;
  status: string;
  priority?: string | null;
  progress?: number | null;
  occurred_at?: string | null;
  description?: string | null;
  mo_tags?: string | null;
  fir_count: number;
  evidence_count: number;
  verification_status: VerificationState;
  provenance?: string;
  is_demo_derived: boolean;
  is_restricted: boolean;
}

export interface IntelligenceInvestigationEntity {
  id: string;
  node_id: string;
  entity_type: 'criminal' | 'victim';
  name: string;
  role?: string | null;
  status?: string | null;
  aliases?: string | null;
  mo_summary?: string | null;
  gang_affiliation?: string | null;
  is_demo_derived: boolean;
  provenance?: string;
  verification_status: VerificationState;
}

export interface IntelligenceInvestigationMOMatch {
  criminal_id?: string;
  case_id?: string;
  full_name?: string;
  case_number?: string;
  status?: string;
  similarity_score: number;
  similarity_percent: number;
  match_level?: string;
  confidence?: number | null;
  is_confirmed_relationship?: boolean;
  relationship_label?: string;
  verification_status: VerificationState;
  matching_factors?: string[];
  divergent_factors?: string[];
}

export interface IntelligenceInvestigationMoMatches {
  shared_tags: string[];
  reference_case_id?: string | null;
  suspects: IntelligenceInvestigationMOMatch[];
  matching_cases: IntelligenceInvestigationMOMatch[];
  method: string;
}

export interface IntelligenceInvestigationEvidence {
  id: string;
  title: string;
  description?: string | null;
  evidence_type: string;
  status: string;
  case_id: string;
  case_number?: string | null;
  fir_number?: string | null;
  verification_status: VerificationState;
  provenance?: string;
  is_demo_derived: boolean;
  is_restricted: boolean;
  masked?: boolean;
}

export interface WhyThisInsight {
  summary: string;
  signals: Array<{ signal_type: string; description: string; status: string }>;
  methodology: {
    ml_status: string;
    model_name: string;
    model_version: string;
    analytics_available: Record<string, string>;
  };
  data_sources: string[];
  limitations: string[];
  safety_note: string;
}

export interface IntelligenceInvestigationResponse {
  intelligence_id: string;
  pattern_type: string;
  location: {
    district?: string | null;
    stations: string[];
    latitude?: number | null;
    longitude?: number | null;
  };
  risk_score?: number | null;
  confidence?: number | null;
  generated_at?: string | null;
  firs: IntelligenceInvestigationFIR[];
  cases: IntelligenceInvestigationCase[];
  entities: IntelligenceInvestigationEntity[];
  mo_matches: IntelligenceInvestigationMoMatches;
  network: NetworkResponse;
  evidence: IntelligenceInvestigationEvidence[];
  why_this_insight: WhyThisInsight;
  verification_summary: Record<VerificationState, number> | Record<string, number>;
  access: { has_restricted_access: boolean };
}

export async function investigateIntelligencePattern(
  intelligenceId: string,
  pattern: UnifiedIntelligenceResult
): Promise<IntelligenceInvestigationResponse> {
  return apiRequest<IntelligenceInvestigationResponse>(
    `/intelligence/emerging-patterns/${intelligenceId}/investigate`,
    {
      method: 'POST',
      body: JSON.stringify(pattern),
    }
  );
}

// ── Face Recognition (Issue #228 — isolated DEMO enhancement) ──────────────

export interface FaceRecognizeResult {
  status: string;
  faces_detected: number;
  match_found: boolean;
  matched_person: { id: string; name: string; dataset_type: string } | null;
  confidence: number | null;
  best_score: number | null;
  message: string | null;
  analysis: { faces: number; age: string | null; gender: string | null; emotion: string | null } | null;
  analysis_source: string | null;
  threshold: number | null;
  queried_sample?: string;
}

export interface FaceIdentityInfo {
  id: string;
  name: string;
  dataset_type: string;
  image_count: number;
  created_at: string | null;
}

export interface FaceSampleImage {
  id: string;
  name: string;
  image_ref: string;
  variation: string;
}

export interface FaceProviderInfo {
  main: Record<string, unknown>;
  zoho: Record<string, unknown>;
  threshold: number;
  enabled: boolean;
}

export interface FaceAIIdentifyResult {
  answer: string;
  engine: string;
  recognition: FaceRecognizeResult;
  question: string | null;
}

export async function recognizeFace(file: File): Promise<FaceRecognizeResult> {
  const formData = new FormData();
  formData.append('file', file);
  return apiRequest<FaceRecognizeResult>('/face-recognition/recognize', {
    method: 'POST',
    body: formData,
    headers: {},
  }, true);
}

export async function testSampleFace(imageRef: string): Promise<FaceRecognizeResult> {
  const formData = new FormData();
  formData.append('image_ref', imageRef);
  return apiRequest<FaceRecognizeResult>(`/face-recognition/test-sample?image_ref=${encodeURIComponent(imageRef)}`, {
    method: 'POST',
    body: formData,
    headers: {},
  }, true);
}

export async function aiIdentifyFace(file: File, question?: string): Promise<FaceAIIdentifyResult> {
  const formData = new FormData();
  formData.append('file', file);
  if (question) formData.append('question', question);
  return apiRequest<FaceAIIdentifyResult>('/face-recognition/ai/identify', {
    method: 'POST',
    body: formData,
    headers: {},
  }, true);
}

export async function getFaceDemoInfo(): Promise<{ identities: { id: string; name: string; variations: string[]; prompt: string | null }[] }> {
  return apiRequest('/face-recognition/demo-info');
}

export async function getFaceIdentities(): Promise<FaceIdentityInfo[]> {
  return apiRequest<FaceIdentityInfo[]>('/face-recognition/identities');
}

export async function getFaceSamples(): Promise<FaceSampleImage[]> {
  return apiRequest<FaceSampleImage[]>('/face-recognition/samples');
}

export function getFaceSampleImageUrl(imageRef: string): string {
  return `${API_BASE_URL}/face-recognition/gallery/${encodeURIComponent(imageRef)}`;
}

export async function getFaceProviderInfo(): Promise<FaceProviderInfo> {
  return apiRequest<FaceProviderInfo>('/face-recognition/provider');
}

export async function getFaceRecognitionStatus(): Promise<{ enabled: boolean; provider: string; threshold: number }> {
  return apiRequest('/face-recognition/status');
}

// --- AI Processing (Phase 2) ---

export interface AIProcessingJob {
  id: string;
  target_entity_type: string;
  target_entity_id: string;
  job_type: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REQUIRES_REVIEW';
  error_details: string | null;
  retry_count: number;
  processing_started_at: string | null;
  processing_completed_at: string | null;
  created_at: string;
}

export interface AIEntity {
  id: string;
  entity_type: string;
  attributes: Record<string, any>;
  source_entity_type: string;
  source_entity_id: string;
  confidence: number;
  verification_status: string;
  provider: string;
  created_at: string;
}

export interface AIMatchRecord {
  id: string;
  candidate_ai_entity_id: string;
  candidate_ai_entity?: AIEntity | null;
  source_entity_type: string;
  source_entity_id: string;
  match_score: number;
  matching_attributes: Record<string, any>;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  created_at: string;
}

export async function getAIJobs(): Promise<AIProcessingJob[]> {
  return apiRequest<AIProcessingJob[]>('/ai/jobs');
}

export async function spawnAIJob(targetType: string, targetId: string, jobType: string): Promise<AIProcessingJob> {
  return apiRequest<AIProcessingJob>('/ai/jobs', {
    method: 'POST',
    body: JSON.stringify({ target_type: targetType, target_id: targetId, job_type: jobType }),
  });
}

export async function retryAIJob(jobId: string): Promise<AIProcessingJob> {
  return apiRequest<AIProcessingJob>(`/ai/jobs/${jobId}/retry`, { method: 'POST' });
}

export async function getPendingAIMatches(statusFilter: string = 'PENDING'): Promise<AIMatchRecord[]> {
  return apiRequest<AIMatchRecord[]>(`/ai/matches${buildQueryString({ status_filter: statusFilter })}`);
}

export async function verifyAIMatch(matchId: string, decision: 'CONFIRM' | 'REJECT'): Promise<AIMatchRecord> {
  return apiRequest<AIMatchRecord>(`/ai/matches/${matchId}/verify`, {
    method: 'POST',
    body: JSON.stringify({ decision }),
  });
}

// --- Phase 1/3/5 (issue #269): ingestion, knowledge graph, alert findings ---

export interface DataSourceRecord {
  id: string;
  name: string;
  source_type: string;
  description: string | null;
  config: Record<string, unknown> | null;
  jurisdiction: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface IngestionKind {
  value: string;
  label: string;
  ai_eligible: boolean;
}

export interface IngestionJobRecord {
  id: string;
  source_id: string | null;
  status: string;
  artifact_kind: string;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number;
  content_hash: string | null;
  record_count: number;
  ai_job_spawned: boolean;
  error_details: string | null;
  received_at: string;
  status_counts?: Record<string, number>;
  by_kind?: Record<string, number>;
}

export interface IngestionStatus {
  total: number;
  received: number;
  validating: number;
  normalizing: number;
  stored: number;
  ready_for_ai: number;
  completed: number;
  requires_review: number;
  failed: number;
  by_kind: Record<string, number>;
}

export async function getIngestionKinds(): Promise<IngestionKind[]> {
  return apiRequest<IngestionKind[]>('/ingestion/kinds');
}

export async function listDataSources(activeOnly = false): Promise<DataSourceRecord[]> {
  return apiRequest<DataSourceRecord[]>(`/ingestion/sources${buildQueryString({ active_only: activeOnly || undefined })}`);
}

export async function createDataSource(payload: {
  name: string;
  source_type?: string;
  description?: string | null;
  config?: Record<string, unknown> | null;
  jurisdiction?: Record<string, unknown> | null;
  is_active?: boolean;
}): Promise<DataSourceRecord> {
  return apiRequest<DataSourceRecord>('/ingestion/sources', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function uploadArtifact(
  file: File,
  opts?: { sourceId?: string; jurisdiction?: string; origin?: string },
): Promise<IngestionJobRecord> {
  const form = new FormData();
  form.append('file', file);
  if (opts?.sourceId) form.append('source_id', opts.sourceId);
  if (opts?.jurisdiction) form.append('jurisdiction', opts.jurisdiction);
  if (opts?.origin) form.append('origin', opts.origin);
  return apiRequest<IngestionJobRecord>('/ingestion/upload', { method: 'POST', body: form });
}

export async function listIngestionJobs(): Promise<IngestionJobRecord[]> {
  return apiRequest<IngestionJobRecord[]>('/ingestion/jobs');
}

export async function getIngestionStatus(): Promise<IngestionStatus> {
  return apiRequest<IngestionStatus>('/ingestion/jobs/status');
}

export interface KGNodeRecord {
  id: string;
  node_type: string;
  ref_type: string;
  ref_id: string;
  label: string;
  attributes: Record<string, unknown>;
  districts: string[];
  status: string;
}

export interface KGRelationshipRecord {
  id: string;
  source_node_id: string;
  target_node_id: string;
  relationship_type: string;
  direction: string;
  strength: number;
  basis: string | null;
  status: string;
}

export interface KGFragment {
  nodes: KGNodeRecord[];
  edges: KGRelationshipRecord[];
  depth: number;
}

export interface KGStats {
  node_total: number;
  edge_total: number;
  nodes_by_type: Record<string, number>;
  edges_by_direction: Record<string, number>;
}

export async function getKGStats(): Promise<KGStats> {
  return apiRequest<KGStats>('/knowledge-graph/stats');
}

export async function searchKGNodes(q?: string, limit = 50): Promise<{ items: KGNodeRecord[]; total: number }> {
  return apiRequest<{ items: KGNodeRecord[]; total: number }>(
    `/knowledge-graph/nodes${buildQueryString({ q, limit })}`,
  );
}

export async function getKGFragment(nodeId: string, depth = 2): Promise<KGFragment> {
  return apiRequest<KGFragment>(`/knowledge-graph/fragment/${nodeId}${buildQueryString({ depth })}`);
}

export async function getKGFragmentByRef(refType: string, refId: string, depth = 2): Promise<KGFragment> {
  return apiRequest<KGFragment>(
    `/knowledge-graph/fragment/by-ref/${encodeURIComponent(refType)}/${encodeURIComponent(refId)}${buildQueryString({ depth })}`,
  );
}

export async function rebuildKG(): Promise<{ status: string; nodes: number; edges: number }> {
  return apiRequest<{ status: string; nodes: number; edges: number }>('/knowledge-graph/rebuild', {
    method: 'POST',
  });
}

export interface AlertFindingRecord {
  id: string;
  finding_type: 'CRIME_SPIKE' | 'REPEAT_OFFENDER' | string;
  district: string;
  category: string | null;
  entity_type: string | null;
  entity_id: string | null;
  severity: string;
  confidence: string;
  provenance: string;
  current_count: number;
  baseline_count: number;
  spike_ratio: number;
  evidence: Array<Record<string, unknown>>;
  time_window: Record<string, unknown> | null;
  explanation: string;
  status: string;
  observation_count: number;
  review_decision: string | null;
  review_note: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export async function getAlertFindings(params?: {
  status?: string;
  finding_type?: string;
  limit?: number;
}): Promise<{ total: number; results: AlertFindingRecord[] }> {
  return apiRequest<{ total: number; results: AlertFindingRecord[] }>(
    `/alerts/findings${buildQueryString({ status: params?.status, finding_type: params?.finding_type, limit: params?.limit })}`,
  );
}

export async function reviewAlertFinding(
  findingId: string,
  decision: 'confirm' | 'investigate' | 'dismiss',
  note?: string,
): Promise<AlertFindingRecord> {
  return apiRequest<AlertFindingRecord>(
    `/alerts/findings/${findingId}/review${buildQueryString({ decision, note })}`,
    { method: 'POST' },
  );
}

export async function regenerateAlertFindings(): Promise<{
  generated: number;
  empty: boolean;
  total_open: number;
}> {
  return apiRequest<{ generated: number; empty: boolean; total_open: number }>('/alerts/findings/generate', {
    method: 'POST',
  });
}
