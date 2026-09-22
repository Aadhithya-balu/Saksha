import React from 'react';
import { useRBAC } from '../../hooks/useRBAC';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useTranslation } from '../../i18n';
import {
  LayoutDashboard,
  Map,
  Network,
  Brain,
  Bell,
  AlertTriangle,
  Users,
  Shield,
  ShieldAlert,
  Heart,
  BarChart3,
  Globe2,
  MessageSquare,
  UserCog,
  FolderOpen,
  Settings,
  BookOpen,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  FileWarning,
  ShieldCheck,
  Sparkles,
  ScanFace,
  Radar,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  collapsed,
  setCollapsed,
}) => {
  const { user } = useAuthStore();
  const { checkPermission, isAdmin } = useRBAC();
  const { unread } = useNotificationStore((s) => s.counts);
  const setMobileMenuOpen = useAppStore((s) => s.setMobileMenuOpen);
  const t = useTranslation();

  const navGroups: NavGroup[] = [
    {
      label: 'COMMAND',
      items: [
        { id: 'command_center', label: t.nav_command_center, path: '/command-center', icon: <Crosshair className="w-[18px] h-[18px]" /> },
        { id: 'dashboard', label: t.nav_dashboard, path: '/dashboard', icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
      ],
    },
    {
      label: 'INVESTIGATION',
      items: [
        { id: 'crime_cases', label: t.nav_crime_cases, path: '/crime-cases', icon: <FolderOpen className="w-[18px] h-[18px]" /> },
        { id: 'fir', label: t.nav_fir, path: '/firs', icon: <FileWarning className="w-[18px] h-[18px]" /> },
        { id: 'investigation', label: t.nav_investigation, path: '/investigation', icon: <Crosshair className="w-[18px] h-[18px]" /> },
        { id: 'evidence', label: t.nav_evidence, path: '/evidence', icon: <ShieldCheck className="w-[18px] h-[18px]" /> },
      ],
    },
    {
      label: 'ENTITIES',
      items: [
        { id: 'criminals', label: t.nav_criminals, path: '/criminals', icon: <Users className="w-[18px] h-[18px]" /> },
        { id: 'victims', label: t.nav_victims, path: '/victims', icon: <Heart className="w-[18px] h-[18px]" /> },
        { id: 'offenders', label: t.nav_offenders, path: '/offenders', icon: <ShieldAlert className="w-[18px] h-[18px]" /> },
        { id: 'officers', label: t.nav_officers, path: '/officers', icon: <UserCog className="w-[18px] h-[18px]" /> },
        { id: 'identity', label: t.nav_identity, path: '/identity-resolution', icon: <FileWarning className="w-[18px] h-[18px]" /> },
      ],
    },
    {
      label: 'INTELLIGENCE',
      items: [
        { id: 'intelligence_fusion', label: t.nav_intelligence_fusion, path: '/intelligence-fusion', icon: <Radar className="w-[18px] h-[18px]" /> },
        { id: 'network', label: t.nav_network, path: '/network', icon: <Network className="w-[18px] h-[18px]" /> },
        { id: 'hotspot', label: t.nav_hotspot, path: '/hotspots', icon: <Map className="w-[18px] h-[18px]" /> },
        { id: 'predictive', label: t.nav_predictive, path: '/predictions', icon: <Brain className="w-[18px] h-[18px]" /> },
        { id: 'anomaly', label: t.nav_anomaly, path: '/anomalies', icon: <AlertTriangle className="w-[18px] h-[18px]" /> },
        { id: 'strategic', label: t.nav_strategic, path: '/strategic', icon: <Shield className="w-[18px] h-[18px]" /> },
        { id: 'sociological', label: t.nav_sociological, path: '/sociological', icon: <Globe2 className="w-[18px] h-[18px]" /> },
      ],
    },
    {
      label: 'AI',
      items: [
        { id: 'ai_chat', label: t.nav_ai_chat, path: '/ai-chat', icon: <MessageSquare className="w-[18px] h-[18px]" /> },
        { id: 'investigation_intelligence', label: t.nav_intelligence_engine, path: '/intelligence-engine', icon: <Sparkles className="w-[18px] h-[18px]" /> },
        { id: 'face_recognition', label: t.nav_face_recognition, path: '/face-recognition', icon: <ScanFace className="w-[18px] h-[18px]" /> },
        { id: 'ai_jobs', label: 'Processing Center', path: '/ai/jobs', icon: <Network className="w-[18px] h-[18px]" /> },
        { id: 'ai_review', label: 'Entity Review', path: '/ai/review', icon: <ShieldCheck className="w-[18px] h-[18px]" /> },
      ],
    },
    {
      label: 'SYSTEM',
      items: [
        { id: 'reports', label: t.nav_reports, path: '/reports', icon: <BarChart3 className="w-[18px] h-[18px]" /> },
        { id: 'notifications', label: t.nav_notifications, path: '/notifications', icon: <Bell className="w-[18px] h-[18px]" /> },
        { id: 'admin', label: t.nav_admin, path: '/admin', icon: <ShieldAlert className="w-[18px] h-[18px]" /> },
        { id: 'docs', label: t.nav_docs, path: '/docs', icon: <BookOpen className="w-[18px] h-[18px]" /> },
        { id: 'settings_help', label: t.nav_settings, path: '/settings', icon: <Settings className="w-[18px] h-[18px]" /> },
      ],
    },
  ];

  const filteredNavGroups = navGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if (item.id === 'admin') return isAdmin;
      return true;
    }),
  })).filter(group => group.items.length > 0);

  const handleLogout = () => {
    useAuthStore.getState().logout();
  };

  const handleNavClick = (item: NavItem) => {
    setActiveTab(item.id);
    if (window.innerWidth < 768) {
      setCollapsed(true);
      setMobileMenuOpen(false);
    }
  };

  const sidebarWidth = collapsed ? 'w-[64px]' : 'w-[260px]';

  return (
    <>
      {/* Mobile backdrop */}
      {!collapsed && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
          style={{ zIndex: 190 }}
          onClick={() => { setCollapsed(true); setMobileMenuOpen(false); }}
        />
      )}

      <aside
        className={`
          h-screen flex flex-col bg-[var(--bg-secondary)] border-r border-[var(--border-primary)]
          transition-all duration-300 ease-in-out select-none
          ${sidebarWidth}
          max-md:fixed max-md:top-0 max-md:bottom-0 max-md:left-0
          ${collapsed ? 'max-md:-translate-x-full max-md:w-0 max-md:border-none' : 'max-md:translate-x-0 max-md:w-[280px]'}
        `}
        style={{ zIndex: 200 }}
      >
        {/* Logo Header */}
        <div className={`h-16 flex items-center border-b border-[var(--border-primary)] shrink-0 ${collapsed ? 'justify-center px-2' : 'px-5 justify-between'}`}>
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-blue-subtle)] border border-[var(--accent-blue)]/20 flex items-center justify-center shrink-0 overflow-hidden">
              <img src="/logo.svg" alt="Saksha" className="w-6 h-6" />
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold tracking-wide text-[var(--text-primary)] uppercase">Saksha</span>
                <span className="text-[10px] font-mono text-[var(--accent-teal)] uppercase tracking-wider">KSP Intel Platform</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {filteredNavGroups.map((group) => {
            const allowedItems = group.items.filter((item) => checkPermission(item.path));
            if (allowedItems.length === 0) return null;

            return (
              <div key={group.label} className="mb-4">
                {!collapsed && (
                  <div className="px-3 mb-1.5 text-[10px] font-semibold tracking-[0.1em] text-[var(--text-disabled)] uppercase select-none">
                    {group.label}
                  </div>
                )}
                <div className="space-y-0.5">
                  {allowedItems.map((item) => {
                    const isActive = activeTab === item.id;
                    const hasNotification = item.id === 'notifications' && unread > 0;

                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item)}
                        className={`
                          relative w-full flex items-center rounded-lg text-[13px] font-medium transition-all duration-150 cursor-pointer
                          ${collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'}
                          ${isActive
                            ? 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue-light)] border border-[var(--accent-blue)]/20'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] border border-transparent'
                          }
                        `}
                        title={collapsed ? item.label : undefined}
                      >
                        <span className={`shrink-0 transition-transform duration-150 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`}>
                          {item.icon}
                        </span>
                        {!collapsed && <span className="truncate">{item.label}</span>}

                        {/* Notification dot */}
                        {hasNotification && (
                          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[var(--accent-coral)] rounded-full animate-sk-pulse-dot" />
                        )}

                        {/* Active indicator line */}
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[var(--accent-blue)] rounded-r-full" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* User Profile Footer */}
        {user && (
          <div className={`border-t border-[var(--border-primary)] p-3 shrink-0 ${collapsed ? 'flex justify-center' : ''}`}>
            {!collapsed ? (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[var(--accent-blue-subtle)] border border-[var(--accent-blue)]/20 flex items-center justify-center text-[var(--accent-blue)] font-bold font-mono text-sm shrink-0">
                  {user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{user.name}</div>
                  <div className="text-[11px] font-mono text-[var(--text-muted)]">{user.badgeId} &middot; {user.role}</div>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--accent-coral)] hover:bg-[var(--accent-coral-subtle)] transition-colors cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-coral)] hover:bg-[var(--accent-coral-subtle)] transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;
