import { create } from 'zustand';

export interface CrimeAlert {
  id: string;
  firNumber: string;
  caseUuid?: string;
  caseNumber?: string;
  district: string;
  station: string;
  crimeType: string;
  offenceDetails: string;
  anomalyScore: number; // 0-100%
  deviationPercent: number; // vs normal historical baseline
  severity: 'HIGH' | 'WATCH' | 'INFO';
  timestamp: string;
  status: 'PENDING' | 'REVIEWED' | 'ESCALATED';
  featureBreakdown: Record<string, number>; // features explaining anomaly score
  assignedOfficer?: string;
}

interface AlertState {
  alerts: CrimeAlert[];
  addAlert: (alert: Omit<CrimeAlert, 'id' | 'timestamp' | 'status'>) => void;
  reviewAlert: (id: string, reviewer: string) => void;
  escalateAlert: (id: string, reviewer: string) => void;
}

export const useAlertStore = create<AlertState>((set) => ({
  alerts: [],
  
  addAlert: (alert) => set((state) => {
    const newAlert: CrimeAlert = {
      ...alert,
      id: `alt-${Math.floor(Math.random() * 1000) + 200}`,
      timestamp: new Date().toISOString(),
      status: 'PENDING'
    };
    return { alerts: [newAlert, ...state.alerts] };
  }),

  reviewAlert: (id, reviewer) => set((state) => ({
    alerts: state.alerts.map((a) => 
      a.id === id ? { ...a, status: 'REVIEWED', assignedOfficer: reviewer } : a
    )
  })),

  escalateAlert: (id, reviewer) => set((state) => ({
    alerts: state.alerts.map((a) => 
      a.id === id ? { ...a, status: 'ESCALATED', severity: 'HIGH', assignedOfficer: reviewer } : a
    )
  }))
}));
