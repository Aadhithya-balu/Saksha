import React from 'react';
import { useRBAC } from '../../hooks/useRBAC';
import { useNotificationStore } from '../../store/notificationStore';
import { useAppStore } from '../../store/appStore';
import {
  LayoutDashboard,
  Map,
  FileText,
  MessageSquare,
  Menu,
} from 'lucide-react';

interface MobileBottomBarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenDrawer: () => void;
}

interface TabItem {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
}

const primaryTabs: TabItem[] = [
  { id: 'dashboard', label: 'Home', path: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { id: 'hotspot', label: 'Hotspots', path: '/hotspots', icon: <Map className="w-5 h-5" /> },
  { id: 'fir', label: 'FIR', path: '/firs', icon: <FileText className="w-5 h-5" /> },
  { id: 'ai_chat', label: 'AI', path: '/ai-chat', icon: <MessageSquare className="w-5 h-5" /> },
];

export const MobileBottomBar: React.FC<MobileBottomBarProps> = ({
  activeTab,
  setActiveTab,
  onOpenDrawer,
}) => {
  const { checkPermission } = useRBAC();
  const unread = useNotificationStore((s) => s.counts.unread);
  const setMobileMenuOpen = useAppStore((s) => s.setMobileMenuOpen);

  const handleTab = (id: string) => {
    setActiveTab(id);
  };

  const items = primaryTabs.filter((t) => checkPermission(t.path));

  const tabBtn = (active: boolean) =>
    `md:hidden relative flex-1 flex flex-col items-center justify-center gap-1 px-1 pt-1 cursor-pointer
     transition-colors duration-150 ${active ? 'text-[var(--accent-blue-light)]' : 'text-[var(--text-muted)]'}`;

  return (
    <nav aria-label="Mobile navigation" className="sk-mobile-bar md:hidden select-none">
      {items.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => handleTab(item.id)}
            className={tabBtn(isActive)}
            title={item.label}
          >
            {isActive && (
              <span className="absolute top-0 w-8 h-[2px] rounded-full bg-[var(--accent-blue)]" />
            )}
            <span className="relative">
              {item.icon}
              {item.id === 'ai_chat' && unread > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-[var(--accent-coral)] rounded-full ring-2 ring-[var(--bg-secondary)]" />
              )}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wide">{item.label}</span>
          </button>
        );
      })}

      <button
        onClick={() => {
          setMobileMenuOpen(true);
          onOpenDrawer();
        }}
        className={tabBtn(false)}
        title="More"
      >
        <span className="relative">
          <Menu className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-[var(--accent-coral)] rounded-full ring-2 ring-[var(--bg-secondary)]" />
          )}
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wide">More</span>
      </button>
    </nav>
  );
};

export default MobileBottomBar;