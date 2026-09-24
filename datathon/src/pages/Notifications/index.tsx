import React, { useEffect, useState } from 'react';
import {
  Radio, ListTodo, Clock, RefreshCw, CheckCheck, ChevronLeft, ChevronRight, RotateCcw,
} from 'lucide-react';
import { useNotificationStore } from '../../store/notificationStore';
import type { NotificationRecord } from '../../services/api';
import SummaryCards from '../../components/notifications/SummaryCards';
import NotificationFilters from '../../components/notifications/NotificationFilters';
import NotificationCard from '../../components/notifications/NotificationCard';
import CommunicationTimeline from '../../components/notifications/CommunicationTimeline';
import InformStationModal from '../../components/notifications/InformStationModal';
import NotificationDetailModal from '../../components/notifications/NotificationDetailModal';
import ActivityFeed from '../../components/notifications/ActivityFeed';
import SystemHealth from '../../components/notifications/SystemHealth';
import { useRealtimeStore } from '../../store/realtimeStore';
import { useRBAC } from '../../hooks/useRBAC';
import { TableSkeleton } from '../../components/ui/Skeleton';

type TabView = 'messages' | 'timeline' | 'activity' | 'health';

const NotificationsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabView>('messages');
  const [detailNotification, setDetailNotification] = useState<NotificationRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { isNotificationWriter } = useRBAC();

  const {
    notifications, total, page, pageSize, loading, error, counts, dashboard,
    fetchNotifications, fetchCounts, fetchDashboard, markAllRead,
    setPage,
    informModalOpen, setInformModalOpen,
    setFilter, clearFilters, removeAllBroadcasts,
  } = useNotificationStore();

  useEffect(() => {
    fetchNotifications(1);
    fetchCounts();
    fetchDashboard();
  }, []);

  // Subscribe to the realtime SSE stream while this control center is open, so
  // the Health tab reports the stream as active and live case events flow in.
  // The store is reference-counted: if Overview/Crime Cases are also mounted
  // the stream stays open, and it is fully torn down on unmount via disconnect.
  useEffect(() => {
    useRealtimeStore.getState().connect();
    return () => useRealtimeStore.getState().disconnect();
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleFilterBy = (key: string, value: string) => {
    setFilter(key, value);
  };

  const handleSelectNotification = (n: NotificationRecord) => {
    setDetailNotification(n);
    setDetailOpen(true);
  };

  const tabs: { id: TabView; label: string; icon: React.ReactNode }[] = [
    { id: 'messages', label: 'Messages', icon: <ListTodo className="w-4 h-4" /> },
    { id: 'timeline', label: 'Timeline', icon: <Clock className="w-4 h-4" /> },
    { id: 'activity', label: 'Activity', icon: <RefreshCw className="w-4 h-4" /> },
    { id: 'health', label: 'Health', icon: <span className="w-2 h-2 rounded-full bg-[#0E9E78] inline-block" /> },
  ];

  return (
    <div className="min-h-[84vh] flex flex-col gap-4 p-1 md:p-3 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[var(--border-muted)] pb-3 shrink-0">
        <div>
          <h2 className="text-md font-mono font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
            <Radio className="w-5 h-5 text-[#1E6FD9]" />
            Communication Center
          </h2>
          <p className="text-[9.5px] font-mono text-[var(--text-muted)] mt-0.5">
            INTER-STATION NOTIFICATION & INTELLIGENCE COMMAND
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isNotificationWriter && (dashboard?.broadcast_messages ?? 0) > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Remove ALL broadcast notifications? This cannot be undone.')) {
                  removeAllBroadcasts();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#F472B6]/10 text-[#F472B6] rounded-lg text-[9px] font-mono font-bold hover:bg-[#F472B6]/20 transition-colors cursor-pointer"
            >
              <Radio className="w-3.5 h-3.5" />
              Remove All Broadcasts
            </button>
          )}
          {counts.unread > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 px-3 py-2 bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] rounded-lg text-[9px] font-mono font-bold hover:bg-[var(--accent-blue)]/20 transition-colors cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark All Read
            </button>
          )}
          {isNotificationWriter && (
            <button
              onClick={() => setInformModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/90 text-white rounded-lg text-[9px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm"
            >
              <Radio className="w-3.5 h-3.5" />
              Inform Station
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards onFilterBy={handleFilterBy} />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border-muted)] shrink-0 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-[9.5px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer border-b-2 ${
              activeTab === tab.id
                ? 'text-[var(--text-primary)] border-[#1E6FD9] bg-[#1E6FD9]/5'
                : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {activeTab === 'messages' && (
          <div className="space-y-3">
            {/* Filters */}
            <NotificationFilters />

            {/* Error */}
            {error && (
              <div className="p-3 bg-[#C94A2A]/10 border border-[#C94A2A]/20 rounded-xl text-[10px] font-mono text-[#C94A2A]">
                {error}
              </div>
            )}

            {/* Notification List */}
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
              {loading && notifications.length === 0 ? (
                <div className="p-4">
                  <TableSkeleton rows={5} cols={2} />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                  <Radio className="w-12 h-12 text-[var(--text-muted)] mb-3 opacity-30" />
                  <p className="text-[11px] font-mono text-[var(--text-muted)] uppercase font-bold">No messages found</p>
                  <p className="text-[9px] font-mono text-[var(--text-muted)]/60 mt-1">
                    Adjust filters or send a new notification
                  </p>
                  <button
                    onClick={clearFilters}
                    className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 bg-[var(--bg-tertiary)]/50 border border-[var(--border-primary)] rounded-lg text-[9px] font-mono text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-secondary)]/50">
                  {notifications.map((notif) => (
                    <NotificationCard
                      key={notif.id}
                      notification={notif}
                      onSelect={handleSelectNotification}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Pagination */}
            {total > 0 && (
              <div className="flex items-center justify-between px-1">
                <span className="text-[8px] font-mono text-[var(--text-muted)]">
                  Page {page} of {totalPages} ({total} messages)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                    className="p-1.5 hover:bg-[var(--accent-blue)]/10 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-blue)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages}
                    className="p-1.5 hover:bg-[var(--accent-blue)]/10 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-blue)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-[#1E6FD9]" />
              <h3 className="text-[11px] font-mono font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Communication Timeline
              </h3>
              <span className="text-[8px] font-mono text-[var(--text-muted)]">({notifications.length} events)</span>
            </div>
            <CommunicationTimeline notifications={notifications} />
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl p-4">
            <ActivityFeed limit={100} />
          </div>
        )}

        {activeTab === 'health' && (
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl p-4">
            <SystemHealth />
          </div>
        )}
      </div>

      {/* Modals */}
      <InformStationModal open={informModalOpen} onClose={() => setInformModalOpen(false)} />
      <NotificationDetailModal
        notification={detailNotification}
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailNotification(null); }}
      />
    </div>
  );
};

export default NotificationsPage;
