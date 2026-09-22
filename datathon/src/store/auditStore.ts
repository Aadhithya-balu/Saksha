import { create } from 'zustand';

export type AuditActionType =
  | 'PAGE_VIEW'
  | 'SEARCH'
  | 'EXPORT'
  | 'AUTH'
  | 'ESCALATION'
  | 'REVIEW'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'UPLOAD'
  | 'DOWNLOAD'
  | 'NAVIGATE';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  officerName: string;
  badgeId: string;
  actionType: AuditActionType;
  details: string;
  ipAddress: string;
}

interface AuditStore {
  logs: AuditLogEntry[];
  addLog: (officerName: string, badgeId: string, actionType: AuditLogEntry['actionType'], details: string) => void;
  clearLogs: () => void;
}

const INITIAL_LOGS: AuditLogEntry[] = [];

export const useAuditStore = create<AuditStore>((set) => ({
  logs: INITIAL_LOGS,
  
  addLog: (officerName, badgeId, actionType, details) => set((state) => {
    const newLog: AuditLogEntry = {
      id: `log-${Math.floor(Math.random() * 100000)}`,
      timestamp: new Date().toISOString(),
      officerName,
      badgeId,
      actionType,
      details,
      // Client-side session note. The authoritative, IP-stamped audit trail is
      // written server-side by audit_service.log_action; we must not invent an
      // IP address here.
      ipAddress: ''
    };
    return { logs: [newLog, ...state.logs] };
  }),

  clearLogs: () => set({ logs: [] })
}));
export default useAuditStore;
