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

const ROLE_ACCENT: Record<string, string> = {
  ADMIN: 'coral',
  SP: 'amber',
  INSPECTOR: 'cyan',
  SCRB: 'blue',
  IO: 'teal',
  FORENSIC: 'purple',
  VIEWER: 'muted',
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
      className="sk-header"
      style={{ zIndex: 100 }}
    >
      {/* Left: Mobile menu + breadcrumb context */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 overflow-hidden">
        {setSidebarCollapsed && (
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="md:hidden shrink-0 p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
            aria-label="Toggle navigation drawer"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="sk-crumb">
          <span className="sk-crumb-root hidden sm:inline">Saksha</span>
          <ChevronRight className="sk-crumb-sep hidden sm:block w-3.5 h-3.5" />
          <span className="sk-crumb-current">{currentPage}</span>
        </div>
      </div>

      {/* Center: Quick find (opens Command Palette) */}
      <button
        onClick={() => setCommandPaletteOpen(true)}
        className="sk-header-search hidden md:flex shrink-0"
      >
        <Search className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1 text-left truncate">Search cases, people, places…</span>
        <kbd className="sk-cmd-kbd hidden xl:inline-flex shrink-0"><Command className="w-2.5 h-2.5" />K</kbd>
      </button>

      {/* Right: Role chip + status + actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 justify-end">
        <div className="hidden 2xl:flex items-center">
          <DataModeBadge />
        </div>

        {user && (
          <span
            className="sk-header-chip hidden xl:inline-flex"
            data-accent={ROLE_ACCENT[user.role] || undefined}
            title={`Clearance: ${user.role}`}
          >
            <span className="sk-chip-dot" />
            {user.role}
          </span>
        )}

        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 text-[10.5px] font-mono rounded-full border border-[var(--border-primary)] bg-[var(--bg-primary)]">
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
          className="relative shrink-0 flex items-center justify-center h-8 w-8 rounded-full border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-blue)]/40 transition-all cursor-pointer"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label="Toggle light/dark mode"
        >
          {theme === 'dark' ? (
            <Sun className="w-[16px] h-[16px] text-[var(--accent-amber)]" />
          ) : (
            <Moon className="w-[16px] h-[16px] text-[var(--accent-purple)]" />
          )}
        </button>

        {/* Notifications */}
        <NotificationBell />

        {/* Profile menu */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((o) => !o)}
            aria-haspopup="true"
            aria-expanded={profileOpen}
            className="flex items-center gap-2 rounded-full border border-[var(--border-primary)] bg-[var(--bg-primary)] pl-1 pr-2 py-1 transition-all duration-150 hover:border-[var(--accent-blue)]/40 cursor-pointer"
            title="Account"
          >
            <span className="sk-avatar">{initials}</span>
            <span className="hidden lg:flex flex-col items-start leading-none">
              <span className="text-xs font-semibold text-[var(--text-primary)]">{user?.name?.split(' ')[0] || 'Officer'}</span>
              <span className="text-[9px] font-mono uppercase tracking-wider text-[var(--text-muted)]">{user?.role || ''}</span>
            </span>
            <ChevronDown className={`hidden sm:block w-3.5 h-3.5 text-[var(--text-muted)] transition-transform duration-150 ${profileOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Profile dropdown */}
          {profileOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] w-64 z-[220] overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] shadow-[var(--shadow-xl)] sk-page-enter">
              <div className="px-4 py-3 bg-[var(--bg-tertiary)]/60 border-b border-[var(--border-primary)]">
                <div className="flex items-center gap-3">
                  <span className="sk-avatar">{initials}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{user?.name || 'Officer'}</div>
                    <div className="text-[11px] font-mono text-[var(--text-muted)]">{user?.badgeId} · {user?.role}</div>
                  </div>
                </div>
              </div>

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
          <span className="text-[11px] font-mono font-semibold text-[var(--text-primary)]">{systime}</span>
          <span className="text-[8px] font-mono text-[var(--text-muted)]">IST</span>
        </div>

        {/* Session Timer */}
        <SessionTimer />
      </div>
    </header>
  );
};

export default Header;