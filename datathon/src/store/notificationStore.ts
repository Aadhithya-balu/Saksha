import { create } from 'zustand';
import {
  getNotificationCount,
  getRecentNotifications,
  getNotifications,
  getNotificationDashboard,
  createNotification,
  markNotificationRead,
  markAllNotificationsRead,
  acknowledgeNotification,
  resolveNotification,
  dismissNotification,
  deleteNotification,
  deleteAllBroadcasts,
} from '../services/api';
import type { NotificationRecord, NotificationCount, NotificationDashboardSummary } from '../services/api';

interface NotificationState {
  // Data
  notifications: NotificationRecord[];
  recentNotifications: NotificationRecord[];
  counts: NotificationCount;
  dashboard: NotificationDashboardSummary | null;
  total: number;
  page: number;
  pageSize: number;
  
  // Filters
  searchQuery: string;
  filterCategory: string;
  filterPriority: string;
  filterStatus: string;
  filterSender: string;
  filterDate: string;

  // UI State
  loading: boolean;
  loadingRecent: boolean;
  loadingDashboard: boolean;
  error: string | null;
  countsError: boolean;
  pollIntervalId: ReturnType<typeof setInterval> | null;
  informModalOpen: boolean;

  // Actions
  fetchNotifications: (page?: number, pageSize?: number, unreadOnly?: boolean, notificationType?: string, severity?: string) => Promise<void>;
  fetchCounts: () => Promise<void>;
  fetchRecent: () => Promise<void>;
  fetchDashboard: () => Promise<void>;
  sendNotification: (payload: {
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
  }) => Promise<boolean>;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  acknowledge: (notificationId: string) => Promise<void>;
  resolve: (notificationId: string) => Promise<void>;
  dismiss: (notificationId: string) => Promise<void>;
  removeNotification: (notificationId: string) => Promise<void>;
  removeAllBroadcasts: () => Promise<void>;
  setSearch: (q: string) => void;
  setFilter: (key: string, value: string) => void;
  clearFilters: () => void;
  setInformModalOpen: (open: boolean) => void;
  startPolling: (intervalMs?: number) => void;
  stopPolling: () => void;
  setPage: (page: number) => void;
  clearNotifications: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  recentNotifications: [],
  counts: { total: 0, unread: 0, critical: 0 },
  dashboard: null,
  total: 0,
  page: 1,
  pageSize: 20,
  searchQuery: '',
  filterCategory: '',
  filterPriority: '',
  filterStatus: '',
  filterSender: '',
  filterDate: '',
  loading: false,
  loadingRecent: false,
  loadingDashboard: false,
  error: null,
  countsError: false,
  pollIntervalId: null,
  informModalOpen: false,

  fetchNotifications: async (page, pageSize, unreadOnly, notificationType, severity) => {
    set({ loading: true, error: null });
    try {
      const p = page ?? get().page;
      const ps = pageSize ?? get().pageSize;
      const { searchQuery, filterCategory, filterPriority, filterStatus, filterSender } = get();
      const response = await getNotifications(
        p, ps,
        unreadOnly ?? false,
        notificationType,
        severity,
        filterPriority || undefined,
        filterCategory || undefined,
        filterStatus || undefined,
        filterSender || undefined,
        searchQuery || undefined,
      );
      set({
        notifications: response.results,
        total: response.total,
        page: response.page,
        pageSize: response.page_size,
        loading: false,
      });
    } catch (err: any) {
      set({ error: err?.message || 'Failed to load notifications', loading: false });
    }
  },

  fetchCounts: async () => {
    try {
      const counts = await getNotificationCount();
      set({ counts, countsError: false, error: null });
    } catch (err: any) {
      // Keep the last-known counts instead of collapsing to zeros: a dash of 0
      // would wrongly claim there are no unread/critical messages (issue #282).
      set({ countsError: true, error: err?.message || 'Failed to refresh notification counts' });
    }
  },

  fetchRecent: async () => {
    set({ loadingRecent: true });
    try {
      const recent = await getRecentNotifications(5);
      set({ recentNotifications: recent, loadingRecent: false, error: null });
    } catch (err: any) {
      set({ loadingRecent: false, error: err?.message || 'Failed to load recent notifications' });
    }
  },

  fetchDashboard: async () => {
    set({ loadingDashboard: true });
    try {
      const dashboard = await getNotificationDashboard();
      set({ dashboard, loadingDashboard: false, error: null });
    } catch (err: any) {
      set({ loadingDashboard: false, error: err?.message || 'Failed to load dashboard summary' });
    }
  },

