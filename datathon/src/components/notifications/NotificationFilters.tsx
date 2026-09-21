import React, { useMemo } from 'react';
import { Search, Filter, X, RotateCcw } from 'lucide-react';
import { useNotificationStore } from '../../store/notificationStore';

const CATEGORIES = [
  { value: 'investigation_update', label: 'Investigation Update' },
  { value: 'evidence_request', label: 'Evidence Request' },
  { value: 'crime_alert', label: 'Crime Alert' },
  { value: 'case_escalation', label: 'Case Escalation' },
  { value: 'intelligence_sharing', label: 'Intelligence Sharing' },
  { value: 'emergency_broadcast', label: 'Emergency' },
  { value: 'system_notification', label: 'System' },
  { value: 'administrative', label: 'Admin' },
];

const PRIORITIES = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const STATUSES = [
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'broadcast', label: 'Broadcast' },
];

export const NotificationFilters: React.FC = () => {
  const {
    searchQuery, setSearch,
    filterCategory, filterPriority, filterStatus, filterSender,
    setFilter, clearFilters,
  } = useNotificationStore();

  const notifications = useNotificationStore((s) => s.notifications);

  // Sender options are derived from real notifications actually in the feed,
  // never from a hardcoded list of people.
  const senders = useMemo(() => {
    const seen = new Map<string, string>();
    notifications.forEach((n) => {
      if (!n.sender_badge) return;
      if (!seen.has(n.sender_badge)) {
        seen.set(n.sender_badge, n.sender_name ? `${n.sender_badge} (${n.sender_name})` : n.sender_badge);
      }
    });
    return Array.from(seen, ([value, label]) => ({ value, label }));
  }, [notifications]);

  const hasActiveFilters = filterCategory || filterPriority || filterStatus || filterSender;

  return (
    <div className="space-y-3">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by subject, message, case number, FIR number..."
          className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl text-[11px] font-mono text-[var(--text-primary)] placeholder-[var(--text-disabled)] outline-none focus:border-[var(--accent-blue)] transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-[var(--bg-tertiary)] rounded-md text-[var(--text-muted)] cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Filter Row */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />

        <select
          value={filterCategory}
          onChange={(e) => setFilter('filterCategory', e.target.value)}
          className="px-2.5 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-[9px] font-mono text-[var(--text-secondary)] outline-none focus:border-[var(--accent-blue)] cursor-pointer"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        <select
          value={filterPriority}
          onChange={(e) => setFilter('filterPriority', e.target.value)}
          className="px-2.5 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-[9px] font-mono text-[var(--text-secondary)] outline-none focus:border-[var(--accent-blue)] cursor-pointer"
        >
          <option value="">All Priorities</option>
          {PRIORITIES.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilter('filterStatus', e.target.value)}
          className="px-2.5 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-[9px] font-mono text-[var(--text-secondary)] outline-none focus:border-[var(--accent-blue)] cursor-pointer"
        >
          <option value="">All Statuses</option>
          {STATUSES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <select
          value={filterSender}
          onChange={(e) => setFilter('filterSender', e.target.value)}
          className="px-2.5 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-[9px] font-mono text-[var(--text-secondary)] outline-none focus:border-[var(--accent-blue)] cursor-pointer"
        >
          <option value="">All Senders</option>
          {senders.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-[#C94A2A]/10 rounded-lg text-[#C94A2A] text-[9px] font-mono font-bold cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
};

export default NotificationFilters;
