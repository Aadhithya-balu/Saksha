import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from './store/authStore';
import { useAuditStore } from './store/auditStore';
import { useAppStore } from './store/appStore';
import Login from './pages/Login';
import Landing from './pages/Landing';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import MobileBottomBar from './components/layout/MobileBottomBar';
import CommandPalette from './components/ui/CommandPalette';
import Overview from './pages/Overview';
import CommandCenter from './pages/CommandCenter';
import Hotspots from './pages/Hotspots';
import Network from './pages/Network/index';
import Predictions from './pages/Predictions';
import Anomalies from './pages/Anomalies';
import Offenders from './pages/Offenders';
import Reports from './pages/Reports';
import AIChat from './pages/AIChat';
import CrimeCases from './pages/CrimeCases';
import RoleGuard from './components/layout/RoleGuard';
import FIRPage from './pages/FIR';
import Criminals from './pages/Criminals';
import Victims from './pages/Victims';
import OfficersPage from './pages/Officers';
import EvidencePage from './pages/Evidence';
import InvestigationPage from './pages/Investigation';
import InvestigationIntelligence from './pages/InvestigationIntelligence';
import IntelligenceFusion from './pages/IntelligenceFusion';
import NotificationsPage from './pages/Notifications';
import SociologicalPage from './pages/Sociological';
import StrategicPage from './pages/Strategic';
import GlobalAIAssistant from './components/ai/GlobalAIAssistant';
import DocsPage from './pages/Docs';
import SettingsHelp from './pages/SettingsHelp';
import Admin from './pages/Admin';
import IdentityResolution from './pages/IdentityResolution';
import FaceRecognition from './pages/FaceRecognition';
import NotFound from './pages/NotFound';

const routeEntries = [
  ['dashboard', '/dashboard'],
  ['command_center', '/command-center'],
  ['investigation_intelligence', '/intelligence-engine'],
  ['intelligence_fusion', '/intelligence-fusion'],
  ['identity', '/identity-resolution'],
  ['fir', '/firs'],
  ['hotspot', '/hotspots'],
  ['network', '/network'],
  ['predictive', '/predictions'],
  ['anomaly', '/anomalies'],
  ['crime_cases', '/crime-cases'],
  ['investigation', '/investigation'],
  ['notifications', '/notifications'],
  ['sociological', '/sociological'],
  ['strategic', '/strategic'],
  ['offenders', '/offenders'],
  ['criminals', '/criminals'],
  ['victims', '/victims'],
  ['reports', '/reports'],
  ['settings_help', '/settings'],
  ['admin', '/admin'],
  ['ai_chat', '/ai-chat'],
  ['face_recognition', '/face-recognition'],
  ['officers', '/officers'],
  ['evidence', '/evidence'],
  ['docs', '/docs'],
] as const;

const tabForPath = (pathname: string): string | null => {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  if (normalizedPath === '/' || normalizedPath === '/index.html') return 'dashboard';
  if (normalizedPath === '/login') return 'login';
  if (/^\/cases(?:\/|$)/.test(normalizedPath)) return 'crime_cases';
  return routeEntries.find(([, path]) => path === normalizedPath)?.[0] || null;
};

const pathForTab = (tab: string): string | null =>
  tab === 'login' ? '/login' : routeEntries.find(([entryTab]) => entryTab === tab)?.[1] || null;

