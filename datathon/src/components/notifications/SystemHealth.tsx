import React, { useEffect, useState } from 'react';
import { Shield, ShieldCheck, ShieldAlert, Activity, Clock, Database, Server, Radio, RefreshCw } from 'lucide-react';
import { useRealtimeStore } from '../../store/realtimeStore';

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down' | 'standby';
  icon: React.ReactNode;
  latency: string;
}

interface ReadinessResponse {
  status?: string;
  postgresql?: string;
  data_source?: string;
  neo4j?: string;
}

const mapBackendState = (value: string | undefined): ServiceHealth['status'] => {
  switch (value) {
    case 'up': return 'healthy';
    case 'degraded': return 'degraded';
    case 'down': return 'down';
    case 'off':
    case 'disabled': return 'standby';
    default: return 'standby';
  }
};

const BACKEND_ICON = <Activity className="w-4 h-4" />;
const DB_ICON = <Database className="w-4 h-4" />;
const GRAPH_ICON = <Server className="w-4 h-4" />;
const SOURCE_ICON = <Database className="w-4 h-4" />;

interface SystemHealthProps {
  compact?: boolean;
}

export const SystemHealth: React.FC<SystemHealthProps> = ({ compact = false }) => {
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const sseStatus = useRealtimeStore((state) => state.status);

  // The SSE stream is request-scoped: it is only open while a subscriber page
  // (Overview, Crime Cases, Notifications) is mounted. When no page subscribes
  // it is legitimately idle, so we must render it as "Standby" rather than
  // "down" — an idle stream is not an outage.
  const sseService: ServiceHealth =
    sseStatus === 'connected'
      ? { name: 'Realtime SSE Stream', status: 'healthy', icon: <Radio className="w-4 h-4" />, latency: 'Active' }
      : sseStatus === 'connecting'
      ? { name: 'Realtime SSE Stream', status: 'degraded', icon: <Radio className="w-4 h-4" />, latency: 'Reconnecting' }
      : { name: 'Realtime SSE Stream', status: 'standby', icon: <Radio className="w-4 h-4" />, latency: 'Standby' };

  const refreshHealth = async () => {
    setLoading(true);
    const start = performance.now();
    try {
      const res = await fetch('/health/ready');
      const elapsed = Math.round(performance.now() - start);
      const body: ReadinessResponse = await res.json().catch(() => ({}));
      const backendOk = res.ok && (body.status ? body.status === 'ok' : true);

      // Only report components the readiness probe actually measures. No
      // invented per-service latency or uptime numbers.
      setServices([
        { name: 'Backend API', status: backendOk ? 'healthy' : 'degraded', icon: BACKEND_ICON, latency: `${elapsed}ms` },
        { name: 'PostgreSQL Database', status: mapBackendState(body.postgresql), icon: DB_ICON, latency: body.postgresql ?? 'unknown' },
        { name: 'Neo4j Graph Engine', status: mapBackendState(body.neo4j), icon: GRAPH_ICON, latency: body.neo4j ?? 'unknown' },
        { name: 'Data Source', status: 'standby', icon: SOURCE_ICON, latency: body.data_source ?? 'unknown' },
        sseService,
      ]);
    } catch {
      setServices([
        { name: 'Backend API', status: 'down', icon: BACKEND_ICON, latency: 'Unreachable' },
        sseService,
      ]);
    } finally {
      setLoading(false);
      setLastUpdated(new Date().toISOString());
    }
  };

  useEffect(() => {
    refreshHealth();
    const interval = setInterval(refreshHealth, 120000);
    return () => clearInterval(interval);
  }, [sseStatus]);

  const overallStatus = services.length === 0
    ? 'unknown'
    : services.some(s => s.status === 'down')
    ? 'critical'
    : services.some(s => s.status === 'degraded')
    ? 'degraded'
    : 'healthy';

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-[#0E9E78]';
      case 'degraded': return 'text-[#D4820A]';
      case 'down': return 'text-[#C94A2A]';
      case 'standby': return 'text-[var(--text-muted)]';
      default: return 'text-[var(--text-muted)]';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-[#0E9E78]/10 border-[#0E9E78]/20';
      case 'degraded': return 'bg-[#D4820A]/10 border-[#D4820A]/20';
      case 'down': return 'bg-[#C94A2A]/10 border-[#C94A2A]/20';
      case 'standby': return 'bg-[var(--bg-secondary)] border-[var(--border-primary)]';
      default: return 'bg-[var(--bg-secondary)] border-[var(--border-primary)]';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <ShieldCheck className="w-4 h-4 text-[#0E9E78]" />;
      case 'degraded': return <ShieldAlert className="w-4 h-4 text-[#D4820A]" />;
      case 'down': return <ShieldAlert className="w-4 h-4 text-[#C94A2A]" />;
      case 'standby': return <Shield className="w-4 h-4 text-[var(--text-muted)]" />;
      default: return <Shield className="w-4 h-4 text-[var(--text-muted)]" />;
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${
          overallStatus === 'healthy' ? 'bg-[#0E9E78]' :
          overallStatus === 'degraded' ? 'bg-[#D4820A]' :
          overallStatus === 'unknown' ? 'bg-[var(--text-muted)]' : 'bg-[#C94A2A]'
        } ${overallStatus === 'healthy' ? 'animate-pulse' : overallStatus === 'unknown' ? '' : 'animate-ping'}`} />
        <span className="text-[8px] font-mono text-[var(--text-muted)]">
          {overallStatus.toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusIcon(overallStatus)}
          <h3 className="text-[11px] font-mono font-bold text-[var(--text-primary)] uppercase tracking-wider">
            System Health
          </h3>
          <span className={`text-[8px] font-mono uppercase font-bold ${getStatusColor(overallStatus)}`}>
            {overallStatus}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[7px] font-mono text-[var(--text-muted)]">
            <Clock className="w-2.5 h-2.5" />
            {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'Checking…'}
          </div>
          <button
            onClick={refreshHealth}
            className="p-1 hover:bg-[#1E6FD9]/10 rounded text-[#1E6FD9] cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Service Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {services.map((service) => (
          <div
            key={service.name}
            className={`flex items-center justify-between p-3 rounded-lg border ${getStatusBg(service.status)} transition-all`}
          >
            <div className="flex items-center gap-2.5">
              <span className={getStatusColor(service.status)}>
                {service.icon}
              </span>
              <div>
                <p className="text-[9px] font-mono font-bold text-[var(--text-primary)]">{service.name}</p>
                <p className={`text-[7.5px] font-mono uppercase ${getStatusColor(service.status)}`}>
                  {service.status}
                </p>
              </div>
            </div>
            <span className="text-[8px] font-mono text-[var(--text-muted)]">
              {service.latency}
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[8px] font-mono text-[var(--text-muted)] border-t border-border-color pt-2">
        <span>Probe: /health/ready</span>
        <span>Healthy: {services.filter(s => s.status === 'healthy').length}/{services.length}</span>
      </div>
    </div>
  );
};

export default SystemHealth;

