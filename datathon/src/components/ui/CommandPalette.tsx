import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/appStore';
import { useRBAC } from '../../hooks/useRBAC';
import {
  Search,
  LayoutDashboard,
  FileText,
  Map,
  Network,
  Brain,
  Briefcase,
  Bell,
  AlertTriangle,
  Users,
  ShieldAlert,
  Heart,
  BarChart3,
  MessageSquare,
  UserCog,
  FolderOpen,
  Settings,
  BookOpen,
  ArrowRight,
  CornerDownLeft,
  Fingerprint,
  Crosshair,
  ScanFace,
} from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  tab: string;
  category: string;
  keywords: string[];
  path: string;
}

const commands: CommandItem[] = [
  { id: 'dashboard', label: 'Overview Dashboard', description: 'View KPIs, trends, and alerts', icon: <LayoutDashboard className="w-4 h-4" />, tab: 'dashboard', category: 'Navigation', keywords: ['overview', 'dashboard', 'home', 'kpi', 'stats'], path: '/dashboard' },
  { id: 'command_center', label: 'Command Center', description: 'Central investigation search and triage', icon: <Crosshair className="w-4 h-4" />, tab: 'command_center', category: 'Navigation', keywords: ['command', 'center', 'search', 'dispatch', 'triage'], path: '/command-center' },
  { id: 'crime_cases', label: 'Crime Cases', description: 'Manage and track crime cases', icon: <Briefcase className="w-4 h-4" />, tab: 'crime_cases', category: 'Navigation', keywords: ['case', 'crime', 'cases', 'manage'], path: '/crime-cases' },
  { id: 'investigation', label: 'Investigation', description: 'Investigation workflow and timeline', icon: <Search className="w-4 h-4" />, tab: 'investigation', category: 'Navigation', keywords: ['investigation', 'probe', 'timeline'], path: '/investigation' },
  { id: 'fir', label: 'FIR Registry', description: 'First Information Reports', icon: <FileText className="w-4 h-4" />, tab: 'fir', category: 'Navigation', keywords: ['fir', 'report', 'information'], path: '/firs' },
  { id: 'hotspot', label: 'Hotspot Map', description: 'Crime hotspot spatial analysis', icon: <Map className="w-4 h-4" />, tab: 'hotspot', category: 'Navigation', keywords: ['hotspot', 'map', 'spatial', 'location'], path: '/hotspots' },
  { id: 'network', label: 'Network Graph', description: 'Criminal network visualization', icon: <Network className="w-4 h-4" />, tab: 'network', category: 'Navigation', keywords: ['network', 'graph', 'connections', 'links'], path: '/network' },
  { id: 'identity', label: 'Identity Resolution', description: 'Fake/duplicate record detection and review', icon: <Fingerprint className="w-4 h-4" />, tab: 'identity', category: 'Navigation', keywords: ['identity', 'duplicate', 'fake', 'integrity', 'data', 'security'], path: '/identity-resolution' },
  { id: 'predictive', label: 'Predictive AI', description: 'AI-powered crime predictions', icon: <Brain className="w-4 h-4" />, tab: 'predictive', category: 'Navigation', keywords: ['predict', 'ai', 'forecast', 'risk'], path: '/predictions' },
  { id: 'sociological', label: 'Sociological Intelligence', description: 'Demographic and socio-economic crime analysis', icon: <BarChart3 className="w-4 h-4" />, tab: 'sociological', category: 'Navigation', keywords: ['sociological', 'demographic', 'population', 'urban', 'rural', 'socio', 'economic'], path: '/sociological' },
  { id: 'strategic', label: 'Strategic Intelligence', description: 'Command-level intelligence briefing', icon: <ShieldAlert className="w-4 h-4" />, tab: 'strategic', category: 'Navigation', keywords: ['strategic', 'command', 'briefing', 'deployment', 'risk', 'intelligence'], path: '/strategic' },
  { id: 'anomaly', label: 'Anomaly Feed', description: 'Real-time anomaly detection alerts', icon: <AlertTriangle className="w-4 h-4" />, tab: 'anomaly', category: 'Navigation', keywords: ['anomaly', 'alert', 'unusual', 'detect'], path: '/anomalies' },
  { id: 'offenders', label: 'Offender Registry', description: 'Criminal offender profiles', icon: <ShieldAlert className="w-4 h-4" />, tab: 'offenders', category: 'Registry', keywords: ['offender', 'criminal', 'profile', 'registry'], path: '/offenders' },
  { id: 'criminals', label: 'Criminal Dossiers', description: 'Detailed criminal records', icon: <Users className="w-4 h-4" />, tab: 'criminals', category: 'Registry', keywords: ['criminal', 'dossier', 'record'], path: '/criminals' },
  { id: 'victims', label: 'Victims Registry', description: 'Victim and witness profiles', icon: <Heart className="w-4 h-4" />, tab: 'victims', category: 'Registry', keywords: ['victim', 'witness', 'registry'], path: '/victims' },
  { id: 'officers', label: 'Officer Management', description: 'Police officer directory', icon: <UserCog className="w-4 h-4" />, tab: 'officers', category: 'Registry', keywords: ['officer', 'police', 'directory', 'management'], path: '/officers' },
  { id: 'evidence', label: 'Evidence Handling', description: 'Evidence chain of custody', icon: <FolderOpen className="w-4 h-4" />, tab: 'evidence', category: 'Registry', keywords: ['evidence', 'custody', 'forensic', 'proof'], path: '/evidence' },
  { id: 'notifications', label: 'Intelligence Center', description: 'Notifications and activity feed', icon: <Bell className="w-4 h-4" />, tab: 'notifications', category: 'System', keywords: ['notification', 'alert', 'intelligence', 'feed'], path: '/notifications' },
  { id: 'reports', label: 'Reports Center', description: 'Generate and export reports', icon: <BarChart3 className="w-4 h-4" />, tab: 'reports', category: 'Tools', keywords: ['report', 'export', 'download', 'pdf', 'csv'], path: '/reports' },
  { id: 'ai_chat', label: 'AI Assistant', description: 'Conversational AI for crime analysis', icon: <MessageSquare className="w-4 h-4" />, tab: 'ai_chat', category: 'Tools', keywords: ['ai', 'chat', 'assistant', 'ask', 'copilot'], path: '/ai-chat' },
  { id: 'face_recognition', label: 'Face Identification', description: 'Search gallery by facial image', icon: <ScanFace className="w-4 h-4" />, tab: 'face_recognition', category: 'Tools', keywords: ['face', 'image', 'photo', 'gallery', 'identification'], path: '/face-recognition' },
  { id: 'docs', label: 'Documentation', description: 'Platform guides and documentation', icon: <BookOpen className="w-4 h-4" />, tab: 'docs', category: 'Tools', keywords: ['docs', 'documentation', 'help', 'guide', 'manual'], path: '/docs' },
  { id: 'settings', label: 'Settings', description: 'System settings and operator preferences', icon: <Settings className="w-4 h-4" />, tab: 'settings_help', category: 'System', keywords: ['settings', 'config', 'preferences'], path: '/settings' },
];

