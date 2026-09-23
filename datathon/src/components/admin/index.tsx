import React from 'react';
import { Save, ShieldCheck, Trash2 } from 'lucide-react';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  full_name: string;
  is_active: boolean;
  district: string | null;
  station: string | null;
  role_id: string;
  role: string;
  organization_id?: string | null;
  organization_name?: string | null;
  designation?: string | null;
  jurisdiction?: string | null;
  scope_level?: string | null;
  authority_type?: string | null;
  created_at: string;
}

export interface AdminRole {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  user_count: number;
}

export interface AuditRow {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  action: string;
  module: string;
  record_id: string | null;
  status: string;
  ip: string | null;
  details: string | null;
}

export const UserTable: React.FC<{
  users: AdminUser[];
  onEdit: (user: AdminUser) => void;
  onToggle: (user: AdminUser) => void;
  onDelete: (user: AdminUser) => void;
}> = ({ users, onEdit, onToggle, onDelete }) => (
  <div className="overflow-auto rounded-lg border border-border-color bg-[var(--bg-tertiary)]/25 custom-scrollbar">
    <table className="w-full text-left text-[10px]">
      <thead className="bg-[var(--bg-primary)] text-[var(--text-muted)] uppercase tracking-wider">
        <tr><th className="p-3">User</th><th className="p-3">Role</th><th className="p-3">Authority / Assignment</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th></tr>
      </thead>
      <tbody className="divide-y divide-[var(--border-primary)] text-[var(--text-secondary)]">
        {users.map((user) => (
          <tr key={user.id}>
            <td className="p-3">
              <p className="font-bold text-[var(--text-primary)]">{user.full_name}</p>
              <p>{user.username} / {user.email}</p>
            </td>
            <td className="p-3 uppercase">
              <span className="font-mono">{user.role}</span>
              {user.designation && <span className="block text-[9px] text-indigo-300 font-sans">{user.designation}</span>}
            </td>
            <td className="p-3">
              {user.organization_name ? (
                <div>
                  <span className="font-semibold text-indigo-300">{user.organization_name}</span>
                  {user.authority_type && <span className="text-[9px] font-mono text-[var(--text-muted)] block uppercase">[{user.authority_type}]</span>}
                </div>
              ) : (
                <span>{user.station ?? '-'}{user.district ? `, ${user.district}` : ''}</span>
              )}
            </td>
            <td className="p-3"><span className={user.is_active ? 'text-[#0E9E78]' : 'text-amber-400'}>{user.is_active ? 'Active' : 'Inactive'}</span></td>
            <td className="p-3">
              <div className="flex justify-end gap-2">
                <button onClick={() => onEdit(user)} className="rounded border border-[#1E6FD9]/35 px-2 py-1 text-[var(--text-primary)]">Edit</button>
                <button onClick={() => onToggle(user)} className="rounded border border-[#0E9E78]/35 px-2 py-1 text-[var(--text-primary)]">{user.is_active ? 'Deactivate' : 'Activate'}</button>
                <button onClick={() => onDelete(user)} className="rounded border border-red-500/35 px-2 py-1 text-red-300"><Trash2 className="h-3 w-3" /></button>
              </div>
            </td>
          </tr>
        ))}
        {users.length === 0 && <tr><td colSpan={5} className="p-8 text-center uppercase tracking-widest text-[var(--text-muted)]">No users found</td></tr>}
      </tbody>
    </table>
  </div>
);

