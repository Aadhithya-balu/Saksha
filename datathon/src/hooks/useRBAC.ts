import { useAuthStore } from '../store/authStore';
import type { UserRole } from '../store/authStore';

export interface RoutePermission {
  allowedRoles: UserRole[];
  moduleName: string;
}

export const ALL_UI_ROLES: UserRole[] = [
  'ADMIN',
  'SCRB',
  'IO',
  'SP',
  'INSPECTOR',
  'FORENSIC',
  'VIEWER',
  'COURT_ADMIN',
  'JUDICIAL_AUTHORITY',
  'COURT_ANALYST',
];

export const COURT_ROLES: UserRole[] = ['COURT_ADMIN', 'JUDICIAL_AUTHORITY', 'COURT_ANALYST'];

// Role clearance sets (per CONTEXT.md RBAC).
// crime_analyst -> SCRB, investigator -> IO, inspector -> INSPECTOR,
// policymaker -> SP, forensic -> FORENSIC, viewer -> VIEWER.

// Read-only insight modules are visible to every signed-in role (incl. VIEWER).
// The hidden-network discovery surfaces (network graph, offender registry,
// prediction/anomaly engines, AI chat, fusion) live here so analysts and
// oversight staff can always FIND the networks, even with a read-only role.
const INSIGHT_ROLES: UserRole[] = ALL_UI_ROLES;
// Roles that own and mutate case-linked records + review identity findings.
// Mirrors backend REVIEW_ROLES (admin, crime_analyst, investigator, inspector).
const INVESTIGATION_ROLES: UserRole[] = ['ADMIN', 'SCRB', 'IO', 'INSPECTOR'];
const CASE_VIEW_ROLES: UserRole[] = [
  'ADMIN',
  'SCRB',
  'IO',
  'INSPECTOR',
  'COURT_ADMIN',
  'JUDICIAL_AUTHORITY',
  'COURT_ANALYST',
];
// Face identification of persons of interest is an operational/forensic act;
// the demo gallery (synthetic images) stays public. Mirrors the face router.
const FACE_OPS_ROLES: UserRole[] = ['ADMIN', 'SCRB', 'IO', 'INSPECTOR', 'FORENSIC'];
// Officer registry reads are open to admin, analyst, investigator, inspector,
// policymaker (backend read set); only admin may write officers.
const OFFICER_READ_ROLES: UserRole[] = ['ADMIN', 'SCRB', 'IO', 'INSPECTOR', 'SP'];

export const ROUTE_PERMISSIONS: Record<string, RoutePermission> = {
  // ---- Read-only insight modules (all roles, VIEWER included) ----
  '/dashboard':      { allowedRoles: INSIGHT_ROLES, moduleName: 'Analytics Dashboard' },
  '/command-center': { allowedRoles: INSIGHT_ROLES, moduleName: 'Command Center' },
  '/hotspots':       { allowedRoles: INSIGHT_ROLES, moduleName: 'Crime Hotspot Map' },
  '/network':        { allowedRoles: INSIGHT_ROLES, moduleName: 'Criminal Network Analytics' },
  '/predictions':    { allowedRoles: INSIGHT_ROLES, moduleName: 'Predictive Crime AI Engine' },
  '/anomalies':      { allowedRoles: INSIGHT_ROLES, moduleName: 'Anomaly Detection Engine' },
  '/sociological':   { allowedRoles: INSIGHT_ROLES, moduleName: 'Sociological Intelligence' },
  '/strategic':      { allowedRoles: INSIGHT_ROLES, moduleName: 'Strategic Intelligence' },
  '/reports':        { allowedRoles: INSIGHT_ROLES, moduleName: 'Reports Center' },
  '/offenders':      { allowedRoles: INSIGHT_ROLES, moduleName: 'Offender Registry' },
  '/victims':        { allowedRoles: INSIGHT_ROLES, moduleName: 'Victim Registry' },
  '/notifications':  { allowedRoles: INSIGHT_ROLES, moduleName: 'Intelligence Center' },
  '/ai-chat':        { allowedRoles: INSIGHT_ROLES, moduleName: 'AI Chat Assistant' },
  '/docs':           { allowedRoles: INSIGHT_ROLES, moduleName: 'Documentation' },
  '/settings':       { allowedRoles: INSIGHT_ROLES, moduleName: 'Settings & Operator Help' },

  // ---- Admin / operational write modules (role-narrowed) ----
  '/admin':          { allowedRoles: ['ADMIN', 'COURT_ADMIN'], moduleName: 'System Security Control Center' },
  '/officers':       { allowedRoles: OFFICER_READ_ROLES, moduleName: 'Officer Management' },
  '/evidence':       { allowedRoles: ['ADMIN', 'IO', 'INSPECTOR', 'FORENSIC', 'SCRB', 'JUDICIAL_AUTHORITY', 'COURT_ANALYST'], moduleName: 'Evidence Handling' },
  '/face-recognition': { allowedRoles: FACE_OPS_ROLES, moduleName: 'Face Identification' },
  '/identity-resolution': { allowedRoles: INVESTIGATION_ROLES, moduleName: 'Identity Resolution & Data Integrity' },
  '/crime-cases':    { allowedRoles: CASE_VIEW_ROLES, moduleName: 'Crime Case Management' },
  '/investigation':  { allowedRoles: CASE_VIEW_ROLES, moduleName: 'Investigation Workspace' },
  '/firs':           { allowedRoles: INVESTIGATION_ROLES, moduleName: 'FIR Lifecycle Management' },
  '/criminals':      { allowedRoles: INVESTIGATION_ROLES, moduleName: 'Criminal Registry' },
  '/intelligence-engine': { allowedRoles: ['ADMIN', 'SCRB', 'IO', 'INSPECTOR', 'SP'], moduleName: 'Intelligence Engine' },
  '/intelligence-fusion': { allowedRoles: INSIGHT_ROLES, moduleName: 'Intelligence Fusion Portal' },
  '/ingestion':   { allowedRoles: INVESTIGATION_ROLES, moduleName: 'Universal Data Ingestion' },
  '/intelligence-graph': { allowedRoles: ['ADMIN', 'SCRB', 'IO', 'INSPECTOR', 'SP'], moduleName: 'Knowledge Graph Intelligence' },
  '/alerts-review': { allowedRoles: INVESTIGATION_ROLES, moduleName: 'Alert Findings Review' },
};