interface QuickAction extends Omit<CommandItem, 'keywords'> {
  keywords: string[];
}

const quickActions: QuickAction[] = [
  { id: 'qa_search', label: 'Run Investigation Search', description: 'Open Command Center search', icon: <Crosshair className="w-4 h-4" />, tab: 'command_center', category: 'Quick Actions', keywords: ['search', 'investigate', 'command', 'run'], path: '/command-center' },
  { id: 'qa_fir', label: 'File / Review FIR', description: 'FIR lifecycle management', icon: <FileText className="w-4 h-4" />, tab: 'fir', category: 'Quick Actions', keywords: ['fir', 'file', 'report', 'register'], path: '/firs' },
  { id: 'qa_identity', label: 'Identity Review Queue', description: 'Pending identity resolutions', icon: <Fingerprint className="w-4 h-4" />, tab: 'identity', category: 'Quick Actions', keywords: ['identity', 'review', 'queue', 'resolve'], path: '/identity-resolution' },
  { id: 'qa_face', label: 'Face Identification', description: 'Match gallery photo', icon: <ScanFace className="w-4 h-4" />, tab: 'face_recognition', category: 'Quick Actions', keywords: ['face', 'match', 'photo', 'identify'], path: '/face-recognition' },
  { id: 'qa_brief', label: 'Strategic Briefing', description: 'Command-level risk picture', icon: <ShieldAlert className="w-4 h-4" />, tab: 'strategic', category: 'Quick Actions', keywords: ['briefing', 'strategic', 'command', 'risk'], path: '/strategic' },
];