export const UserForm: React.FC<{
  roles: AdminRole[];
  organizations?: Array<{ id: string; name: string; authority_type: string }>;
  value: Partial<AdminUser> & { password?: string };
  onChange: (value: Partial<AdminUser> & { password?: string }) => void;
  onSubmit: () => void;
}> = ({ roles, organizations = [], value, onChange, onSubmit }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 rounded-lg border border-border-color bg-[var(--bg-tertiary)]/35 p-3">
    <input placeholder="Full name" value={value.full_name ?? ''} onChange={(e) => onChange({ ...value, full_name: e.target.value })} className="rounded bg-[var(--bg-primary)] border border-border-color px-3 py-2 text-xs text-[var(--text-primary)]" />
    <input placeholder="Username" value={value.username ?? ''} onChange={(e) => onChange({ ...value, username: e.target.value })} disabled={!!value.id} className="rounded bg-[var(--bg-primary)] border border-border-color px-3 py-2 text-xs text-[var(--text-primary)] disabled:opacity-50" />
    <input placeholder="Email" value={value.email ?? ''} onChange={(e) => onChange({ ...value, email: e.target.value })} className="rounded bg-[var(--bg-primary)] border border-border-color px-3 py-2 text-xs text-[var(--text-primary)]" />
    {!value.id && <input placeholder="Temporary password" type="password" value={value.password ?? ''} onChange={(e) => onChange({ ...value, password: e.target.value })} className="rounded bg-[var(--bg-primary)] border border-border-color px-3 py-2 text-xs text-[var(--text-primary)]" />}
    <select value={value.role_id ?? ''} onChange={(e) => onChange({ ...value, role_id: e.target.value })} className="rounded bg-[var(--bg-primary)] border border-border-color px-3 py-2 text-xs text-[var(--text-primary)]">
      <option value="">Select role</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
    </select>
    <select value={value.organization_id ?? ''} onChange={(e) => onChange({ ...value, organization_id: e.target.value || null })} className="rounded bg-[var(--bg-primary)] border border-border-color px-3 py-2 text-xs text-[var(--text-primary)]">
      <option value="">No Organization (Direct / Police)</option>
      {organizations.map((org) => <option key={org.id} value={org.id}>{org.name} ({org.authority_type})</option>)}
    </select>
    <input placeholder="Designation (e.g. Judicial Magistrate, Analyst)" value={value.designation ?? ''} onChange={(e) => onChange({ ...value, designation: e.target.value })} className="rounded bg-[var(--bg-primary)] border border-border-color px-3 py-2 text-xs text-[var(--text-primary)]" />
    <input placeholder="District" value={value.district ?? ''} onChange={(e) => onChange({ ...value, district: e.target.value })} className="rounded bg-[var(--bg-primary)] border border-border-color px-3 py-2 text-xs text-[var(--text-primary)]" />
    <input placeholder="Station / Court Room" value={value.station ?? ''} onChange={(e) => onChange({ ...value, station: e.target.value })} className="rounded bg-[var(--bg-primary)] border border-border-color px-3 py-2 text-xs text-[var(--text-primary)]" />
    <button onClick={onSubmit} className="inline-flex items-center justify-center gap-2 rounded bg-[#1E6FD9]/20 border border-[#1E6FD9]/40 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]"><Save className="h-3.5 w-3.5" /> {value.id ? 'Save User' : 'Create User'}</button>
  </div>
);

export const PermissionEditor: React.FC<{ permissions: string[]; selected: string[]; onChange: (permissions: string[]) => void }> = ({ permissions, selected, onChange }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
    {permissions.map((permission) => (
      <label key={permission} className="flex items-center gap-2 rounded border border-border-color bg-[var(--bg-primary)] px-2 py-2 text-[10px] text-[var(--text-secondary)]">
        <input type="checkbox" checked={selected.includes(permission)} onChange={(e) => onChange(e.target.checked ? [...selected, permission] : selected.filter((item) => item !== permission))} />
        {permission}
      </label>
    ))}
  </div>
);

export const RoleMatrix: React.FC<{ roles: AdminRole[]; permissions: string[]; onSave: (role: AdminRole) => void }> = ({ roles, permissions, onSave }) => (
  <div className="space-y-3">
    {roles.map((role) => <RoleRow key={role.id} role={role} permissions={permissions} onSave={onSave} />)}
  </div>
);

const RoleRow: React.FC<{ role: AdminRole; permissions: string[]; onSave: (role: AdminRole) => void }> = ({ role, permissions, onSave }) => {
  const [selected, setSelected] = React.useState(role.permissions);
  return (
    <div className="rounded-lg border border-border-color bg-[var(--bg-tertiary)]/35 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div><p className="font-bold uppercase text-[var(--text-primary)]">{role.name}</p><p className="text-[10px] text-[var(--text-muted)]">{role.user_count} assigned users</p></div>
        <button onClick={() => onSave({ ...role, permissions: selected })} className="inline-flex items-center gap-2 rounded border border-[#0E9E78]/35 px-3 py-2 text-[10px] uppercase text-[var(--text-primary)]"><ShieldCheck className="h-3.5 w-3.5" /> Save</button>
      </div>
      <PermissionEditor permissions={permissions} selected={selected} onChange={setSelected} />
    </div>
  );
};

