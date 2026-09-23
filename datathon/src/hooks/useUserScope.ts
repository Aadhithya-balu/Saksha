import { useAuthStore, type UserRole } from '../store/authStore';

/**
 * Single source of truth for the authenticated operator's UC context:
 *  - district/station from the backend /auth/me profile (source of truth)
 *  - an operational persona derived from the RBAC role (drives home + IA copy)
 *  - whether the role legitimately operates across multiple districts
 *
 * The backend owns authorization. The UI only reflects the user's scope and
 * never fabricates data scope, district lists, or persona claims.
 */
export type OperatorPersona =
  | 'investigator'
  | 'analyst'
  | 'authority'
  | 'forensic'
  | 'admin'
  | 'court'
  | 'viewer';

const PERSONA_BY_ROLE: Record<UserRole, OperatorPersona> = {
  IO: 'investigator',
  SCRB: 'analyst',
  SP: 'authority',
  INSPECTOR: 'authority',
  FORENSIC: 'forensic',
  ADMIN: 'admin',
  VIEWER: 'viewer',
  COURT_ADMIN: 'court',
  JUDICIAL_AUTHORITY: 'court',
  COURT_ANALYST: 'court',
};

/** Roles whose existing read sets span the whole state (admin + command + analyst). */
const MULTI_DISTRICT_ROLES: UserRole[] = [
  'ADMIN',
  'SP',
  'INSPECTOR',
  'SCRB',
  'COURT_ADMIN',
  'JUDICIAL_AUTHORITY',
  'COURT_ANALYST',
];

export const PERSONA_LABEL: Record<OperatorPersona, string> = {
  investigator: 'Investigator',
  analyst: 'Crime Analyst',
  authority: 'Command / Oversight',
  forensic: 'Forensic',
  admin: 'Platform Administrator',
  court: 'Judicial Authority',
  viewer: 'Read-Only Viewer',
};

export const PERSONA_DESCRIPTOR: Record<OperatorPersona, string> = {
  investigator: 'Your cases, evidence and what needs attention',
  analyst: 'Patterns, connections and risk across the state',
  authority: 'Operational picture for your command area',
  forensic: 'Evidence, identification and chain of custody',
  admin: 'Platform health, users, roles and security',
  court: 'Authorized cases, evidence integrity, and judicial provenance review',
  viewer: 'Read-only intelligence access',
};

export const PERSONA_ROLE_LABEL: Record<UserRole, string> = {
  IO: 'Investigator',
  SCRB: 'Crime Analyst',
  SP: 'Superintendent',
  INSPECTOR: 'Inspector',
  FORENSIC: 'Forensic',
  ADMIN: 'Administrator',
  VIEWER: 'Viewer',
  COURT_ADMIN: 'Court Administrator',
  JUDICIAL_AUTHORITY: 'Judicial Officer',
  COURT_ANALYST: 'Court Analyst',
};

export const useUserScope = () => {
  const user = useAuthStore((s) => s.user);

  const district = user?.district || null;
  const station = user?.station || null;
  const persona: OperatorPersona | null = user ? PERSONA_BY_ROLE[user.role] : null;
  const canSelectDistrict = user ? MULTI_DISTRICT_ROLES.includes(user.role) : false;
  const scopeLabel = district || station || 'Karnataka';

  return {
    user,
    district,
    station,
    persona,
    canSelectDistrict,
    scopeLabel,
    personaLabel: persona ? PERSONA_LABEL[persona] : null,
    personaDescriptor: persona ? PERSONA_DESCRIPTOR[persona] : null,
  };
};