// Every page path rendered by App.tsx MUST have an explicit rule above. The
// default in checkPermission is DENY-if-unknown so a forgotten route surface
// never silently opens to every role.
const EXPLICIT_REQUIRED_PATHS = [
  '/dashboard', '/command-center', '/intelligence-engine', '/intelligence-fusion',
  '/identity-resolution', '/firs', '/hotspots', '/network', '/predictions',
  '/anomalies', '/offenders', '/criminals', '/victims', '/reports', '/settings',
  '/admin', '/crime-cases', '/investigation', '/ai-chat', '/face-recognition',
  '/officers', '/evidence', '/notifications', '/sociological', '/strategic', '/docs',
  '/ingestion', '/intelligence-graph', '/alerts-review',
];

// Fail-fast: every page path rendered by App.tsx MUST have an explicit rule
// above, so a forgotten route surface never silently opens to every role.
EXPLICIT_REQUIRED_PATHS.forEach((path) => {
  if (!ROUTE_PERMISSIONS[path]) {
    throw new Error(`[RBAC] Missing ROUTE_PERMISSIONS rule for "${path}". Add it before shipping.`);
  }
});

export const useRBAC = () => {
  const user = useAuthStore((state) => state.user);

  const checkPermission = (path: string): boolean => {
    if (!user) return false;
    const rule = ROUTE_PERMISSIONS[path];
    if (!rule) return false; // fail closed: unknown surface is not allowed
    return rule.allowedRoles.includes(user.role);
  };

  const getRequiredRoles = (path: string): UserRole[] => {
    return ROUTE_PERMISSIONS[path]?.allowedRoles || [];
  };

  const isCourt =
    user?.authorityType === 'COURT' ||
    (user?.role ? COURT_ROLES.includes(user.role) : false);

  return {
    user,
    role: user?.role || null,
    checkPermission,
    getRequiredRoles,
    isAdmin: user?.role === 'ADMIN',
    isSCRB: user?.role === 'SCRB',
    isIO: user?.role === 'IO',
    isSP: user?.role === 'SP',
    isInspector: user?.role === 'INSPECTOR',
    isForensic: user?.role === 'FORENSIC' || user?.authorityType === 'FORENSIC',
    isViewer: user?.role === 'VIEWER',
    isCourtAdmin: user?.role === 'COURT_ADMIN',
    isJudicialAuthority: user?.role === 'JUDICIAL_AUTHORITY',
    isCourtAnalyst: user?.role === 'COURT_ANALYST',
    isCourt,
    isLawEnforcement: !isCourt && user?.role !== 'FORENSIC',
    hasCapability: (cap: string) => user?.capabilities?.includes(cap) ?? false,
  };
};
