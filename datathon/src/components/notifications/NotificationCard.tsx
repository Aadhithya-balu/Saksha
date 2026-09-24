import React from 'react';
import {
  AlertTriangle, AlertCircle, Info, Clock, CheckCircle, Archive, User, Building, FileText,
  Radio, Eye, Trash2,
} from 'lucide-react';
import { useNotificationStore } from '../../store/notificationStore';
import { useRBAC } from '../../hooks/useRBAC';
import type { NotificationRecord } from '../../services/api';

interface NotificationCardProps {
  notification: NotificationRecord;
  onSelect?: (n: NotificationRecord) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#C94A2A',
  high: '#D4820A',
  medium: '#1E6FD9',
  low: '#6A7A96',
};

const STATUS_LABELS: Record<string, string> = {
  unread: 'Unread',
  read: 'Read',
  acknowledged: 'Acknowledged',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

const CATEGORY_LABELS: Record<string, string> = {
  investigation_update: 'Investigation Update',
  evidence_request: 'Evidence Request',
  evidence_received: 'Evidence Received',
  crime_alert: 'Crime Alert',
  wanted_criminal: 'Wanted Criminal',
  officer_assistance: 'Officer Assistance',
  resource_request: 'Resource Request',
  case_escalation: 'Case Escalation',
  intelligence_sharing: 'Intelligence Sharing',
  suspicious_activity: 'Suspicious Activity',
  emergency_broadcast: 'Emergency Broadcast',
  system_notification: 'System',
  administrative: 'Administrative',
};

export const NotificationCard: React.FC<NotificationCardProps> = ({ notification, onSelect }) => {
  const { markRead, acknowledge, dismiss, removeNotification } = useNotificationStore();
  const { isNotificationWriter } = useRBAC();
  const n = notification;
  const priorityColor = PRIORITY_COLORS[n.priority] || PRIORITY_COLORS.medium;

  const getPriorityIcon = () => {
    switch (n.priority) {
      case 'critical': return <AlertTriangle className="w-3.5 h-3.5" style={{ color: priorityColor }} />;
      case 'high': return <AlertCircle className="w-3.5 h-3.5" style={{ color: priorityColor }} />;
      default: return <Info className="w-3.5 h-3.5" style={{ color: priorityColor }} />;
    }
  };

  const getStatusStyle = () => {
    switch (n.status) {
      case 'unread': return 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border-[var(--accent-blue)]/20';
      case 'acknowledged': return 'bg-[#D4820A]/10 text-[#D4820A] border-[#D4820A]/20';
      case 'resolved': return 'bg-[#0E9E78]/10 text-[#0E9E78] border-[#0E9E78]/20';
      default: return 'bg-[var(--bg-tertiary)]/50 text-[var(--text-muted)] border-[var(--border-primary)]';
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <div
      className={`relative px-5 py-4 transition-all cursor-pointer group ${
        !n.is_read
          ? 'bg-[var(--accent-blue)]/[0.03] border-l-[3px]'
          : 'opacity-80 hover:opacity-100 border-l-[3px] border-l-transparent'
      }`}
      style={{ borderLeftColor: !n.is_read ? priorityColor : 'transparent' }}
      onClick={() => onSelect?.(n)}
    >
      {/* Broadcast badge */}
      {n.is_broadcast && (
        <div className="absolute top-3 right-3">
          <span className="flex items-center gap-1 px-2 py-0.5 bg-[#F472B6]/10 text-[#F472B6] text-[7px] font-mono font-bold rounded-full border border-[#F472B6]/20">
            <Radio className="w-2.5 h-2.5" />
            BROADCAST
          </span>
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Priority Icon */}
        <div className="mt-0.5 shrink-0">{getPriorityIcon()}</div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Top Row: Priority Badge + Status */}
          <div className="flex items-center gap-2 mb-1">
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[7px] font-mono font-bold uppercase border"
              style={{ color: priorityColor, backgroundColor: `${priorityColor}10`, borderColor: `${priorityColor}20` }}
            >
              {n.priority}
            </span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[7px] font-mono font-bold uppercase border ${getStatusStyle()}`}>
              {STATUS_LABELS[n.status] || n.status}
            </span>
            {!n.is_read && (
              <span className="w-2 h-2 rounded-full bg-[var(--accent-blue)] shrink-0 animate-pulse" />
            )}
          </div>

          {/* Subject */}
          <h3 className={`text-[11px] font-bold text-[var(--text-primary)] mb-0.5 ${!n.is_read ? '' : ''}`}>
            {n.subject}
          </h3>

          {/* Sender / Recipient */}
          <div className="flex items-center gap-3 mb-1.5">
            {n.sender_name && (
              <span className="flex items-center gap-1 text-[8.5px] font-mono text-[var(--text-secondary)]">
                <User className="w-2.5 h-2.5 text-[var(--text-muted)]" />
                FROM: <span className="text-[var(--text-primary)] font-bold">{n.sender_badge || n.sender_name}</span>
              </span>
            )}
            <span className="flex items-center gap-1 text-[8.5px] font-mono text-[var(--text-secondary)]">
              <Building className="w-2.5 h-2.5 text-[var(--text-muted)]" />
              TO: <span className="text-[var(--text-primary)] font-bold">{n.is_broadcast ? 'ALL STATIONS' : (n.recipient_name || 'System')}</span>
            </span>
          </div>

          {/* Message Preview */}
          <p className="text-[9px] font-mono text-[var(--text-secondary)] leading-relaxed mb-2 line-clamp-2">
            {n.message}
          </p>

          {/* Bottom Row: Category + Time + Case/FIR */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[7px] font-mono uppercase bg-[var(--bg-tertiary)]/50 text-[var(--text-muted)] border border-[var(--border-secondary)]">
                {CATEGORY_LABELS[n.category] || n.category}
              </span>
              {n.related_case_number && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[7px] font-mono text-[var(--accent-blue)] bg-[var(--accent-blue)]/5 border border-[var(--accent-blue)]/15">
                  <FileText className="w-2.5 h-2.5" />
                  {n.related_case_number}
                </span>
              )}
              {n.related_fir_number && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[7px] font-mono text-[#8B5CF6] bg-[#8B5CF6]/5 border border-[#8B5CF6]/15">
                  {n.related_fir_number}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-[8px] font-mono text-[var(--text-muted)]">
              <Clock className="w-2.5 h-2.5" />
              {timeAgo(n.created_at)}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
        {!n.is_read && (
          <button
            onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
            className="p-1.5 hover:bg-[var(--accent-blue)]/10 rounded-md text-[var(--accent-blue)] cursor-pointer transition-colors"
            title="Mark as read"
          >
            <Eye className="w-3 h-3" />
          </button>
        )}
        {n.status !== 'acknowledged' && !n.is_broadcast && (
          <button
            onClick={(e) => { e.stopPropagation(); acknowledge(n.id); }}
            className="p-1.5 hover:bg-[#D4820A]/10 rounded-md text-[#D4820A] cursor-pointer transition-colors"
            title="Acknowledge"
          >
            <CheckCircle className="w-3 h-3" />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
          className="p-1.5 hover:bg-[#C94A2A]/10 rounded-md text-[var(--text-muted)] hover:text-[#C94A2A] cursor-pointer transition-colors"
          title="Archive"
        >
          <Archive className="w-3 h-3" />
        </button>
        {isNotificationWriter && (
          <button
            onClick={(e) => { e.stopPropagation(); removeNotification(n.id); }}
            className="p-1.5 hover:bg-[#C94A2A]/15 rounded-md text-[var(--text-muted)] hover:text-[#C94A2A] cursor-pointer transition-colors"
            title="Delete permanently"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};

export default NotificationCard;
