import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useAuditStore } from '../store/auditStore';
import { useRBAC } from '../hooks/useRBAC';
import { updateProfile, changePassword } from '../services/api';
import {
  Settings, Info, Search, Phone, Save, LifeBuoy,
  User, Lock, Shield, CheckCircle, AlertCircle,
  Eye, EyeOff, BadgeCheck, Globe,
} from 'lucide-react';
import { useTranslation, useLanguage, useSetLanguage, type Language } from '../i18n';

// ── IPC reference ────────────────────────────────────────────────────────────

const IPC_DATABASE = [
  { section: '302', offence: 'Murder / Homicide offences', classification: 'Cognizable & Non-Bailable', maxPenalty: 'Death Penalty or Life Imprisonment' },
  { section: '379', offence: 'Theft / Robbery (Property seizures)', classification: 'Cognizable & Non-Bailable', maxPenalty: 'Imprisonment up to 3 years' },
  { section: '420', offence: 'Cheating / Cyber Fraud & Ledger spoofing', classification: 'Cognizable & Bailable', maxPenalty: 'Imprisonment up to 7 years' },
  { section: '363', offence: 'Kidnapping & Abduction protocols', classification: 'Cognizable & Non-Bailable', maxPenalty: 'Imprisonment up to 7 years' },
  { section: '506', offence: 'Criminal Intimidation / Threats', classification: 'Non-Cognizable & Bailable', maxPenalty: 'Imprisonment up to 2 years' },
];

// ── Shared UI atoms ──────────────────────────────────────────────────────────

const Field: React.FC<{
  label: string;
  hint?: string;
  locked?: boolean;
  children: React.ReactNode;
}> = ({ label, hint, locked, children }) => (
  <div className="space-y-1">
    <div className="flex items-center gap-1.5">
      <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
        {label}
      </label>
      {locked && (
        <span className="inline-flex items-center gap-0.5 text-[9px] font-mono text-[var(--text-disabled)] bg-[var(--bg-tertiary)] border border-[var(--border-primary)] px-1.5 py-0.5 rounded">
          <Lock className="w-2.5 h-2.5" /> IMMUTABLE
        </span>
      )}
    </div>
    {children}
    {hint && <p className="text-[10px] text-[var(--text-muted)]">{hint}</p>}
  </div>
);

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { locked?: boolean }> = ({
  locked, className = '', ...props
}) => (
  <input
    {...props}
    disabled={locked || props.disabled}
    className={`w-full px-3 py-2 rounded-lg border text-[13px] font-mono outline-none transition-colors
      ${locked
        ? 'bg-[var(--bg-tertiary)]/40 border-[var(--border-primary)]/50 text-[var(--text-disabled)] cursor-not-allowed select-none'
        : 'bg-[var(--bg-secondary)] border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--accent-blue)]/60 focus:bg-[var(--bg-primary)]'
      } ${className}`}
  />
);

// ── Toast ────────────────────────────────────────────────────────────────────

