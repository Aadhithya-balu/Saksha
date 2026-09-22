import React, { useEffect, useState } from 'react';
import { X, Send, Radio, User, AlertTriangle, Tag, MessageSquare, FileText, Paperclip } from 'lucide-react';
import { useNotificationStore } from '../../store/notificationStore';
import { listOfficers } from '../../services/api';

interface RecipientOption {
  id: string;
  label: string;
}

const CATEGORIES = [
  { value: 'investigation_update', label: 'Investigation Update' },
  { value: 'evidence_request', label: 'Evidence Request' },
  { value: 'evidence_received', label: 'Evidence Received' },
  { value: 'crime_alert', label: 'Crime Alert' },
  { value: 'wanted_criminal', label: 'Wanted Criminal' },
  { value: 'officer_assistance', label: 'Officer Assistance' },
  { value: 'resource_request', label: 'Resource Request' },
  { value: 'case_escalation', label: 'Case Escalation' },
  { value: 'intelligence_sharing', label: 'Intelligence Sharing' },
  { value: 'suspicious_activity', label: 'Suspicious Activity' },
  { value: 'emergency_broadcast', label: 'Emergency Broadcast' },
  { value: 'administrative', label: 'Administrative' },
];

const PRIORITIES = [
  { value: 'critical', label: 'Critical', color: '#C94A2A' },
  { value: 'high', label: 'High', color: '#D4820A' },
  { value: 'medium', label: 'Medium', color: '#1E6FD9' },
  { value: 'low', label: 'Low', color: '#6A7A96' },
];

interface InformStationModalProps {
  open: boolean;
  onClose: () => void;
}

