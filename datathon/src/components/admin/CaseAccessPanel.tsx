import React, { useState, useEffect } from 'react';
import { Share2, Plus, Shield, CheckCircle2, AlertCircle, Trash2, Calendar, FileText } from 'lucide-react';
import {
  getCaseAccesses,
  grantCaseAccess,
  revokeCaseAccess,
  getOrganizations,
  type CaseAccessRecord,
  type OrganizationRecord,
} from '../../services/api';

export const CaseAccessPanel: React.FC = () => {
  const [accessRecords, setAccessRecords] = useState<CaseAccessRecord[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [caseId, setCaseId] = useState('');
  const [orgId, setOrgId] = useState('');
  const [accessLevel, setAccessLevel] = useState('READ');
  const [scope, setScope] = useState('FULL_RECORD');
  const [expiresAt, setExpiresAt] = useState('');
  const [notes, setNotes] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [accessRes, orgsRes] = await Promise.all([
        getCaseAccesses(),
        getOrganizations(),
      ]);
      setAccessRecords(accessRes.results || []);
      setOrganizations(orgsRes.results || []);
      if (orgsRes.results?.length && !orgId) {
        setOrgId(orgsRes.results[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load case access grants');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseId.trim() || !orgId) {
      setError('Please provide both Case ID and select an Organization');
      return;
    }
    setError(null);
    try {
      await grantCaseAccess(caseId.trim(), {
        organization_id: orgId,
        access_level: accessLevel,
        scope: scope,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        notes: notes.trim() || null,
      });
      setSuccess('Case access granted successfully');
      setCaseId('');
      setNotes('');
      setExpiresAt('');
      setShowModal(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to grant case access');
    }
  };

  const handleRevoke = async (record: CaseAccessRecord) => {
    if (!confirm(`Revoke case access for ${record.organization_name || record.organization_id}?`)) return;
    setError(null);
    try {
      await revokeCaseAccess(record.case_id, record.id);
      setSuccess('Case access revoked successfully');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke case access');
    }
  };

  return (
    <div className="space-y-4 text-left">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-2">
            <Share2 className="w-4 h-4 text-indigo-400" />
            Cross-Authority Case Sharing & Judicial Delegation
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Audit-logged case delegation between Police Jurisdictions, Judicial Authorities, Courts, and Forensic Labs.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-semibold hover:bg-indigo-500/30 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Grant Case Access
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

      {/* Case Access Table */}
      <div className="overflow-auto rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)]/25">
        <table className="w-full text-left text-xs">
          <thead className="bg-[var(--bg-primary)] text-[var(--text-muted)] uppercase tracking-wider font-mono text-[10px]">
            <tr>
              <th className="p-3">Case</th>
              <th className="p-3">Authority / Organization</th>
              <th className="p-3">Access Level</th>
              <th className="p-3">Scope</th>
              <th className="p-3">Expires</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-primary)] text-[var(--text-secondary)]">
            {accessRecords.map((rec) => (
              <tr key={rec.id} className="hover:bg-[var(--bg-primary)]/40 transition-colors">
                <td className="p-3">
                  <div className="font-semibold text-[var(--text-primary)]">
                    {rec.case_number || 'Case ID'}
                  </div>
                  <div className="text-[10px] font-mono text-[var(--text-muted)] truncate max-w-[140px]">
                    {rec.case_id}
                  </div>
                  {rec.notes && (
                    <div className="text-[10px] text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                      <FileText className="w-3 h-3 text-indigo-400/80" />
                      {rec.notes}
                    </div>
                  )}
                </td>
                <td className="p-3">
                  <div className="font-bold text-[var(--text-primary)]">
                    {rec.organization_name || rec.organization_id}
                  </div>
                  {rec.authority_type && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase text-indigo-300">
                      <Shield className="w-2.5 h-2.5" />
                      {rec.authority_type}
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-500/10 border border-blue-500/30 text-blue-300">
                    {rec.access_level}
                  </span>
                </td>
                <td className="p-3">
                  <span className="text-[11px] font-mono text-[var(--text-secondary)]">
                    {rec.scope}
                  </span>
                </td>
                <td className="p-3 text-[11px] text-[var(--text-muted)]">
                  {rec.expires_at ? (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(rec.expires_at).toLocaleDateString()}
                    </span>
                  ) : (
                    'Indefinite'
                  )}
                </td>
                <td className="p-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      rec.status === 'ACTIVE'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/30'
                    }`}
                  >
                    {rec.status}
                  </span>
                </td>
                <td className="p-3 text-right">
                  {rec.status === 'ACTIVE' ? (
                    <button
                      onClick={() => void handleRevoke(rec)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-500/30 text-red-300 hover:bg-red-500/20 text-[11px]"
                      title="Revoke access"
                    >
                      <Trash2 className="w-3 h-3" /> Revoke
                    </button>
                  ) : (
                    <span className="text-zinc-500 text-[11px]">—</span>
                  )}
                </td>
              </tr>
            ))}
            {accessRecords.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-xs text-[var(--text-muted)] uppercase tracking-wider">
                  No cross-authority case access grants found
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
              Grant Cross-Authority Case Access
            </h4>
            <form onSubmit={handleGrant} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase mb-1">
                  Crime Case ID or UUID
                </label>
                <input
                  required
                  value={caseId}
                  onChange={(e) => setCaseId(e.target.value)}
                  placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                  className="w-full rounded bg-[var(--bg-secondary)] border border-[var(--border-primary)] px-3 py-1.5 text-xs font-mono text-[var(--text-primary)]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase mb-1">
                  Recipient Authority / Organization
                </label>
                <select
                  required
                  value={orgId}
                  onChange={(e) => setOrgId(e.target.value)}
                  className="w-full rounded bg-[var(--bg-secondary)] border border-[var(--border-primary)] px-3 py-1.5 text-xs text-[var(--text-primary)]"
                >
                  <option value="">Select recipient organization...</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.authority_type} - {org.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase mb-1">
                    Access Level
                  </label>
                  <select
                    value={accessLevel}
                    onChange={(e) => setAccessLevel(e.target.value)}
                    className="w-full rounded bg-[var(--bg-secondary)] border border-[var(--border-primary)] px-3 py-1.5 text-xs text-[var(--text-primary)]"
                  >
                    <option value="READ">READ (View Only)</option>
                    <option value="COMMENT">COMMENT (Case Notes)</option>
                    <option value="ADMISSIBILITY_REVIEW">ADMISSIBILITY_REVIEW</option>
                    <option value="FULL">FULL (Full Record)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase mb-1">
                    Scope
                  </label>
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                    className="w-full rounded bg-[var(--bg-secondary)] border border-[var(--border-primary)] px-3 py-1.5 text-xs text-[var(--text-primary)]"
                  >
                    <option value="FULL_RECORD">Full Case Record</option>
                    <option value="EVIDENCE_ONLY">Evidence & Forensics Only</option>
                    <option value="SUMMARY">Dossier Summary Only</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase mb-1">
                  Expiration Date (Optional)
                </label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full rounded bg-[var(--bg-secondary)] border border-[var(--border-primary)] px-3 py-1.5 text-xs text-[var(--text-primary)]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase mb-1">
                  Judicial or Administrative Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Reference court order number, investigation transfer, or forensic request..."
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
                  Grant Access
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CaseAccessPanel;
