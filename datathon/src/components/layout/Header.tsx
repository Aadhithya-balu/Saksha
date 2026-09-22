import React, { useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { SessionTimer } from '../auth/SessionTimer';
import {
  Search,
  Sun,
  Moon,
  Menu,
  Command,
  ChevronRight,
  Wifi,
  WifiOff,
  ChevronDown,
  KeyRound,
  LogOut,
  Sparkles,
} from 'lucide-react';
import NotificationBell from '../notifications/NotificationBell';
import DataModeBadge from '../ui/DataModeBadge';
import { isEmulatorActive } from '../../services/api';
import ChangePasswordModal from '../auth/ChangePasswordModal';

interface HeaderProps {
  sidebarCollapsed?: boolean;
  setSidebarCollapsed?: (collapsed: boolean) => void;
}

const pageLabels: Record<string, string> = {
  dashboard: 'Analytics Dashboard',
  command_center: 'Command Center',
  intelligence: 'Investigation Hub',
  identity: 'Identity Resolution & Data Integrity',
  fir: 'FIR Registry',
  hotspot: 'Hotspot Map',
  network: 'Network Graph',
  predictive: 'Predictive AI',
  anomaly: 'Anomaly Feed',
  crime_cases: 'Crime Cases',
  investigation: 'Investigation',
  notifications: 'Intelligence Center',
  sociological: 'Sociological Intelligence',
  strategic: 'Strategic Intelligence',
  offenders: 'Offender Registry',
  criminals: 'Criminal Dossiers',
  victims: 'Victims Registry',
  reports: 'Reports Center',
  settings_help: 'Settings',
  ai_chat: 'AI Assistant',
  officers: 'Officer Management',
  evidence: 'Evidence Handling',
  docs: 'Documentation',
};

export const Header: React.FC<HeaderProps> = ({ sidebarCollapsed, setSidebarCollapsed }) => {
  const { theme, toggleTheme, activeTab, setCommandPaletteOpen } = useAppStore();
  const user = useAuthStore((state) => state.user);
  const [emulatorActive, setEmulatorActive] = React.useState(isEmulatorActive);
  const [systime, setSystime] = React.useState(new Date().toLocaleTimeString());
  const [pwOpen, setPwOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const profileRef = React.useRef<HTMLDivElement>(null);

  const initials = (user?.name ?? 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    const handler = (e: Event) => setEmulatorActive((e as CustomEvent).detail);
    window.addEventListener('emulator-status-changed', handler);
    return () => window.removeEventListener('emulator-status-changed', handler);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setSystime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Ctrl+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setCommandPaletteOpen]);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const currentPage = pageLabels[activeTab] || 'Saksha';

  return (
    <header
      className="relative h-16 shrink-0 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]/70 backdrop-blur-md px-3 sm:px-4 md:px-6 flex items-center gap-3"
      style={{ zIndex: 100 }}
    >
      {/* Left: Mobile menu + Breadcrumbs */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 overflow-hidden">
        {setSidebarCollapsed && (
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="md:hidden shrink-0 p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Breadcrumbs */}
        <div className="flex items-center gap-1.5 text-sm min-w-0">
          <span className="text-[var(--text-muted)] hidden sm:inline shrink-0">Saksha</span>
          <ChevronRight className="w-3.5 h-3.5 text-[var(--text-disabled)] hidden sm:block shrink-0" />
          <span className="text-[var(--text-primary)] font-medium truncate">{currentPage}</span>
        </div>
      </div>

      {/* Center: Search trigger (flex sibling between two flex-1 sides, never overlaps) */}
      <button
        onClick={() => setCommandPaletteOpen(true)}
        className="hidden md:flex items-center gap-2 w-[200px] lg:w-[260px] shrink-0 px-3.5 py-2 bg-[var(--bg-tertiary)]/70 border border-[var(--border-primary)] rounded-full text-[var(--text-muted)] transition-all duration-200 cursor-pointer hover:border-[var(--accent-blue)]/40 hover:bg-[var(--bg-tertiary)] focus:outline-none"
      >
        <Search className="w-4 h-4 shrink-0 text-[var(--text-muted)]" />
        <span className="text-[13px] flex-1 text-left truncate">Search anything...</span>
        <kbd className="hidden xl:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded text-[var(--text-muted)]">
          <Command className="w-2.5 h-2.5" />K
        </kbd>
      </button>

      {/* Right: Actions */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0 justify-end">
        {/* Global data-mode indicator */}
        <div className="hidden 2xl:flex items-center">
          <DataModeBadge />
        </div>

        {/* Connection Status */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono rounded-md border border-[var(--border-secondary)]">
          {emulatorActive ? (
            <>
              <WifiOff className="w-3 h-3 text-[var(--accent-amber)]" />
              <span className="text-[var(--accent-amber)] uppercase tracking-wider">Offline</span>
            </>
          ) : (
            <>
              <Wifi className="w-3 h-3 text-[var(--accent-teal)]" />
              <span className="text-[var(--accent-teal)] uppercase tracking-wider">Online</span>
            </>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="relative shrink-0 flex items-center justify-center h-9 w-9 rounded-full border border-[var(--border-primary)] bg-[var(--bg-tertiary)]/60 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--accent-blue)]/40 transition-all cursor-pointer"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label="Toggle light/dark mode"
        >
          {theme === 'dark' ? (
            <Sun className="w-[18px] h-[18px] text-[var(--accent-amber)]" />
          ) : (
            <Moon className="w-[18px] h-[18px] text-[var(--accent-purple)]" />
          )}
        </button>

        {/* AI Assistant */}
        <button
          onClick={() => useAppStore.getState().setActiveTab('ai_chat')}
          className="relative shrink-0 flex items-center justify-center h-9 w-9 rounded-full border border-[var(--border-primary)] bg-[var(--bg-tertiary)]/60 text-[var(--accent-blue-light)] hover:text-[var(--accent-blue)] hover:bg-[var(--accent-blue-subtle)] hover:border-[var(--accent-blue)]/40 transition-all cursor-pointer"
          title="Open AI Investigator"
        >
          <Sparkles className="w-[18px] h-[18px]" />
        </button>

        {/* Notifications */}
        <NotificationBell />

        {/* Profile menu */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((o) => !o)}
            aria-haspopup="true"
            aria-expanded={profileOpen}
            className="flex items-center gap-2 rounded-full border border-[var(--border-primary)] bg-[var(--bg-tertiary)]/60 pl-1 pr-2 py-1 transition-all duration-150 hover:border-[var(--accent-blue)]/40 cursor-pointer"
            title="Account"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-blue-subtle)] border border-[var(--accent-blue)]/20 text-[11px] font-bold text-[var(--accent-blue)]">
              {initials}
            </span>
            <span className="hidden lg:flex flex-col items-start leading-none">
              <span className="text-xs font-semibold text-[var(--text-primary)]">{user?.name?.split(' ')[0] || 'Officer'}</span>
              <span className="text-[9px] font-mono uppercase tracking-wider text-[var(--text-muted)]">{user?.role || ''}</span>
            </span>
            <ChevronDown className={`hidden sm:block w-3.5 h-3.5 text-[var(--text-muted)] transition-transform duration-150 ${profileOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Profile dropdown */}
          {profileOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] w-64 z-[220] overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] shadow-[var(--shadow-xl)] sk-page-enter">
              {/* Header panel */}
              <div className="px-4 py-3 bg-[var(--bg-tertiary)]/60 border-b border-[var(--border-primary)]">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-blue-subtle)] border border-[var(--accent-blue)]/20 text-sm font-bold text-[var(--accent-blue)]">
                    {initials}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{user?.name || 'Officer'}</div>
                    <div className="text-[11px] font-mono text-[var(--text-muted)]">{user?.badgeId} · {user?.role}</div>
                  </div>
                </div>
              </div>

              {/* Menu actions */}
              <div className="p-1.5">
                <button
                  onClick={() => { setProfileOpen(false); setPwOpen(true); }}
                  className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  <KeyRound className="w-4 h-4 shrink-0 text-[var(--text-muted)]" />
                  Change Password
                </button>
                <button
                  onClick={() => useAuthStore.getState().logout()}
                  className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-[var(--tone-error-text)] hover:bg-[var(--tone-error-bg)] transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  Sign Out
                </button>
              </div>
            </div>
          )}

          <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
        </div>

        {/* Clock */}
        <div className="hidden 2xl:flex flex-col items-end">
          <span className="text-xs font-mono font-semibold text-[var(--text-primary)]">{systime}</span>
          <span className="text-[9px] font-mono text-[var(--text-muted)]">IST</span>
        </div>

        {/* Session Timer */}
        <SessionTimer />
      </div>
    </header>
  );
};

export default Header;