const CATEGORIES = ['Quick Actions', 'Navigation', 'Registry', 'Tools', 'System'];

export const CommandPalette: React.FC = () => {
  const { commandPaletteOpen, setCommandPaletteOpen, setActiveTab } = useAppStore();
  const { checkPermission } = useRBAC();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const accessible = useMemo(() => {
    const nav = commands.filter((cmd) => checkPermission(cmd.path));
    const quick = quickActions.filter((qa) => checkPermission(qa.path));
    return [...quick, ...nav];
  }, [checkPermission]);

  const filtered = useMemo(() => {
    if (!query.trim()) return accessible;
    const q = query.toLowerCase();
    return accessible.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        (cmd.description ?? '').toLowerCase().includes(q) ||
        cmd.keywords.some((kw) => kw.includes(q))
    );
  }, [query, accessible]);

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commandPaletteOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, accessible]);

  const execute = (cmd: CommandItem | QuickAction) => {
    setActiveTab(cmd.tab);
    setCommandPaletteOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      execute(filtered[selectedIndex]);
    } else if (e.key === 'Escape') {
      setCommandPaletteOpen(false);
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[selectedIndex] as HTMLElement;
    if (item) {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  return (
    <AnimatePresence>
      {commandPaletteOpen && (
        <div className="fixed inset-0 flex items-start justify-center pt-[13vh] px-4" style={{ zIndex: 500 }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setCommandPaletteOpen(false)}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -10 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            className="sk-cmd-sheet relative"
          >
            <div className="sk-cmd-input-row">
              <Search className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search modules, cases, people…"
                className="sk-cmd-input"
              />
              <kbd className="sk-cmd-kbd shrink-0">ESC</kbd>
            </div>

            <div ref={listRef} className="max-h-[340px] overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <div className="py-10 text-center text-sm text-[var(--text-muted)]">
                  No results found for “{query}”
                </div>
              ) : (
                <>
                  {CATEGORIES.map((category) => {
                    const items = filtered.filter((c) => c.category === category);
                    if (items.length === 0) return null;
                    return (
                      <div key={category}>
                        <div className="sk-cmd-cat">{category}</div>
                        {items.map((cmd) => {
                          const globalIndex = filtered.indexOf(cmd);
                          const isActive = globalIndex === selectedIndex;
                          return (
                            <button
                              key={cmd.id}
                              onClick={() => execute(cmd)}
                              onMouseEnter={() => setSelectedIndex(globalIndex)}
                              data-active={isActive}
                              className="sk-cmd-item"
                            >
                              <span className="sk-cmd-icon">{cmd.icon}</span>
                              <span className="sk-cmd-main">
                                <span className="sk-cmd-label block truncate">{cmd.label}</span>
                                {cmd.description && (
                                  <span className="sk-cmd-desc block">{cmd.description}</span>
                                )}
                              </span>
                              <ArrowRight className={`w-3.5 h-3.5 shrink-0 transition-opacity ${isActive ? 'opacity-100 text-[var(--accent-blue-light)]' : 'opacity-0'}`} />
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            <div className="sk-cmd-footer">
              <span className="flex items-center gap-1.5"><kbd className="sk-cmd-kbd">↑↓</kbd> Navigate</span>
              <span className="flex items-center gap-1.5"><kbd className="sk-cmd-kbd"><CornerDownLeft className="w-2.5 h-2.5" /></kbd> Select</span>
              <span className="flex items-center gap-1.5"><kbd className="sk-cmd-kbd">esc</kbd> Close</span>
              <span className="ml-auto flex items-center gap-1.5" data-limit>
                <ShieldAlert className="w-3 h-3" /> Role-scoped
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CommandPalette;