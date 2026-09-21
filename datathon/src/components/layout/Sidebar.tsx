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

const ROLE_ACCENT: Record<string, string> = {
  ADMIN: 'coral',
  SP: 'amber',
  INSPECTOR: 'cyan',
  SCRB: 'blue',
  IO: 'teal',
  FORENSIC: 'purple',
  VIEWER: 'muted',
};

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
        { id: 'dashboard', label: t.nav_dashboard, path: '/dashboard', icon: <LayoutDashboard /> },
        { id: 'command_center', label: t.nav_command_center, path: '/command-center', icon: <Crosshair /> },
        { id: 'notifications', label: t.nav_notifications, path: '/notifications', icon: <Bell /> },
        { id: 'anomaly', label: t.nav_anomaly, path: '/anomalies', icon: <AlertTriangle /> },
        { id: 'strategic', label: t.nav_strategic, path: '/strategic', icon: <Shield /> },
        { id: 'intelligence_fusion', label: t.nav_intelligence_fusion, path: '/intelligence-fusion', icon: <Radar /> },
      ],
    },
    {
      label: 'INVESTIGATIONS',
      items: [
        { id: 'crime_cases', label: t.nav_crime_cases, path: '/crime-cases', icon: <FolderOpen /> },
        { id: 'investigation', label: t.nav_investigation, path: '/investigation', icon: <Crosshair /> },
        { id: 'fir', label: t.nav_fir, path: '/firs', icon: <FileWarning /> },
        { id: 'evidence', label: t.nav_evidence, path: '/evidence', icon: <ShieldCheck /> },
        { id: 'investigation_intelligence', label: t.nav_intelligence_engine, path: '/intelligence-engine', icon: <Sparkles /> },
      ],
    },
    {
      label: 'ANALYTICS',
      items: [
        { id: 'hotspot', label: t.nav_hotspot, path: '/hotspots', icon: <Map /> },
        { id: 'network', label: t.nav_network, path: '/network', icon: <Network /> },
        { id: 'predictive', label: t.nav_predictive, path: '/predictions', icon: <Brain /> },
        { id: 'sociological', label: t.nav_sociological, path: '/sociological', icon: <Globe2 /> },
        { id: 'identity', label: t.nav_identity, path: '/identity-resolution', icon: <FileWarning /> },
        { id: 'reports', label: t.nav_reports, path: '/reports', icon: <BarChart3 /> },
      ],
    },
    {
      label: 'REGISTRY',
      items: [
        { id: 'offenders', label: t.nav_offenders, path: '/offenders', icon: <ShieldAlert /> },
        { id: 'criminals', label: t.nav_criminals, path: '/criminals', icon: <Users /> },
        { id: 'victims', label: t.nav_victims, path: '/victims', icon: <Heart /> },
        { id: 'officers', label: t.nav_officers, path: '/officers', icon: <UserCog /> },
      ],
    },
    {
      label: 'TOOLS',
      items: [
        { id: 'ai_chat', label: t.nav_ai_chat, path: '/ai-chat', icon: <MessageSquare /> },
        { id: 'face_recognition', label: t.nav_face_recognition, path: '/face-recognition', icon: <ScanFace /> },
        { id: 'docs', label: t.nav_docs, path: '/docs', icon: <BookOpen /> },
        { id: 'settings_help', label: t.nav_settings, path: '/settings', icon: <Settings /> },
        { id: 'admin', label: t.nav_admin, path: '/admin', icon: <ShieldAlert /> },
      ],
    },
  ];

  const filteredNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.id === 'admin') return isAdmin;
        return true;
      }),
    }))
    .filter((group) => group.items.length > 0);

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
  const initials = (user?.name ?? 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

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
          sk-sidebar transition-all duration-300 ease-in-out select-none
          ${sidebarWidth}
          max-md:fixed max-md:top-0 max-md:bottom-0 max-md:left-0
          ${collapsed ? 'max-md:-translate-x-full max-md:w-0 max-md:border-none' : 'max-md:translate-x-0 max-md:w-[280px]'}
        `}
        style={{ zIndex: 200 }}
      >
        {/* Logo header */}
        <div className={`sk-sidebar-logo ${collapsed ? 'justify-center px-2' : 'justify-between'}`}>
          <div className={`flex items-center overflow-hidden ${collapsed ? 'gap-0' : 'gap-2.5'}`}>
            <div className="sk-mark shrink-0">
              <img src="/logo.svg" alt="Saksha" className="w-6 h-6" />
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="sk-word">Saksha</span>
                <span className="sk-sublabel">KSP Intel</span>
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

        {/* Operator clearance (role-aware) */}
        {user && !collapsed && (
          <div className="sk-clearance">
            <div className="sk-clearance-row">
              <span className="sk-clear-label">Clearance</span>
              <span className="sk-clear-val" data-accent={ROLE_ACCENT[user.role] || undefined}>{user.role}</span>
            </div>
            <div className="sk-clearance-row">
              <span className="sk-clear-id truncate">{user.badgeId}</span>
              <span className="sk-clear-id truncate">{user.district || user.station || user.name.split(' ')[0]}</span>
            </div>
          </div>
        )}

        {/* Navigation groups */}
        <nav className="sk-nav">
          {filteredNavGroups.map((group) => {
            const allowedItems = group.items.filter((item) => checkPermission(item.path));
            if (allowedItems.length === 0) return null;

            return (
              <div key={group.label} className="sk-nav-group">
                {!collapsed && <div className="sk-nav-group-label">{group.label}</div>}
                <div>
                  {allowedItems.map((item) => {
                    const isActive = activeTab === item.id;
                    const hasNotification = item.id === 'notifications' && unread > 0;

                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item)}
                        className={`sk-nav-item ${isActive ? 'is-active' : ''} ${collapsed ? 'is-collapsed' : ''}`}
                        title={collapsed ? item.label : undefined}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <span className="sk-nav-rail" />
                        <span className="sk-nav-icon">{item.icon}</span>
                        {!collapsed && <span className="truncate">{item.label}</span>}
                        {hasNotification && <span className="sk-nav-dot" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Operator footer */}
        {user && (
          <div className={`sk-sidebar-foot ${collapsed ? 'flex justify-center' : ''}`}>
            {!collapsed ? (
              <div className="sk-sidebar-user">
                <span className="sk-avatar">{initials}</span>
                <div className="sk-user-meta">
                  <div className="sk-user-name truncate">{user.name}</div>
                  <div className="sk-user-sub">Saksha CORE · live</div>
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
              <>
                <span className="sk-avatar" title={`${user.name} · ${user.role}`}>{initials}</span>
                <button
                  onClick={handleLogout}
                  className="ml-2 p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-coral)] hover:bg-[var(--accent-coral-subtle)] transition-colors cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;