  sendNotification: async (payload) => {
    try {
      await createNotification(payload);
      await Promise.all([get().fetchNotifications(), get().fetchCounts(), get().fetchDashboard()]);
      return true;
    } catch (err: any) {
      set({ error: err?.message || 'Failed to send notification' });
      return false;
    }
  },

  markRead: async (notificationId) => {
    try {
      await markNotificationRead(notificationId);
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString(), status: 'read' } : n
        ),
        recentNotifications: state.recentNotifications.map((n) =>
          n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString(), status: 'read' } : n
        ),
      }));
      await get().fetchCounts();
    } catch (err: any) {
      set({ error: err?.message || 'Failed to mark notification as read' });
    }
  },

  markAllRead: async () => {
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, is_read: true, read_at: now, status: 'read' })),
        recentNotifications: state.recentNotifications.map((n) => ({ ...n, is_read: true, read_at: now, status: 'read' })),
        counts: { ...state.counts, unread: 0 },
      }));
    } catch (err: any) {
      set({ error: err?.message || 'Failed to mark all as read' });
    }
  },

  acknowledge: async (notificationId) => {
    try {
      await acknowledgeNotification(notificationId);
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === notificationId ? { ...n, is_read: true, status: 'acknowledged', acknowledged_at: new Date().toISOString() } : n
        ),
      }));
      await Promise.all([get().fetchCounts(), get().fetchDashboard()]);
    } catch (err: any) {
      set({ error: err?.message || 'Failed to acknowledge notification' });
    }
  },

  resolve: async (notificationId) => {
    try {
      await resolveNotification(notificationId);
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === notificationId ? { ...n, is_read: true, status: 'resolved', resolved_at: new Date().toISOString() } : n
        ),
      }));
      await Promise.all([get().fetchCounts(), get().fetchDashboard()]);
    } catch (err: any) {
      set({ error: err?.message || 'Failed to resolve notification' });
    }
  },

  dismiss: async (notificationId) => {
    try {
      await dismissNotification(notificationId);
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== notificationId),
        recentNotifications: state.recentNotifications.filter((n) => n.id !== notificationId),
      }));
      await Promise.all([get().fetchCounts(), get().fetchDashboard()]);
    } catch (err: any) {
      set({ error: err?.message || 'Failed to dismiss notification' });
    }
  },

  removeNotification: async (notificationId) => {
    try {
      await deleteNotification(notificationId);
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== notificationId),
        recentNotifications: state.recentNotifications.filter((n) => n.id !== notificationId),
      }));
      await Promise.all([get().fetchCounts(), get().fetchDashboard()]);
    } catch (err: any) {
      set({ error: err?.message || 'Failed to delete notification' });
    }
  },

  removeAllBroadcasts: async () => {
    try {
      await deleteAllBroadcasts();
      await Promise.all([
        get().fetchNotifications(),
        get().fetchRecent(),
        get().fetchCounts(),
        get().fetchDashboard(),
      ]);
    } catch (err: any) {
      set({ error: err?.message || 'Failed to remove broadcasts' });
    }
  },

  setSearch: (q) => {
    set({ searchQuery: q, page: 1 });
    get().fetchNotifications(1);
  },

  setFilter: (key, value) => {
    set({ [key]: value, page: 1 } as any);
    setTimeout(() => get().fetchNotifications(1), 0);
  },

  clearFilters: () => {
    set({
      searchQuery: '',
      filterCategory: '',
      filterPriority: '',
      filterStatus: '',
      filterSender: '',
      filterDate: '',
      page: 1,
    });
    setTimeout(() => get().fetchNotifications(1), 0);
  },

  setInformModalOpen: (open) => set({ informModalOpen: open }),

  startPolling: (intervalMs = 15000) => {
    const existing = get().pollIntervalId;
    if (existing) clearInterval(existing);

    const id = setInterval(async () => {
      await Promise.all([get().fetchCounts(), get().fetchRecent()]);
    }, intervalMs);

    set({ pollIntervalId: id });
  },

  stopPolling: () => {
    const id = get().pollIntervalId;
    if (id) {
      clearInterval(id);
      set({ pollIntervalId: null });
    }
  },

  setPage: (page) => {
    set({ page });
    get().fetchNotifications(page);
  },

  clearNotifications: () => {
    get().stopPolling();
    set({
      notifications: [],
      recentNotifications: [],
      counts: { total: 0, unread: 0, critical: 0 },
      dashboard: null,
      error: null,
    });
  },
}));
