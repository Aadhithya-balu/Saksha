import React, { useState, useEffect } from 'react';
import { Building2, Plus, Shield, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  getOrganizations,
  createOrganization,
  deleteOrganization,
  getAuthorities,
  type OrganizationRecord,
} from '../../services/api';

export const OrganizationsPanel: React.FC = () => {
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [authorities, setAuthorities] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New org draft
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [authorityType, setAuthorityType] = useState('COURT');
  const [jurisdiction, setJurisdiction] = useState('');
  const [showModal, setShowModal] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [orgsRes, authsRes] = await Promise.all([
        getOrganizations(),
        getAuthorities(),
      ]);
      setOrganizations(orgsRes.results || []);
      setAuthorities(authsRes.length ? authsRes : ['LAW_ENFORCEMENT', 'COURT', 'PROSECUTION', 'FORENSIC', 'ANALYSIS', 'SUPERVISORY', 'ADMINISTRATION', 'OTHER']);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createOrganization({
        name,
        code,
        authority_type: authorityType,
        jurisdiction: jurisdiction || null,
      });
      setSuccess('Organization registered successfully');
      setName('');
      setCode('');
      setJurisdiction('');
      setShowModal(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization');
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this organization?')) return;
    try {
      await deleteOrganization(id);
      setSuccess('Organization status updated');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate organization');
    }
  };

  return (
    <div className="space-y-4 text-left">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-400" />
            Registered Agencies & Judicial Authorities
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Manage multi-authority organizations across Law Enforcement, Courts, Forensics, and Prosecution.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-semibold hover:bg-indigo-500/30 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Register Organization
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-xs text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Organizations Table */}
      <div className="overflow-auto rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)]/25">
        <table className="w-full text-left text-xs">
          <thead className="bg-[var(--bg-primary)] text-[var(--text-muted)] uppercase tracking-wider font-mono text-[10px]">
            <tr>
              <th className="p-3">Organization Name</th>
              <th className="p-3">Code</th>
              <th className="p-3">Authority Type</th>
              <th className="p-3">Jurisdiction</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-primary)] text-[var(--text-secondary)]">
            {organizations.map((org) => (
              <tr key={org.id} className="hover:bg-[var(--bg-primary)]/40 transition-colors">
                <td className="p-3">
                  <span className="font-bold text-[var(--text-primary)] block">{org.name}</span>
                </td>
                <td className="p-3 font-mono font-semibold text-indigo-300">{org.code}</td>
                <td className="p-3">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
                    <Shield className="w-3 h-3" />
                    {org.authority_type}
                  </span>
                </td>
                <td className="p-3">{org.jurisdiction || 'Statewide'}</td>
                <td className="p-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      org.status === 'active'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/30'
                    }`}
                  >
                    {org.status}
                  </span>
                </td>
                <td className="p-3 text-right">
                  {org.status === 'active' ? (
                    <button
                      onClick={() => handleDeactivate(org.id)}
                      className="px-2 py-1 rounded border border-red-500/30 text-red-300 hover:bg-red-500/20 text-[11px]"
                    >
                      Deactivate
                    </button>
                  ) : (
                    <span className="text-zinc-500 text-[11px]">—</span>
                  )}
                </td>
              </tr>
            ))}
            {organizations.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-xs text-[var(--text-muted)] uppercase tracking-wider">
                  No organizations found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">
              Register New Organization
            </h4>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase mb-1">
                  Organization Name
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Karnataka High Court"
                  className="w-full rounded bg-[var(--bg-secondary)] border border-[var(--border-primary)] px-3 py-1.5 text-xs text-[var(--text-primary)]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase mb-1">
                  Agency Code
                </label>
                <input
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. KHC-01"
                  className="w-full rounded bg-[var(--bg-secondary)] border border-[var(--border-primary)] px-3 py-1.5 text-xs font-mono text-[var(--text-primary)]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase mb-1">
                  Authority Type
                </label>
                <select
                  value={authorityType}
                  onChange={(e) => setAuthorityType(e.target.value)}
                  className="w-full rounded bg-[var(--bg-secondary)] border border-[var(--border-primary)] px-3 py-1.5 text-xs text-[var(--text-primary)]"
                >
                  {authorities.map((auth) => (
                    <option key={auth} value={auth}>
                      {auth}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase mb-1">
                  Jurisdiction / District
                </label>
                <input
                  value={jurisdiction}
                  onChange={(e) => setJurisdiction(e.target.value)}
                  placeholder="e.g. Bengaluru Urban or Statewide"
                  className="w-full rounded bg-[var(--bg-secondary)] border border-[var(--border-primary)] px-3 py-1.5 text-xs text-[var(--text-primary)]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 rounded border border-[var(--border-primary)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded bg-indigo-500 text-white font-semibold text-xs hover:bg-indigo-600 transition-colors"
                >
                  Save Organization
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizationsPanel;