type ToastKind = 'success' | 'error';
const Toast: React.FC<{ kind: ToastKind; message: string }> = ({ kind, message }) => (
  <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-[12px] font-medium
    ${kind === 'success'
      ? 'bg-[var(--accent-teal-subtle)] border-[var(--accent-teal)]/30 text-[var(--accent-teal)]'
      : 'bg-red-950/20 border-red-900/30 text-red-400'
    }`}>
    {kind === 'success'
      ? <CheckCircle className="w-4 h-4 shrink-0" />
      : <AlertCircle className="w-4 h-4 shrink-0" />}
    {message}
  </div>
);

// ── Profile Tab ──────────────────────────────────────────────────────────────

const ProfileTab: React.FC = () => {
  const { user, updateUser } = useAuthStore();
  const { addLog } = useAuditStore();
  const { isCourt } = useRBAC();

  const [displayName, setDisplayName] = useState(user?.name ?? '');
  const [email, setEmail] = useState('');
  const [district, setDistrict] = useState('');
  const [station, setStation] = useState('');
  const [profileToast, setProfileToast] = useState<{ kind: ToastKind; msg: string } | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwToast, setPwToast] = useState<{ kind: ToastKind; msg: string } | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  const flash = (setter: typeof setProfileToast, kind: ToastKind, msg: string) => {
    setter({ kind, msg });
    setTimeout(() => setter(null), 3500);
  };

  const handleSaveProfile = async () => {
    if (!displayName.trim()) return flash(setProfileToast, 'error', 'Display name cannot be empty.');
    setProfileSaving(true);
    try {
      const payload: Record<string, string> = { full_name: displayName.trim() };
      if (email.trim()) payload.email = email.trim();
      if (district.trim()) payload.district = district.trim();
      if (station.trim()) payload.station = station.trim();
      const updated = await updateProfile(payload);
      updateUser({ name: updated.full_name });
      addLog(updated.full_name, user?.badgeId ?? '', 'AUTH', 'Updated profile settings');
      flash(setProfileToast, 'success', 'Profile updated successfully.');
    } catch (err) {
      flash(setProfileToast, 'error', err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPin || !newPin) return flash(setPwToast, 'error', 'All PIN fields are required.');
    if (newPin !== confirmPin) return flash(setPwToast, 'error', 'New PINs do not match.');
    const isPin = newPin.length === 6 && /^\d{6}$/.test(newPin);
    if (!isPin && newPin.length < 8) return flash(setPwToast, 'error', 'New PIN must be at least 8 characters (or a 6-digit PIN).');
    setPwSaving(true);
    try {
      await changePassword(oldPin, newPin);
      addLog(user?.name ?? '', user?.badgeId ?? '', 'AUTH', 'Changed account PIN/password');
      flash(setPwToast, 'success', 'PIN changed successfully.');
      setOldPin(''); setNewPin(''); setConfirmPin('');
    } catch (err) {
      flash(setPwToast, 'error', err instanceof Error ? err.message : 'PIN change failed.');
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Identity card */}
      <div className="flex items-center gap-4 p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg font-mono shrink-0 border ${
          isCourt
            ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
            : 'bg-[var(--accent-blue-subtle)] border-[var(--accent-blue)]/20 text-[var(--accent-blue)]'
        }`}>
          {(user?.name ?? 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-[var(--text-primary)] truncate">{user?.name}</p>
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            <BadgeCheck className={`w-3.5 h-3.5 ${isCourt ? 'text-indigo-400' : 'text-[var(--accent-teal)]'}`} />
            <span className="text-[11px] font-mono text-[var(--text-muted)]">{user?.badgeId}</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
              isCourt
                ? 'text-indigo-300 bg-indigo-500/15 border-indigo-500/30'
                : 'text-[var(--accent-blue)] bg-[var(--accent-blue-subtle)] border-[var(--accent-blue)]/20'
            }`}>
              {user?.role}
            </span>
            {user?.organizationName && (
              <span className="text-[10px] font-mono text-purple-300 bg-purple-500/10 border border-purple-500/30 px-1.5 py-0.5 rounded">
                {user.organizationName}
              </span>
            )}
            {user?.designation && (
              <span className="text-[10px] text-[var(--text-muted)] font-mono">
                {user.designation}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Editable profile fields */}
      <div className="p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-primary)]">
          <User className="w-4 h-4 text-[var(--accent-blue)]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
            {isCourt ? 'Judicial Profile & Authority Assignment' : 'Profile Information'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={isCourt ? 'Judicial Identifier' : 'Badge ID'} locked>
            <Input value={user?.badgeId ?? ''} locked readOnly />
          </Field>
          <Field label="System Role" locked>
            <Input value={user?.role ?? ''} locked readOnly />
          </Field>
          {user?.organizationName && (
            <Field label="Registered Authority" locked>
              <Input value={`${user.organizationName} (${user.authorityType || 'COURT'})`} locked readOnly />
            </Field>
          )}
          {user?.designation && (
            <Field label="Official Designation" locked>
              <Input value={user.designation} locked readOnly />
            </Field>
          )}
          <Field label="Display Name" hint="Shown in the sidebar and audit logs">
            <Input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Full name"
              maxLength={255}
            />
          </Field>
          <Field label="Email Address">
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Leave blank to keep current"
              maxLength={255}
            />
          </Field>
          <Field label={isCourt ? 'Judicial Jurisdiction' : 'District'} hint={isCourt ? 'Assigned judicial jurisdiction' : 'Your assigned district'}>
            <Input
              value={district}
              onChange={e => setDistrict(e.target.value)}
              placeholder={isCourt ? 'e.g. Karnataka High Court / Bengaluru' : 'e.g. Bengaluru Urban'}
              maxLength={100}
            />
          </Field>
          <Field label={isCourt ? 'Court Room / Chamber' : 'Station'} hint={isCourt ? 'Assigned chamber / court room' : 'Your assigned police station'}>
            <Input
              value={station}
              onChange={e => setStation(e.target.value)}
              placeholder={isCourt ? 'e.g. Court Room 4B' : 'e.g. Cubbon Park PS'}
              maxLength={100}
            />
          </Field>
        </div>

        {profileToast && <Toast kind={profileToast.kind} message={profileToast.msg} />}

        <button
          onClick={handleSaveProfile}
          disabled={profileSaving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-blue)] text-white text-[12px] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          {profileSaving ? 'Saving…' : 'Save Profile'}
        </button>
      </div>

      {/* Change PIN */}
      <div className="p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-primary)]">
          <Lock className="w-4 h-4 text-[var(--accent-coral)]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)]">Change PIN / Password</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Current PIN">
            <div className="relative">
              <Input
                type={showOld ? 'text' : 'password'}
                value={oldPin}
                onChange={e => setOldPin(e.target.value)}
                placeholder="Current PIN"
                maxLength={128}
              />
              <button
                type="button"
                onClick={() => setShowOld(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                {showOld ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </Field>
          <Field label="New PIN" hint="8+ characters with letters & number, or a 6-digit numeric PIN">
            <div className="relative">
              <Input
                type={showNew ? 'text' : 'password'}
                value={newPin}
                onChange={e => setNewPin(e.target.value)}
                placeholder="New PIN"
                maxLength={128}
              />
              <button
                type="button"
                onClick={() => setShowNew(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                {showNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </Field>
          <Field label="Confirm New PIN">
            <Input
              type="password"
              value={confirmPin}
              onChange={e => setConfirmPin(e.target.value)}
              placeholder="Repeat new PIN"
              maxLength={128}
            />
          </Field>
        </div>

        {pwToast && <Toast kind={pwToast.kind} message={pwToast.msg} />}

        <button
          onClick={handleChangePassword}
          disabled={pwSaving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-coral)] text-white text-[12px] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
        >
          <Shield className="w-3.5 h-3.5" />
          {pwSaving ? 'Updating…' : 'Update PIN'}
        </button>
      </div>
    </div>
  );
};

// ── System Tab ───────────────────────────────────────────────────────────────

const SystemTab: React.FC = () => {
  const { user } = useAuthStore();
  const { addLog, clearLogs } = useAuditStore();
  const [sessionTimeout, setSessionTimeout] = useState('30m');
  const [mapPulseSpeed, setMapPulseSpeed] = useState('medium');
  const [realtimeAuditLogs, setRealtimeAuditLogs] = useState(true);
  const [saved, setSaved] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleSave = () => {
    addLog(user?.name ?? '', user?.badgeId ?? '', 'AUTH',
      `Configured Settings: SessionTimeout=${sessionTimeout}, MapPulse=${mapPulseSpeed}`);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearLogs = () => {
    clearLogs();
    addLog(user?.name ?? '', user?.badgeId ?? '', 'AUTH', 'Cleared local session activity log');
    setConfirmClear(false);
  };

  const selectCls = 'bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg px-3 py-1.5 outline-none focus:border-[var(--accent-blue)]/60 text-[12px] font-mono cursor-pointer';

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] space-y-5">
        <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-primary)]">
          <Settings className="w-4 h-4 text-[var(--accent-teal)]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)]">Operational Tuning</span>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] text-[var(--text-primary)]">Operator Session Timeout</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Auto-logout after inactivity</p>
          </div>
          <select value={sessionTimeout} onChange={e => setSessionTimeout(e.target.value)} className={selectCls}>
            <option value="5m">5 Minutes</option>
            <option value="15m">15 Minutes</option>
            <option value="30m">30 Minutes</option>
            <option value="1h">1 Hour</option>
            <option value="never">Infinite (Override lock)</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] text-[var(--text-primary)]">Map Radar Pulse Speed</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Hotspot animation frequency</p>
          </div>
          <select value={mapPulseSpeed} onChange={e => setMapPulseSpeed(e.target.value)} className={selectCls}>
            <option value="slow">Slow (Low energy)</option>
            <option value="medium">Medium (Standard)</option>
            <option value="fast">Fast (Real-time tracking)</option>
          </select>
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={realtimeAuditLogs}
            onChange={e => setRealtimeAuditLogs(e.target.checked)}
            className="mt-0.5 accent-[var(--accent-teal)] w-4 h-4"
          />
          <div>
            <p className="text-[13px] text-[var(--text-primary)] font-medium">Enable Realtime Audit Streams</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Writes page telemetry navigations directly into the ledger window.</p>
          </div>
        </label>

        <div className="flex items-center justify-between pt-3 border-t border-[var(--border-primary)]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Session Activity Log</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Clears local session notes only; the server audit trail is unaffected</p>
          </div>
          {confirmClear ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-red-400 font-medium">Are you sure?</span>
              <button
                onClick={handleClearLogs}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-[11px] cursor-pointer transition-colors"
              >
                Yes, Purge
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="px-3 py-1.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-secondary)] font-semibold rounded-lg text-[11px] cursor-pointer transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              className="px-3 py-1.5 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 text-red-400 font-semibold rounded-lg text-[11px] cursor-pointer transition-colors"
            >
              Clear Audit Trail
            </button>
          )}
        </div>
      </div>

      <button
        onClick={handleSave}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-teal)] text-white text-[12px] font-semibold hover:opacity-90 transition-opacity cursor-pointer"
      >
        {saved ? <CheckCircle className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
        {saved ? 'Saved!' : 'Save Configuration'}
      </button>
    </div>
  );
};

// ── Help Tab ─────────────────────────────────────────────────────────────────

const HelpTab: React.FC = () => {
  const [ipcSearch, setIpcSearch] = useState('');
  const matched = IPC_DATABASE.find(i => i.section === ipcSearch.trim()) ?? null;

  return (
    <div className="space-y-5">
      {/* IPC lookup */}
      <div className="p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-primary)]">
          <Search className="w-4 h-4 text-[var(--accent-blue)]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)]">Legislative IPC Code Look-Up</span>
        </div>
        <div className="relative flex items-center">
          <Search className="absolute left-3 w-3.5 h-3.5 text-[var(--text-muted)]" />
          <input
            type="text"
            maxLength={3}
            placeholder="Enter section code (e.g. 379, 420, 302)…"
            value={ipcSearch}
            onChange={e => setIpcSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg outline-none focus:border-[var(--accent-blue)]/60 text-[12px] font-mono"
          />
        </div>
        {matched ? (
          <div className="p-3 bg-[var(--accent-teal-subtle)] border border-[var(--accent-teal)]/20 rounded-lg space-y-1">
            <div className="flex justify-between text-[10px] font-bold uppercase">
              <span className="text-[var(--text-primary)]">IPC Section {matched.section}</span>
              <span className="text-[var(--accent-teal)]">{matched.classification}</span>
            </div>
            <p className="text-[13px] font-semibold text-[var(--text-primary)]">{matched.offence}</p>
            <p className="text-[11px] text-[var(--text-muted)]">Max Penalty: <span className="text-[var(--text-primary)] font-bold">{matched.maxPenalty}</span></p>
          </div>
        ) : ipcSearch.trim() ? (
          <p className="text-[11px] text-red-400 font-medium">No section matching "{ipcSearch}" found.</p>
        ) : (
          <p className="text-[11px] text-[var(--text-muted)]">Type an IPC section number to verify crime classifications instantly.</p>
        )}
      </div>

      {/* Hotlines */}
      <div className="p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-primary)]">
          <Phone className="w-4 h-4 text-[var(--accent-blue)]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)]">Direct Communications Hotlines</span>
        </div>
        {[
          { label: 'SCRB Command Central Desk', number: '+91 80 2294 2111', href: 'tel:+918022942111', color: 'text-[var(--accent-blue)]' },
          { label: 'Cyber Crime HQ (Bengaluru)', number: '+91 80 2294 3355', href: 'tel:+918022943355', color: 'text-[var(--accent-blue)]' },
          { label: 'Emergency Response Support', number: '112 (Radio Dispatch)', href: 'tel:112', color: 'text-red-400' },
        ].map(h => (
          <div key={h.href} className="flex items-center justify-between p-3 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg">
            <span className="text-[12px] text-[var(--text-secondary)]">{h.label}</span>
            <a href={h.href} className={`${h.color} hover:underline font-bold text-[12px] flex items-center gap-1.5`}>
              <Phone className="w-3 h-3" />{h.number}
            </a>
          </div>
        ))}
      </div>

      {/* Advisory */}
      <div className="flex items-start gap-3 p-3 bg-[var(--bg-secondary)] border border-[var(--accent-blue)]/15 rounded-xl">
        <Info className="w-4 h-4 text-[var(--accent-blue)] shrink-0 mt-0.5" />
        <div>
          <p className="text-[10px] font-bold uppercase text-[var(--text-primary)] mb-0.5">Operator Advisory</p>
          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
            Shift handovers require clearing the active audit terminal window or generating a dashboard telemetry dossier backup before logout.
          </p>
        </div>
      </div>
    </div>
  );
};

// ── Language Tab ─────────────────────────────────────────────────────────────

const LanguageTab: React.FC = () => {
  const t = useTranslation();
  const currentLang = useLanguage();
  const setLang = useSetLanguage();

  const languages: { value: Language; label: string; nativeLabel: string; description: string }[] = [
    { value: 'en', label: 'English', nativeLabel: 'English', description: 'Interface in English' },
    { value: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ', description: 'Interface in Kannada script' },
    { value: 'kn-en', label: 'Kanglish', nativeLabel: 'Kanglish', description: 'Kannada in Roman characters' },
  ];

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-primary)]">
          <Globe className="w-4 h-4 text-[var(--accent-blue)]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
            {t.settings_language_preference}
          </span>
        </div>

        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
          {t.settings_language_hint}
        </p>

        <div className="space-y-2">
          {languages.map((lang) => (
            <label
              key={lang.value}
              onClick={() => setLang(lang.value)}
              className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                currentLang === lang.value
                  ? 'border-[var(--accent-blue)]/60 bg-[var(--accent-blue)]/5 shadow-sm'
                  : 'border-[var(--border-primary)] bg-[var(--bg-primary)]/50 hover:border-[var(--accent-blue)]/30'
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                currentLang === lang.value
                  ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)]'
                  : 'border-[var(--border-primary)]'
              }`}>
                {currentLang === lang.value && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                    {lang.nativeLabel}
                  </span>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">
                    ({lang.label})
                  </span>
                </div>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{lang.description}</p>
              </div>
            </label>
          ))}
        </div>

        <div className="flex items-start gap-3 p-3 bg-[var(--bg-primary)]/50 border border-[var(--accent-blue)]/15 rounded-lg">
          <Info className="w-4 h-4 text-[var(--accent-blue)] shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-bold uppercase text-[var(--text-primary)] mb-0.5">
              {t.settings_ai_language_note}
            </p>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Your AI assistant language is independent of the UI language. You can communicate with the AI in English, Kannada, Kanglish, or any other supported language regardless of your UI setting.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main page ────────────────────────────────────────────────────────────────

