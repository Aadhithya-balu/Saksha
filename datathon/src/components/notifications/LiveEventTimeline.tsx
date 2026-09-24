import React, { useEffect, useState, useRef } from 'react';
import { Activity, Clock, RefreshCw, Filter, FileText, UserCheck, AlertTriangle, Shield, Eye } from 'lucide-react';
import { getLiveTimeline } from '../../services/api';

interface LiveEventTimelineProps {
  caseId?: string;
  limit?: number;
  compact?: boolean;
}

interface TimelineEvent {
  id: string;
  timestamp: string;
  type: string;
  action: string;
  resource_type: string;
  details: string;
  actor: string | null;
  actor_badge: string | null;
}

export const LiveEventTimeline: React.FC<LiveEventTimelineProps> = ({
  caseId,
  limit = 30,
  compact = false,
}) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filterType, setFilterType] = useState<string>('');
  const listRef = useRef<HTMLDivElement>(null);

  const loadEvents = async () => {
    try {
      const data = await getLiveTimeline(caseId, limit);
      let filtered = data;
      if (filterType) {
        filtered = data.filter((e: TimelineEvent) => e.type === filterType);
      }
      setEvents(filtered);
    } catch {
      // Keep current state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
    let interval: ReturnType<typeof setInterval> | null = null;
    if (autoRefresh) {
      interval = setInterval(loadEvents, 60000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [caseId, autoRefresh, filterType]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'audit': return <Eye className="w-3.5 h-3.5" />;
      case 'notification': return <AlertTriangle className="w-3.5 h-3.5" />;
      default: return <Activity className="w-3.5 h-3.5" />;
    }
  };

  const getResourceIcon = (resourceType: string) => {
    if (resourceType.includes('Case') || resourceType.includes('case')) return <FileText className="w-3.5 h-3.5" />;
    if (resourceType.includes('User') || resourceType.includes('Officer')) return <UserCheck className="w-3.5 h-3.5" />;
    if (resourceType.includes('alert') || resourceType.includes('Alert')) return <AlertTriangle className="w-3.5 h-3.5" />;
    return <Shield className="w-3.5 h-3.5" />;
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'audit': return 'border-l-[#1E6FD9]';
      case 'notification': return 'border-l-[#D4820A]';
      default: return 'border-l-[#6A7A96]';
    }
  };

  if (compact) {
    return (
      <div className="flex flex-col gap-1.5">
        {loading ? (
          <div className="flex items-center justify-center py-3">
            <div className="w-4 h-4 rounded-full border-2 border-[#1E6FD9] border-t-transparent animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-3 text-[8px] font-mono text-[var(--text-muted)]">No events</div>
        ) : (
          events.slice(0, 5).map((event) => (
            <div key={event.id} className={`flex items-start gap-2 pl-2 border-l-2 ${getEventColor(event.type)}`}>
              <span className="text-[var(--text-muted)] mt-0.5 shrink-0">{getEventIcon(event.type)}</span>
              <div className="min-w-0">
                <p className="text-[8px] font-mono text-[var(--text-primary)] truncate max-w-[180px]">{event.action}</p>
                <p className="text-[6.5px] font-mono text-[var(--text-muted)]">
                  {event.actor || 'System'} • {new Date(event.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#1E6FD9]" />
          <h3 className="text-[11px] font-mono font-bold text-[var(--text-primary)] uppercase tracking-wider">
            Live Event Timeline
          </h3>
          <span
            className="px-1.5 py-0.5 rounded text-[7px] font-bold font-mono bg-[#0E9E78]/10 border border-[#0E9E78]/20 text-[#0E9E78]"
            title="This feed refreshes from the activity timeline on a 60s poll — it is not a push stream."
          >
            {autoRefresh ? 'POLLING·60S' : 'PAUSED'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`p-1 rounded cursor-pointer transition-colors ${
              autoRefresh ? 'bg-[#0E9E78]/10 text-[#0E9E78]' : 'bg-[var(--bg-tertiary)]/60 text-[var(--text-muted)]'
            }`}
            title={autoRefresh ? 'Pause auto-refresh' : 'Resume auto-refresh'}
          >
            <Clock className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={loadEvents}
            className="p-1 hover:bg-[#1E6FD9]/10 rounded text-[#1E6FD9] cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-3 h-3 text-[var(--text-muted)]" />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="flex-1 px-2 py-1 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded text-[9px] font-mono text-[var(--text-secondary)] outline-none focus:border-[#1E6FD9] cursor-pointer"
        >
          <option value="">All Events</option>
          <option value="audit">Audit Events</option>
          <option value="notification">Notifications</option>
        </select>
      </div>

      {/* Timeline */}
      <div ref={listRef} className="flex-1 overflow-y-auto custom-scrollbar max-h-[400px] relative pl-4">
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[var(--bg-tertiary)]/20" />

        {loading && events.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 rounded-full border-2 border-[#1E6FD9] border-t-transparent animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2 opacity-40" />
            <p className="text-[9px] font-mono text-[var(--text-muted)]">No timeline events</p>
          </div>
        ) : (
          <div className="space-y-1">
            {events.map((event, index) => (
              <div key={event.id || index} className="relative pb-3">
                {/* Dot */}
                <div className={`absolute -left-[13px] top-1.5 w-2.5 h-2.5 rounded-full border-2 ${
                  event.type === 'audit' ? 'border-[#1E6FD9] bg-[#1E6FD9]/20' :
                  event.type === 'notification' ? 'border-[#D4820A] bg-[#D4820A]/20' :
                  'border-[#6A7A96] bg-[#6A7A96]/20'
                }`} />

                <div className="flex items-start gap-2.5">
                  <span className="mt-1 text-[var(--text-muted)] shrink-0">
                    {getResourceIcon(event.resource_type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono font-bold text-[var(--text-primary)] truncate">
                        {event.action}
                      </span>
                      <span className="shrink-0 text-[6.5px] font-mono uppercase px-1 py-0.5 rounded bg-[var(--bg-tertiary)]/5 text-[var(--text-muted)]">
                        {event.type}
                      </span>
                    </div>
                    {event.details && (
                      <p className="text-[7.5px] font-mono text-[var(--text-secondary)] mt-0.5 line-clamp-1">
                        {event.details}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      {event.actor && (
                        <span className="text-[6.5px] font-mono text-[var(--text-muted)]">
                          {event.actor}
                        </span>
                      )}
                      <span className="text-[6.5px] font-mono text-[var(--text-muted)]">
                        {new Date(event.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveEventTimeline;