export const AuditTable: React.FC<{ rows: AuditRow[] }> = ({ rows }) => (
  <div className="overflow-auto rounded-lg border border-border-color bg-[var(--bg-tertiary)]/25 custom-scrollbar">
    <table className="w-full text-left text-[10px]">
      <thead className="bg-[var(--bg-primary)] text-[var(--text-muted)] uppercase tracking-wider"><tr><th className="p-3">Time</th><th className="p-3">User</th><th className="p-3">Action</th><th className="p-3">Module</th><th className="p-3">IP</th></tr></thead>
      <tbody className="divide-y divide-[var(--border-primary)] text-[var(--text-secondary)]">{rows.map((row) => <tr key={row.id}><td className="p-3">{new Date(row.timestamp).toLocaleString()}</td><td className="p-3">{row.user}<br />{row.role}</td><td className="p-3">{row.action}</td><td className="p-3">{row.module}</td><td className="p-3">{row.ip ?? '-'}</td></tr>)}</tbody>
    </table>
  </div>
);

export const SettingsForm: React.FC<{ value: Record<string, any>; onChange: (value: Record<string, any>) => void; onSave: () => void; onReset: () => void }> = ({ value, onChange, onSave, onReset }) => {
  const set = (section: string, key: string, raw: string) => onChange({ ...value, [section]: { ...(value[section] ?? {}), [key]: /^\d+$/.test(raw) ? Number(raw) : raw } });
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {['general', 'organization', 'security', 'password_policy', 'report_defaults', 'localization', 'theme', 'backup'].map((section) => (
        <div key={section} className="rounded-lg border border-border-color bg-[var(--bg-tertiary)]/35 p-3">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">{section.replace(/_/g, ' ')}</p>
          <input placeholder="Name / mode / policy value" value={value[section]?.name ?? value[section]?.mode ?? ''} onChange={(e) => set(section, value[section]?.mode !== undefined ? 'mode' : 'name', e.target.value)} className="mb-2 w-full rounded bg-[var(--bg-primary)] border border-border-color px-3 py-2 text-xs text-[var(--text-primary)]" />
          <input placeholder="Timeout / retention / minimum length" value={value[section]?.session_timeout_minutes ?? value[section]?.retention_days ?? value[section]?.minimum_length ?? ''} onChange={(e) => set(section, section === 'security' ? 'session_timeout_minutes' : section === 'backup' ? 'retention_days' : 'minimum_length', e.target.value)} className="w-full rounded bg-[var(--bg-primary)] border border-border-color px-3 py-2 text-xs text-[var(--text-primary)]" />
        </div>
      ))}
      <div className="md:col-span-2 flex gap-2 justify-end"><button onClick={onReset} className="rounded border border-border-color px-3 py-2 text-xs text-[var(--text-primary)]">Reset</button><button onClick={onSave} className="rounded bg-[#1E6FD9]/20 border border-[#1E6FD9]/40 px-3 py-2 text-xs font-bold uppercase text-[var(--text-primary)]">Save Settings</button></div>
    </div>
  );
};

export const ConfirmationDialog: React.FC<{ open: boolean; title: string; onConfirm: () => void; onCancel: () => void }> = ({ open, title, onConfirm, onCancel }) => !open ? null : (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
    <div className="w-full max-w-sm rounded-lg border border-border-color bg-[var(--bg-secondary)] p-4">
      <p className="text-sm font-bold text-[var(--text-primary)]">{title}</p>
      <div className="mt-4 flex justify-end gap-2"><button onClick={onCancel} className="rounded border border-border-color px-3 py-2 text-xs text-[var(--text-primary)]">Cancel</button><button onClick={onConfirm} className="rounded border border-red-500/40 bg-red-500/15 px-3 py-2 text-xs text-red-100">Confirm</button></div>
    </div>
  </div>
);