type Tab = 'profile' | 'language' | 'system' | 'help';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
  { id: 'language', label: 'Language', icon: <Globe className="w-4 h-4" /> },
  { id: 'system',  label: 'System',  icon: <Settings className="w-4 h-4" /> },
  { id: 'help',    label: 'Help',    icon: <LifeBuoy className="w-4 h-4" /> },
];

export const SettingsHelp: React.FC = () => {
  const { isAdmin } = useRBAC();
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  const tabs = TABS.filter((t) => isAdmin || t.id !== 'system');
  const tabIds = new Set(tabs.map((t) => t.id));
  const active: Tab = tabIds.has(activeTab) ? activeTab : 'profile';

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-10">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Settings className="w-5 h-5 text-[var(--accent-teal)]" />
          Settings
        </h2>
        <p className="text-[11px] text-[var(--text-muted)] mt-0.5 font-mono uppercase tracking-wider">
          {isAdmin ? 'Profile · System Configuration · Operator Help' : 'Profile · Account & Operator Help'}
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all cursor-pointer
              ${active === t.id
                ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm border border-[var(--border-primary)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {active === 'profile'  && <ProfileTab />}
      {active === 'language' && <LanguageTab />}
      {active === 'system'   && isAdmin && <SystemTab />}
      {active === 'help'     && <HelpTab />}
    </div>
  );
};

export default SettingsHelp;
