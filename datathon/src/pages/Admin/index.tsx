import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw, Search } from 'lucide-react';
import { apiRequest, getOrganizations, type OrganizationRecord } from '../../services/api';
import {
  AuditTable,
  ConfirmationDialog,
  RoleMatrix,
  SettingsForm,
  UserForm,
  UserTable,
  type AdminRole,
  type AdminUser,
  type AuditRow,
} from '../../components/admin';
import { DataImportPanel } from '../../components/admin/DataImportPanel';
import DataQualityPanel from '../../components/admin/DataQualityPanel';
import ModelHealthPanel from '../../components/admin/ModelHealthPanel';
import { OrganizationsPanel } from '../../components/admin/OrganizationsPanel';
import { CaseAccessPanel } from '../../components/admin/CaseAccessPanel';

type Tab = 'users' | 'roles' | 'organizations' | 'case_access' | 'audit' | 'import' | 'quality' | 'settings';

const emptyUser: Partial<AdminUser> & { password?: string } = { is_active: true };

export const Admin: React.FC = () => {
  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [userDraft, setUserDraft] = useState<Partial<AdminUser> & { password?: string }>(emptyUser);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmUser, setConfirmUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(false);

  const userQuery = useMemo(() => new URLSearchParams(search ? { search } : {}).toString(), [search]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersResponse, rolesResponse, permissionsResponse, auditResponse, settingsResponse, orgsResponse] = await Promise.all([
        apiRequest<{ results: AdminUser[] }>(`/admin/users?${userQuery}`),
        apiRequest<{ results: AdminRole[] }>('/admin/roles'),
        apiRequest<{ permissions: string[] }>('/admin/permissions'),
        apiRequest<{ results: AuditRow[] }>('/admin/audit-logs?page_size=50'),
        apiRequest<Record<string, any>>('/admin/settings'),
        getOrganizations().catch(() => ({ results: [] })),
      ]);
      setUsers(usersResponse.results);
      setRoles(rolesResponse.results);
      setPermissions(permissionsResponse.permissions);
      setAuditRows(auditResponse.results);
      setSettings(settingsResponse);
      setOrganizations(orgsResponse.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, [userQuery]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const saveUser = async () => {
    setError(null);
    try {
      const payload = { ...userDraft } as Record<string, unknown>;
      Object.keys(payload).forEach(key => {
        if (payload[key] === '') {
          payload[key] = null;
        }
      });
      if (!payload.role_id) throw new Error('Select a role');
      if (payload.id) {
        await apiRequest(`/admin/users/${payload.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await apiRequest('/admin/users', { method: 'POST', body: JSON.stringify(payload) });
      }
      setUserDraft(emptyUser);
      setMessage('User saved');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save user');
    }
  };

  const toggleUser = async (user: AdminUser) => {
    await apiRequest(`/admin/users/${user.id}/${user.is_active ? 'deactivate' : 'activate'}`, { method: 'POST' });
    setMessage(user.is_active ? 'User deactivated' : 'User activated');
    await loadAll();
  };

  const deleteUser = async () => {
    if (!confirmUser) return;
    await apiRequest(`/admin/users/${confirmUser.id}`, { method: 'DELETE' });
    setConfirmUser(null);
    setMessage('User soft deleted');
    await loadAll();
  };

  const saveRole = async (role: AdminRole) => {
    try {
      await apiRequest(`/admin/roles/${role.id}`, { method: 'PUT', body: JSON.stringify(role) });
      setMessage('Role permissions saved');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save role');
    }
  };

  const saveSettings = async () => {
    try {
      const response = await apiRequest<Record<string, any>>('/admin/settings', { method: 'PUT', body: JSON.stringify(settings) });
      setSettings(response);
      setMessage('Settings saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    }
  };

  const exportAudit = async () => {
    try {
      const { accessToken, API_BASE_URL } = await import('../../services/api').then(m => ({ 
        accessToken: m.getStoredTokens().accessToken, 
        API_BASE_URL: m.API_BASE_URL 
      }));
      const response = await fetch(`${API_BASE_URL}/admin/audit-logs/export`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
      });
      if (!response.ok) {
        let msg = response.statusText;
        try { const d = await response.json(); msg = d.detail || d.message || msg; } catch { /* non-JSON error body */ }
        throw new Error(msg || 'Failed to export audit logs');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'saksha_audit_logs.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export audit logs');
    }
  };

  return (
    <div className="min-h-[84vh] space-y-4 p-1 md:p-3 bg-[var(--bg-primary)] font-mono">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 border-b border-[var(--border-muted)] pb-4">
        <div>
          <h2 className="text-md font-bold uppercase tracking-wider text-[var(--text-primary)]">Administrative Control</h2>
          <p className="mt-1 text-[9.5px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Users, RBAC, audit logs, and persisted platform settings</p>
        </div>
        <button onClick={() => void loadAll()} className="inline-flex items-center gap-2 rounded border border-[#1E6FD9]/35 bg-[#1E6FD9]/15 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button>
      </div>

      {(message || error || loading) && <div className={`rounded border px-3 py-2 text-[10px] uppercase tracking-wider ${error ? 'border-amber-500/30 text-amber-300' : 'border-[#0E9E78]/30 text-[#0E9E78]'}`}>{error ?? message ?? 'Loading admin data'}</div>}

      <div className="flex flex-wrap gap-2">
        {(['users', 'roles', 'organizations', 'case_access', 'audit', 'import', 'quality', 'settings'] as Tab[]).map((item) => (
          <button key={item} onClick={() => setTab(item)} className={`rounded border px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${tab === item ? 'border-[#1E6FD9] bg-[#1E6FD9]/20 text-[var(--text-primary)]' : 'border-border-color bg-[var(--bg-tertiary)]/35 text-[var(--text-secondary)]'}`}>{item.replace('_', ' ')}</button>
        ))}
      </div>

      {tab === 'users' && (
        <div className="space-y-3">
          <div className="relative max-w-md"><Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[var(--text-muted)]" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users" className="w-full rounded bg-[var(--bg-primary)] border border-border-color py-2 pl-9 pr-3 text-xs text-[var(--text-primary)]" /></div>
          <UserForm roles={roles} organizations={organizations} value={userDraft} onChange={setUserDraft} onSubmit={() => void saveUser()} />
          <UserTable users={users} onEdit={setUserDraft} onToggle={(user) => void toggleUser(user)} onDelete={setConfirmUser} />
        </div>
      )}
      {tab === 'roles' && <RoleMatrix roles={roles} permissions={permissions} onSave={(role) => void saveRole(role)} />}
      {tab === 'organizations' && <OrganizationsPanel />}
      {tab === 'case_access' && <CaseAccessPanel />}
      {tab === 'audit' && (
        <div className="space-y-3">
          <button onClick={() => void exportAudit()} className="inline-flex items-center gap-2 rounded border border-[#0E9E78]/35 bg-[#0E9E78]/15 px-3 py-2 text-[10px] font-bold uppercase text-[var(--text-primary)]"><Download className="h-3.5 w-3.5" /> Export Audit CSV</button>
          <AuditTable rows={auditRows} />
        </div>
      )}
      {tab === 'import' && <DataImportPanel />}
      {tab === 'quality' && (
        <div className="space-y-6">
          <DataQualityPanel />
          <ModelHealthPanel />
        </div>
      )}
      {tab === 'settings' && <SettingsForm value={settings} onChange={setSettings} onSave={() => void saveSettings()} onReset={() => void loadAll()} />}

      <ConfirmationDialog open={!!confirmUser} title={`Deactivate ${confirmUser?.full_name ?? 'this user'}?`} onConfirm={() => void deleteUser()} onCancel={() => setConfirmUser(null)} />
    </div>
  );
};

export default Admin;