function App() {
  const { isAuthenticated, user, isHydrating, initializeSession } = useAuthStore();
  const { addLog } = useAuditStore();
  const { activeTab, setActiveTab, sidebarCollapsed, setSidebarCollapsed, setMobileMenuOpen, theme } = useAppStore();
  const basePath = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '') || '/';
  const normalizedPath = window.location.pathname.replace(/\/+$/, '') || '/';
  const appPath = basePath === '/' ? normalizedPath : normalizedPath.slice(basePath.length) || '/';
  const [currentPath, setCurrentPath] = useState(appPath);
  const routeTab = currentPath === '/' || currentPath === '/index.html' ? null : tabForPath(currentPath);
  const isKnownPath = currentPath === '/' || currentPath === '/index.html' || routeTab !== null;
  const isFirstRoutingEffect = useRef(true);

  useEffect(() => {
    const handlePopState = () => {
      const nextPath = basePath === '/'
        ? window.location.pathname
        : window.location.pathname.slice(basePath.length) || '/';
      const nextTab = tabForPath(nextPath);
      setCurrentPath(nextPath);
      if (nextTab) setActiveTab(nextTab);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [basePath, setActiveTab]);

  useEffect(() => {
    if (!isKnownPath) return;
    if (isFirstRoutingEffect.current) {
      isFirstRoutingEffect.current = false;
      if (routeTab) setActiveTab(routeTab);
      if (routeTab || activeTab === 'dashboard') return;
    }
    if (routeTab === activeTab) return;
    const nextPath = pathForTab(activeTab);
    if (!nextPath || nextPath === currentPath || (currentPath === '/' && activeTab === 'dashboard')) return;
    window.history.pushState({}, '', `${basePath === '/' ? '' : basePath}${nextPath}`);
    setCurrentPath(nextPath);
  }, [activeTab, basePath, currentPath, isKnownPath]);

  useEffect(() => {
    void initializeSession();
  }, [initializeSession]);

  // Initialize theme from store on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Listen for navigation requests (cross-tab links)
  useEffect(() => {
    const handleNavigate = (e: Event) => {
      const customEvent = e as CustomEvent<{ tab: string; targetId?: string }>;
      if (customEvent.detail?.tab) {
        const nextTab = customEvent.detail.tab;
        setActiveTab(nextTab);
        // Sync currentPath so isKnownPath updates immediately (fixes 404 -> valid page navigation)
        const nextPath = pathForTab(nextTab);
        if (nextPath) {
          setCurrentPath(nextPath);
          window.history.pushState({}, '', `${basePath === '/' ? '' : basePath}${nextPath}`);
        }
        if (customEvent.detail.targetId) {
          sessionStorage.setItem('selected_entity_id', customEvent.detail.targetId);
        }
      }
    };
    window.addEventListener('navigate-tab', handleNavigate);
    return () => window.removeEventListener('navigate-tab', handleNavigate);
  }, [setActiveTab, basePath]);

  // Force /login URL on logout from anywhere in the app
  useEffect(() => {
    const handleLoginNav = () => {
      window.history.replaceState({}, '', `${basePath === '/' ? '' : basePath}/login`);
      setCurrentPath('/login');
    };
    window.addEventListener('auth:navigate-login', handleLoginNav);
    return () => window.removeEventListener('auth:navigate-login', handleLoginNav);
  }, [basePath]);

  // Log page views
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    const tabLabels: Record<string, string> = {
      dashboard: 'Analytics Dashboard',
      command_center: 'Command Center',
      investigation_intelligence: 'Intelligence Engine',
      intelligence_fusion: 'Intelligence Fusion Portal',
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
      admin: 'Admin Panel',
      ai_chat: 'AI Assistant',
      face_recognition: 'Face Recognition',
      officers: 'Officer Management',
      evidence: 'Evidence Handling',
      docs: 'Documentation',
    };
    addLog(user.name, user.badgeId, 'PAGE_VIEW', `Accessed ${tabLabels[activeTab] || activeTab}`);
  }, [activeTab, isAuthenticated, user, addLog]);

  // Global loading screen (shown while the session is hydrating on app load)
  if (isHydrating) {
    return (
      <div
        className="fixed inset-0 z-[1000] flex items-center justify-center"
        style={{ background: 'var(--bg-primary)' }}
      >
        <div className="text-center space-y-6 px-6">
          <div className="flex items-center justify-center gap-3 select-none">
            <div className="w-11 h-11 rounded-xl bg-[var(--accent-blue-subtle)] border border-[var(--accent-blue)]/25 flex items-center justify-center">
              <svg className="w-6 h-6 text-[var(--accent-blue)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7l7-4z" />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-lg font-bold tracking-wide text-[var(--text-primary)] leading-none">SAKSHA</p>
              <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-[var(--text-muted)] mt-1">
                Crime Intelligence Platform
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <svg className="w-5 h-5 text-[var(--accent-blue)] animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-[var(--text-muted)]">Establishing secure session...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isKnownPath) {
    return <NotFound />;
  }

  if (!isAuthenticated) {
    // Public pages that don't require authentication
    const publicPath = currentPath === '/' || currentPath === '/index.html';
    const publicDocs = currentPath === '/docs';
    if (publicPath) {
      return <Landing />;
    }
    if (publicDocs) {
      return <DocsPage />;
    }
    // Redirect to /login and render the login page cleanly
    if (currentPath !== '/login') {
      window.history.replaceState({}, '', `${basePath === '/' ? '' : basePath}/login`);
    }
    return <Login onSuccess={() => {
      window.history.replaceState({}, '', `${basePath === '/' ? '' : basePath}/dashboard`);
      setCurrentPath('/dashboard');
      setActiveTab('dashboard');
    }} />;
  }

  // Redirect away from /login if already authenticated
  if (currentPath === '/login') {
    window.history.replaceState({}, '', `${basePath === '/' ? '' : basePath}/dashboard`);
    setCurrentPath('/dashboard');
  }

  const renderActivePage = () => {
    switch (routeTab || activeTab) {
      case 'dashboard': return <RoleGuard path="/dashboard"><Overview /></RoleGuard>;
      case 'command_center': return <RoleGuard path="/command-center"><CommandCenter /></RoleGuard>;
      case 'investigation_intelligence': return <RoleGuard path="/intelligence-engine"><InvestigationIntelligence /></RoleGuard>;
      case 'intelligence_fusion': return <RoleGuard path="/intelligence-fusion"><IntelligenceFusion /></RoleGuard>;
      case 'identity': return <RoleGuard path="/identity-resolution"><IdentityResolution /></RoleGuard>;
      case 'fir': return <RoleGuard path="/firs"><FIRPage /></RoleGuard>;
      case 'hotspot': return <RoleGuard path="/hotspots"><Hotspots /></RoleGuard>;
      case 'network': return <RoleGuard path="/network"><Network /></RoleGuard>;
      case 'predictive': return <RoleGuard path="/predictions"><Predictions /></RoleGuard>;
      case 'anomaly': return <RoleGuard path="/anomalies"><Anomalies /></RoleGuard>;
      case 'offenders': return <RoleGuard path="/offenders"><Offenders /></RoleGuard>;
      case 'criminals': return <RoleGuard path="/criminals"><Criminals /></RoleGuard>;
      case 'victims': return <RoleGuard path="/victims"><Victims /></RoleGuard>;
      case 'reports': return <RoleGuard path="/reports"><Reports /></RoleGuard>;
      case 'settings_help': return <RoleGuard path="/settings"><SettingsHelp /></RoleGuard>;
      case 'admin': return <RoleGuard path="/admin"><Admin /></RoleGuard>;
      case 'crime_cases': return <RoleGuard path="/crime-cases"><CrimeCases /></RoleGuard>;
      case 'investigation': return <RoleGuard path="/investigation"><InvestigationPage /></RoleGuard>;
      case 'ai_chat': return <RoleGuard path="/ai-chat"><AIChat /></RoleGuard>;
      case 'face_recognition': return <RoleGuard path="/face-recognition"><FaceRecognition /></RoleGuard>;
      case 'officers': return <RoleGuard path="/officers"><OfficersPage /></RoleGuard>;
      case 'evidence': return <RoleGuard path="/evidence"><EvidencePage /></RoleGuard>;
      case 'notifications': return <RoleGuard path="/notifications"><NotificationsPage /></RoleGuard>;
      case 'sociological': return <RoleGuard path="/sociological"><SociologicalPage /></RoleGuard>;
      case 'strategic': return <RoleGuard path="/strategic"><StrategicPage /></RoleGuard>;
      case 'docs': return <DocsPage />;
      default: return <Overview />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="w-full max-w-[1600px] 2xl:max-w-[1920px] mx-auto p-3 sm:p-4 md:p-6 lg:p-8 pb-20 md:pb-8 sk-page-enter">
            {renderActivePage()}
          </div>
        </main>

        {/* Footer */}
        <footer className="h-9 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)]/50 pl-6 pr-6 pb-[env(safe-area-inset-bottom)] mb-[64px] md:mb-0 flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] select-none shrink-0 no-print">
          <span>SAKSHA v2.0 &middot; Crime Intelligence Platform</span>
          <span className="hidden sm:inline">CLASSIFIED &middot; STAMP: 2026-SCI</span>
        </footer>
      </div>

      {/* Global Command Palette */}
      <CommandPalette />

      {/* Global AI Assistant */}
      <GlobalAIAssistant />

      {/* Mobile bottom navigation bar */}
      <MobileBottomBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenDrawer={() => {
          setSidebarCollapsed(false);
          setMobileMenuOpen(true);
        }}
      />
    </div>
  );
}

export default App;
