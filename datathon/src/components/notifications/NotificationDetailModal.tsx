import React from 'react';
import {
  X, User, Building, Clock, AlertTriangle, AlertCircle, Info, Tag,
  FileText, CheckCircle, Archive, Radio, Trash2,
} from 'lucide-react';
import { useNotificationStore } from '../../store/notificationStore';
import { useRBAC } from '../../hooks/useRBAC';
import type { NotificationRecord } from '../../services/api';

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
  system_notification: 'System Notification',
  administrative: 'Administrative',
};

interface NotificationDetailModalProps {
  notification: NotificationRecord | null;
  open: boolean;
  onClose: () => void;
}

export const NotificationDetailModal: React.FC<NotificationDetailModalProps> = ({
  notification, open, onClose,
}) => {
  const { markRead, acknowledge, dismiss, removeNotification } = useNotificationStore();
  const { isNotificationWriter } = useRBAC();

  if (!open || !notification) return null;
  const n = notification;
  const color = PRIORITY_COLORS[n.priority] || PRIORITY_COLORS.medium;

  const getPriorityIcon = () => {
    switch (n.priority) {
      case 'critical': return <AlertTriangle className="w-5 h-5" style={{ color }} />;
      case 'high': return <AlertCircle className="w-5 h-5" style={{ color }} />;
      default: return <Info className="w-5 h-5" style={{ color }} />;
    }
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 bg-[var(--bg-elevated)] border border-[var(--border-primary)] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border-secondary)]" style={{ borderLeftWidth: 4, borderLeftColor: color }}>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              {getPriorityIcon()}
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)] mb-0.5">{n.subject}</h2>
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded text-[7px] font-mono font-bold uppercase border" style={{ color, backgroundColor: `${color}10`, borderColor: `${color}20` }}>
                    {n.priority}
                  </span>
                  <span className="text-[8px] font-mono text-[var(--text-muted)]">
                    {CATEGORY_LABELS[n.category] || n.category}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-muted)] cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[50vh] overflow-y-auto">
          {/* Sender / Recipient */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-[var(--bg-secondary)] rounded-lg">
              <div className="flex items-center gap-1.5 text-[8px] font-mono font-bold text-[var(--text-muted)] uppercase mb-1">
                <User className="w-2.5 h-2.5" />
                From
              </div>
              <p className="text-[11px] font-bold text-[var(--text-primary)]">{n.sender_name || 'System'}</p>
              {n.sender_badge && <p className="text-[9px] font-mono text-[var(--text-secondary)]">{n.sender_badge}</p>}
            </div>
            <div className="p-3 bg-[var(--bg-secondary)] rounded-lg">
              <div className="flex items-center gap-1.5 text-[8px] font-mono font-bold text-[var(--text-muted)] uppercase mb-1">
                {n.is_broadcast ? <Radio className="w-2.5 h-2.5" /> : <Building className="w-2.5 h-2.5" />}
                To
              </div>
              <p className="text-[11px] font-bold text-[var(--text-primary)]">
                {n.is_broadcast ? 'All Stations' : (n.recipient_name || 'System')}
              </p>
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="text-[8px] font-mono font-bold text-[var(--text-muted)] uppercase tracking-wider">Message</label>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">{n.message}</p>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3">
            {n.related_case_number && (
              <div className="flex items-center gap-1.5 text-[9px] font-mono">
                <FileText className="w-3 h-3 text-[var(--accent-blue)]" />
                <span className="text-[var(--text-muted)]">Case:</span>
                <span className="text-[var(--accent-blue)] font-bold">{n.related_case_number}</span>
              </div>
            )}
            {n.related_fir_number && (
              <div className="flex items-center gap-1.5 text-[9px] font-mono">
                <FileText className="w-3 h-3 text-[#8B5CF6]" />
                <span className="text-[var(--text-muted)]">FIR:</span>
                <span className="text-[#8B5CF6] font-bold">{n.related_fir_number}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-[9px] font-mono">
              <Clock className="w-3 h-3 text-[var(--text-muted)]" />
              <span className="text-[var(--text-muted)]">Sent:</span>
              <span className="text-[var(--text-secondary)]">{new Date(n.created_at).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] font-mono">
              <Tag className="w-3 h-3 text-[var(--text-muted)]" />
              <span className="text-[var(--text-muted)]">Status:</span>
              <span className="text-[var(--text-secondary)] font-bold">{STATUS_LABELS[n.status] || n.status}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-2 px-6 py-4 border-t border-[var(--border-secondary)] bg-[var(--bg-secondary)]/30">
          {!n.is_read && (
            <button
              onClick={() => markRead(n.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] rounded-lg text-[9px] font-mono font-bold hover:bg-[var(--accent-blue)]/20 transition-colors cursor-pointer"
            >
              <CheckCircle className="w-3 h-3" />
              Mark Read
            </button>
          )}
          {n.status !== 'acknowledged' && (
            <button
              onClick={() => acknowledge(n.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#D4820A]/10 text-[#D4820A] rounded-lg text-[9px] font-mono font-bold hover:bg-[#D4820A]/20 transition-colors cursor-pointer"
            >
              <CheckCircle className="w-3 h-3" />
              Acknowledge
            </button>
          )}
          <button
            onClick={() => { dismiss(n.id); onClose(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#C94A2A]/10 text-[#C94A2A] rounded-lg text-[9px] font-mono font-bold hover:bg-[#C94A2A]/20 transition-colors cursor-pointer"
          >
            <Archive className="w-3 h-3" />
            Archive
          </button>
          {isNotificationWriter && (
            <button
              onClick={() => {
                if (window.confirm('Permanently delete this notification?')) {
                  removeNotification(n.id);
                  onClose();
                }
              }}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-tertiary)]/50 text-[#C94A2A] rounded-lg text-[9px] font-mono font-bold border border-[#C94A2A]/20 hover:bg-[#C94A2A]/15 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationDetailModal;
