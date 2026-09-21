import React, { useEffect, useState } from 'react';
import type { CrimeAlert } from '../store/alertStore';
import { getAnomalies, createNotification } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { ShieldAlert, CheckCircle, Search, MapPin, HardDrive, Loader2, FolderOpen } from 'lucide-react';
import { TableSkeleton } from '../components/ui/Skeleton';
import { useUserScope } from '../hooks/useUserScope';

export const Anomalies: React.FC = () => {
  const [alerts, setAlerts] = useState<CrimeAlert[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();
  const { district: scopeDistrict } = useUserScope();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<'ALL' | 'HIGH' | 'WATCH'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'PENDING' | 'REVIEWED' | 'ESCALATED'>('ALL');
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [escalating, setEscalating] = useState<string | null>(null);

  const fetchAnomalies = React.useCallback(() => {
    let isMounted = true;
    setLoading(true);
    setLoadError(null);
    getAnomalies()
      .then((response) => {
        if (!isMounted) return;
        const scoped = scopeDistrict
          ? response.anomalies.filter((item) => (item.district || '').toLowerCase() === scopeDistrict.toLowerCase())
          : response.anomalies;
        const mappedAlerts = scoped.map<CrimeAlert>((item) => ({
          id: item.case_id,
          firNumber: item.case_id,
          caseUuid: item.case_uuid,
          caseNumber: item.case_number,
          district: item.district || 'Unrecorded',
          station: item.station || 'Unrecorded',
          crimeType: item.category || item.label,
          offenceDetails: item.reason,
          anomalyScore: Math.round(item.score * 100),
          deviationPercent: Math.round(item.score * 100),
          severity: item.score >= 0.8 ? 'HIGH' : 'WATCH',
          timestamp: item.filed_at || new Date().toISOString(),
          status: 'PENDING',
          featureBreakdown: {
            'Anomaly Score': Math.round(item.score * 100),
            'Category Severity': Math.max(40, Math.round(item.score * 90)),
          },
        }));
        setAlerts(mappedAlerts);
        setSelectedAlertId(mappedAlerts[0]?.id ?? null);
        setLoadError(null);
      })
      .catch((error) => {
        if (!isMounted) return;
        setAlerts([]);
        setSelectedAlertId(null);
        setLoadError(error instanceof Error ? error.message : 'Failed to load anomalies');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [scopeDistrict]);

  useEffect(() => {
    return fetchAnomalies();
  }, [fetchAnomalies]);

  const reviewAlert = (id: string, reviewer: string) => setAlerts((current) => current.map((alert) => alert.id === id ? { ...alert, status: 'REVIEWED', assignedOfficer: reviewer } : alert));

  const escalateAlert = async (alert: CrimeAlert) => {
    setEscalating(alert.id);
    try {
      await createNotification({
        recipient_id: 'SP-0088',
        subject: `Anomaly Escalation: ${alert.firNumber}`,
        notification_type: 'escalation',
        category: 'case_escalation',
        title: `Anomaly Escalated to SP — ${alert.firNumber}`,
        message: `An anomaly detected in ${alert.district} (${alert.station}) has been escalated for SP review.\n\nType: ${alert.crimeType}\nScore: ${alert.anomalyScore}%\nDetails: ${alert.offenceDetails}`,
        priority: 'high',
        severity: alert.severity === 'HIGH' ? 'critical' : 'high',
        related_case_number: alert.firNumber,
        related_fir_number: alert.firNumber,
      });
      setAlerts((current) => current.map((a) => a.id === alert.id ? { ...a, status: 'ESCALATED', severity: 'HIGH', assignedOfficer: user?.name || 'Inspector System' } : a));
    } catch {
      // silently fail — button remains functional for retry
    } finally {
      setEscalating(null);
    }
  };

  // Filter logic
  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = alert.firNumber.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          alert.crimeType.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          alert.district.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesSeverity = selectedSeverity === 'ALL' || alert.severity === selectedSeverity;
    const matchesStatus = selectedStatus === 'ALL' || alert.status === selectedStatus;

    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const activeAlert = alerts.find(a => a.id === selectedAlertId) || filteredAlerts[0] || null;

  return (
    <div className="h-[84vh] flex flex-col gap-4 p-1 md:p-3 select-none">
      
      {/* Search Filter Top HUD */}
      {loadError && <div className="text-[9px] font-mono text-amber-400 uppercase">{loadError}</div>}
      <div className="bg-secondary-bg/50 border border-border-color p-4 rounded-card flex flex-col md:flex-row items-center gap-4 text-xs font-mono justify-between">
        
        {/* Search input */}
        <div className="w-full md:w-1/3 flex items-center relative">
          <input
            type="text"
            placeholder="Search FIR id, category, district..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[var(--bg-secondary)]/70 text-[var(--text-primary)] border border-border-color focus:border-[#1E6FD9] rounded-btn outline-none transition-colors"
          />
          <Search className="absolute left-3 w-4 h-4 text-[var(--text-muted)]" />
        </div>

        {/* Scope indicator */}
        {scopeDistrict && (
          <span className="order-last md:order-none inline-flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
            <MapPin className="w-3 h-3 text-[var(--accent-blue)]" />
            Focus: {scopeDistrict} · {alerts.length} alerts
          </span>
        )}

        {/* Filters */}
        <div className="w-full md:w-auto flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] text-[10px] uppercase">SEVERITY:</span>
            <div className="flex bg-[var(--bg-secondary)] rounded border border-border-color p-0.5">
              {(['ALL', 'HIGH', 'WATCH'] as const).map(sev => (
                <button
                  key={sev}
                  onClick={() => setSelectedSeverity(sev)}
                  className={`px-2.5 py-1 text-[9px] font-bold rounded transition-colors cursor-pointer ${
                    selectedSeverity === sev 
                      ? 'bg-[#1E6FD9] text-[var(--text-primary)]' 
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] text-[10px] uppercase">INVESTIGATION:</span>
            <div className="flex bg-[var(--bg-secondary)] rounded border border-border-color p-0.5">
              {(['ALL', 'PENDING', 'REVIEWED', 'ESCALATED'] as const).map(stat => (
                <button
                  key={stat}
                  onClick={() => setSelectedStatus(stat)}
                  className={`px-2 py-1 text-[9px] font-bold rounded transition-colors cursor-pointer ${
                    selectedStatus === stat 
                      ? 'bg-[#1E6FD9] text-[var(--text-primary)]' 
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {stat}
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Main Split Grid layout */}
      {loading ? (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5">
            <TableSkeleton rows={6} cols={3} />
          </div>
          <div className="lg:col-span-7">
            <TableSkeleton rows={4} cols={2} />
          </div>
        </div>
      ) : loadError ? (
        <div className="flex-1 flex items-center justify-center bg-[var(--bg-surface)] rounded-card border border-border-color p-8 text-center font-mono">
          <div className="space-y-3 max-w-md">
            <div className="w-12 h-12 rounded-xl bg-[var(--accent-coral-subtle)] border border-[var(--accent-coral)]/20 flex items-center justify-center mx-auto text-[var(--accent-coral)]">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">Anomaly Detection Service Unavailable</p>
            <p className="text-[10px] text-[var(--text-secondary)]">{loadError}</p>
            <button onClick={() => fetchAnomalies()} className="px-3 py-1.5 rounded text-[10px] uppercase font-bold bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue)]/80 cursor-pointer">
              Retry Detection
            </button>
          </div>
        </div>
      ) : (
      <div className="flex-1 w-full grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-hidden">
        
        {/* Left Side: Filtered incident listings list (5 cols on lg) */}
        <div className="lg:col-span-5 h-full overflow-y-auto pr-1.5 custom-scrollbar flex flex-col gap-2.5">
          {filteredAlerts.map(alert => {
            const isHigh = alert.severity === 'HIGH';
            const isSelected = selectedAlertId === alert.id;

            return (
              <div
                key={alert.id}
                onClick={() => setSelectedAlertId(alert.id)}
                className={`p-4 bg-[var(--bg-secondary)]/45 border transition-all duration-300 rounded-card cursor-pointer flex flex-col gap-2 ${
                  isSelected 
                    ? 'border-[#1E6FD9] bg-[#1E6FD9]/5 shadow-glow-blue' 
                    : 'border-border-color hover:border-[var(--border-secondary)]/60'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-[var(--text-primary)] font-mono">{alert.firNumber}</span>
                    <span className="text-[8.5px] font-mono text-[var(--text-muted)] uppercase mt-0.5">{alert.station}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[8px] font-bold font-mono ${
                    isHigh ? 'bg-[#C94A2A]/10 text-[#C94A2A] border border-[#C94A2A]/20' : 'bg-[#D4820A]/10 text-[#D4820A] border border-[#D4820A]/20'
                  }`}>
                    {alert.anomalyScore}%
                  </span>
                </div>
                <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed line-clamp-2">{alert.offenceDetails}</p>
                
                <div className="flex justify-between items-center mt-1 border-t border-[var(--border-primary)]/60 pt-2 text-[8px] font-mono">
                  <span className={alert.status === 'PENDING' ? 'text-red-400' : alert.status === 'REVIEWED' ? 'text-[#0E9E78]' : 'text-purple-400'}>
                    STATUS: {alert.status}
                  </span>
                  <span className="text-[var(--text-muted)]">
                    {new Date(alert.timestamp).toLocaleDateString()} IST
                  </span>
                </div>
              </div>
            );
          })}

          {filteredAlerts.length === 0 && (
            <div className="p-8 text-center text-xs font-mono text-[var(--text-muted)] uppercase border border-dashed border-[var(--border-primary)]/40 rounded-card">
              No matching anomalous incidents found
            </div>
          )}
        </div>

        {/* Right Side: High-fidelity details card workbench (7 cols on lg) */}
        <div className="lg:col-span-7 h-full bg-secondary-bg/25 border border-border-color rounded-card overflow-hidden">
          {activeAlert ? (
            <div className="h-full p-6 flex flex-col justify-between overflow-y-auto select-none">
              
              {/* Card Meta details */}
              <div className="space-y-4">
                <div className="flex justify-between items-start border-b border-[var(--border-muted)] pb-3">
                  <div>
                    <span className="px-2 py-0.5 bg-[#1E6FD9]/15 border border-[#1E6FD9]/30 text-[#1E6FD9] rounded text-[8.5px] font-mono font-bold tracking-wider uppercase">
                      CRIMINAL INCIDENT DETECTED
                    </span>
                    <h3 className="text-sm font-mono font-extrabold text-[var(--text-primary)] mt-1.5">{activeAlert.firNumber}</h3>
                  </div>
                  
                  {/* Status Tag */}
                  <div className={`px-3 py-1 font-mono text-[9px] font-bold rounded uppercase ${
                    activeAlert.status === 'PENDING' ? 'bg-[#C94A2A]/10 border border-[#C94A2A]/30 text-[#C94A2A]' : 
                    activeAlert.status === 'REVIEWED' ? 'bg-[#0E9E78]/10 border border-[#0E9E78]/30 text-[#0E9E78]' :
                    'bg-[#6C43CC]/10 border border-[#6C43CC]/30 text-[#6C43CC]'
                  }`}>
                    {activeAlert.status}
                  </div>
                </div>

                {/* Geography details */}
                <div className="grid grid-cols-2 gap-3 text-[10px] font-mono">
                  <div className="p-2 border border-[var(--border-primary)] bg-[var(--bg-secondary)]/20 rounded">
                    <span className="text-[var(--text-muted)] block uppercase text-[8px]">TOWN DISTRICT</span>
                    <span className="text-[var(--text-primary)] font-bold mt-0.5 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#1e6fd9]" />
                      {activeAlert.district}
                    </span>
                  </div>
                  <div className="p-2 border border-[var(--border-primary)] bg-[var(--bg-secondary)]/20 rounded">
                    <span className="text-[var(--text-muted)] block uppercase text-[8px]">POLICE BEAT TARGET</span>
                    <span className="text-[var(--text-primary)] font-bold mt-0.5 truncate">{activeAlert.station}</span>
                  </div>
                </div>

                {/* Core description text box */}
                <div>
                  <span className="text-[8.5px] font-bold text-[var(--text-muted)] uppercase tracking-widest block mb-1">
                    Offence description
                  </span>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed bg-[var(--bg-secondary)] p-3 rounded border border-[var(--border-primary)]">
                    {activeAlert.offenceDetails}
                  </p>
                </div>

                {/* Scoring factors checklist */}
                <div>
                  <span className="text-[8.5px] font-bold text-[var(--text-muted)] uppercase tracking-widest block mb-2.5">
                    AI Feature Explanations
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-[9.5px] font-mono">
                    {Object.entries(activeAlert.featureBreakdown).map(([feat, score]) => (
                      <div key={feat} className="p-2 bg-[var(--bg-secondary)]/30 border border-[var(--border-primary)]/60 rounded flex justify-between items-center">
                        <span className="text-[var(--text-secondary)] truncate max-w-[120px]">{feat}</span>
                        <span className="text-red-400 font-bold font-mono">{score}% weight</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Case files assignments details */}
                {activeAlert.assignedOfficer && (
                  <div className="p-2.5 bg-[#0E9E78]/5 border border-[#0E9E78]/20 text-[10px] font-mono text-[#0E9E78] rounded flex justify-between">
                    <span>POLICE OFFICER ASSIGNED:</span>
                    <span className="font-bold uppercase tracking-wider">{activeAlert.assignedOfficer}</span>
                  </div>
                )}

              </div>

              {/* ACTION BUTTON WORKBENCH */}
              <div className="pt-5 border-t border-[var(--border-muted)] flex gap-2 text-[9.5px] font-mono uppercase">
                {activeAlert.caseUuid && (
                  <button
                    onClick={() => {
                      sessionStorage.setItem('selected_entity_id', activeAlert.caseUuid!);
                      window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab: 'crime_cases', targetId: activeAlert.caseUuid } }));
                    }}
                    className="py-2.5 px-3 bg-[#6C43CC] hover:bg-[#6C43CC]/80 text-[var(--text-primary)] rounded-btn tracking-wider font-semibold cursor-pointer text-center select-none flex items-center justify-center gap-1.5"
                    title={`Open linked case file ${activeAlert.caseNumber || ''} in the Crime Cases module`}
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    Open Case File
                  </button>
                )}
                <button
                  onClick={() => {
                    sessionStorage.setItem('selected_district_override', activeAlert.district);
                    window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab: 'hotspot', targetId: activeAlert.district } }));
                  }}
                  className="py-2.5 px-3 bg-[#1e6fd9] hover:bg-[#1e6fd9]/80 text-[var(--text-primary)] rounded-btn tracking-wider font-semibold cursor-pointer text-center select-none flex items-center justify-center gap-1.5"
                  title="Focus this anomaly's district on the Geospatial Hotspot Map"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  Locate on Map
                </button>
                {activeAlert.status === 'PENDING' && (
                  <button
                    onClick={() => reviewAlert(activeAlert.id, user?.name || 'Inspector System')}
                    className="flex-1 py-2.5 bg-[#0E9E78] hover:bg-[#0E9E78]/80 text-[var(--text-primary)] rounded-btn tracking-wider font-semibold cursor-pointer text-center select-none flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Mark Under Investigation
                  </button>
                )}
                {activeAlert.status !== 'ESCALATED' && (
                  <button
                    onClick={() => escalateAlert(activeAlert)}
                    disabled={escalating === activeAlert.id}
                    className="py-2.5 px-3.5 bg-[#C94A2A] hover:bg-[#C94A2A]/80 text-[var(--text-primary)] rounded-btn tracking-wider font-semibold cursor-pointer text-center select-none flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {escalating === activeAlert.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ShieldAlert className="w-3.5 h-3.5" />
                    )}
                    {escalating === activeAlert.id ? 'Escalating...' : 'Escalate to SP'}
                  </button>
                )}
              </div>

            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-6 text-center text-xs font-mono text-[var(--text-muted)] uppercase border border-dashed border-[var(--border-primary)]/40 rounded-card select-none">
              <HardDrive className="w-8 h-8 text-[var(--text-disabled)] mb-2" />
              <span>Select case from feed to check and review anomalies logs</span>
            </div>
          )}
        </div>

      </div>
      )}

    </div>
  );
};
export default Anomalies;