export const InformStationModal: React.FC<InformStationModalProps> = ({ open, onClose }) => {
  const { sendNotification } = useNotificationStore();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [recipients, setRecipients] = useState<RecipientOption[]>([]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await listOfficers(1, 100);
        if (!active) return;
        setRecipients(
          res.results.map((o) => ({
            id: o.user_id,
            label: `${o.badge_number} — ${o.rank ?? 'Officer'} · ${o.district}`,
          })),
        );
      } catch {
        if (active) setRecipients([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const [recipient, setRecipient] = useState('');
  const [priority, setPriority] = useState('medium');
  const [category, setCategory] = useState('investigation_update');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [relatedCase, setRelatedCase] = useState('');
  const [relatedFir, setRelatedFir] = useState('');
  const [broadcast, setBroadcast] = useState(false);

  const resetForm = () => {
    setRecipient('');
    setPriority('medium');
    setCategory('investigation_update');
    setSubject('');
    setMessage('');
    setRelatedCase('');
    setRelatedFir('');
    setBroadcast(false);
  };

  const handleSend = async () => {
    if (!subject.trim()) return;
    setSending(true);

    const selectedRecipient = recipients.find(r => r.id === recipient);
    const recipientUser = broadcast ? null : (selectedRecipient || null);

    const success = await sendNotification({
      recipient_id: recipientUser ? recipientUser.id : null,
      subject: subject.trim(),
      notification_type: category,
      category,
      title: subject.trim(),
      message: message.trim() || '',
      priority,
      severity: priority,
      related_case_number: relatedCase || null,
      related_fir_number: relatedFir || null,
      is_broadcast: broadcast,
    });

    setSending(false);
    if (success) {
      setSent(true);
      setTimeout(() => {
        setSent(false);
        resetForm();
        onClose();
      }, 1500);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 bg-[var(--bg-elevated)] border border-[var(--border-primary)] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-secondary)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent-blue)]/10 flex items-center justify-center">
              <Radio className="w-5 h-5 text-[var(--accent-blue)]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Inform Station</h2>
              <p className="text-[10px] text-[var(--text-muted)] font-mono">INTER-STATION COMMUNICATION</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-muted)] transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success State */}
        {sent ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-16 h-16 rounded-full bg-[#0E9E78]/10 flex items-center justify-center mb-4">
              <Send className="w-8 h-8 text-[#0E9E78]" />
            </div>
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1">Message Sent Successfully</h3>
            <p className="text-[10px] text-[var(--text-muted)] font-mono">NOTIFICATION DELIVERED TO RECIPIENT</p>
          </div>
        ) : (
          <>
            {/* Form */}
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Recipient & Broadcast */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  <User className="w-3 h-3" />
                  Recipient
                </label>
                <div className="flex items-center gap-3">
                  <select
                    value={broadcast ? '' : recipient}
                    onChange={(e) => { setRecipient(e.target.value); setBroadcast(false); }}
                    disabled={broadcast}
                    className="flex-1 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-blue)] transition-colors cursor-pointer disabled:opacity-40"
                  >
                    <option value="">Select recipient...</option>
                    {recipients.map(r => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1.5 text-[9px] font-mono text-[var(--text-secondary)] cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={broadcast}
                      onChange={(e) => { setBroadcast(e.target.checked); setRecipient(''); }}
                      className="w-3 h-3 accent-[var(--accent-blue)]"
                    />
                    All Stations
                  </label>
                </div>
              </div>

              {/* Priority & Category */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                    <AlertTriangle className="w-3 h-3" />
                    Priority
                  </label>
                  <div className="flex gap-1.5">
                    {PRIORITIES.map(p => (
                      <button
                        key={p.value}
                        onClick={() => setPriority(p.value)}
                        className={`flex-1 py-1.5 rounded-md text-[8px] font-mono font-bold uppercase transition-all cursor-pointer border ${
                          priority === p.value
                            ? 'border-current shadow-sm'
                            : 'border-transparent opacity-50 hover:opacity-75'
                        }`}
                        style={{ color: priority === p.value ? p.color : 'var(--text-muted)', backgroundColor: priority === p.value ? `${p.color}10` : 'transparent' }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                    <Tag className="w-3 h-3" />
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-blue)] transition-colors cursor-pointer"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  <FileText className="w-3 h-3" />
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter notification subject..."
                  className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-disabled)] outline-none focus:border-[var(--accent-blue)] transition-colors"
                />
              </div>

              {/* Message (Optional) */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  <MessageSquare className="w-3 h-3" />
                  Message <span className="text-[var(--text-muted)] font-normal normal-case">(Optional)</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter operational message..."
                  rows={4}
                  className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-disabled)] outline-none focus:border-[var(--accent-blue)] transition-colors resize-none"
                />
              </div>

              {/* Related Case & FIR */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono font-bold text-[var(--text-secondary)] uppercase tracking-wider">Related Case</label>
                  <input
                    type="text"
                    value={relatedCase}
                    onChange={(e) => setRelatedCase(e.target.value)}
                    placeholder="e.g. CR-2026-BNG-001"
                    className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-disabled)] outline-none focus:border-[var(--accent-blue)] transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-mono font-bold text-[var(--text-secondary)] uppercase tracking-wider">Related FIR</label>
                  <input
                    type="text"
                    value={relatedFir}
                    onChange={(e) => setRelatedFir(e.target.value)}
                    placeholder="e.g. FIR-045/BNG/2026"
                    className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-disabled)] outline-none focus:border-[var(--accent-blue)] transition-colors"
                  />
                </div>
              </div>

              {/* Attachment (placeholder) */}
              <div className="space-y-2">
                <label className="text-[10px] font-mono font-bold text-[var(--text-secondary)] uppercase tracking-wider">Attachment (Optional)</label>
                <div className="flex items-center justify-center w-full h-16 border-2 border-dashed border-[var(--border-primary)] rounded-lg text-[var(--text-muted)] hover:border-[var(--accent-blue)] transition-colors cursor-pointer">
                  <div className="flex items-center gap-2 text-[9px] font-mono">
                    <Paperclip className="w-3 h-3" />
                    <span>Drop file or click to attach</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border-secondary)] bg-[var(--bg-secondary)]/30">
              <button
                onClick={() => { resetForm(); onClose(); }}
                className="px-4 py-2 text-[10px] font-mono font-bold uppercase text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={!subject.trim() || sending}
                className="flex items-center gap-2 px-5 py-2 bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-[10px] font-mono font-bold uppercase transition-all cursor-pointer shadow-sm"
              >
                {sending ? (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                {sending ? 'Sending...' : 'Send Notification'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default InformStationModal;
