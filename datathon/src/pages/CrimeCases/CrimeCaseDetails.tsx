import React, { useEffect, useState } from 'react';
import {
  getCrimeCase,
  updateCrimeCase,
  addInvestigationNote,
  deleteInvestigationNote,
  linkFIRs,
  getUnassignedOfficers,
  getUnlinkedFIRs
} from '../../services/api';
import type {
  CrimeCaseDetailRecord,
  OfficerWithUserRecord
} from '../../services/api';
import {
  ArrowLeft,
  Calendar,
  User,
  Clock,
  Sparkles,
  Link,
  MessageSquare,
  Plus,
  Trash2,
  AlertTriangle,
  MapPin,
  Tag
} from 'lucide-react';
import { useTranslation } from '../../i18n';

interface CrimeCaseDetailsProps {
  caseId: string;
  onBack: () => void;
  onEdit: () => void;
}

const CrimeCaseDetails: React.FC<CrimeCaseDetailsProps> = ({
  caseId,
  onBack,
  onEdit
}) => {
  const t = useTranslation();
  const [caseData, setCaseData] = useState<CrimeCaseDetailRecord | null>(null);
  const [officers, setOfficers] = useState<OfficerWithUserRecord[]>([]);
  const [unlinkedFirs, setUnlinkedFirs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [noteContent, setNoteContent] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [selectedFirToLink, setSelectedFirToLink] = useState('');
  const [linking, setLinking] = useState(false);

  const formatCaseDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  const fetchDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCrimeCase(caseId);
      setCaseData(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load case details');
    } finally {
      setLoading(false);
    }
  };

  const loadDropdowns = async () => {
    try {
      const [officersList, firsList] = await Promise.all([
        getUnassignedOfficers(),
        getUnlinkedFIRs()
      ]);
      setOfficers(officersList);
      setUnlinkedFirs(firsList.filter(f => f.crime_case_id !== caseId));
    } catch (err) {
      console.error('Failed loading dropdowns:', err);
    }
  };

  useEffect(() => {
    fetchDetails();
    loadDropdowns();
  }, [caseId]);

  const handleUpdateStatus = async (status: string) => {
    if (!caseData) return;
    try {
      const updated = await updateCrimeCase(caseId, { status });
      setCaseData({ ...caseData, status: updated.status });
      fetchDetails();
    } catch (err: any) {
      alert(err?.message || 'Failed to update status');
    }
  };

  const handleUpdatePriority = async (priority: string) => {
    if (!caseData) return;
    try {
      await updateCrimeCase(caseId, { priority } as any);
      setCaseData({ ...caseData, priority });
      fetchDetails();
    } catch (err: any) {
      alert(err?.message || 'Failed to update priority');
    }
  };

  const handleUpdateProgress = async (progress: number) => {
    if (!caseData) return;
    try {
      await updateCrimeCase(caseId, { progress } as any);
      setCaseData({ ...caseData, progress });
      fetchDetails();
    } catch (err: any) {
      alert(err?.message || 'Failed to update progress');
    }
  };

  const handleAssignOfficer = async (officerId: string) => {
    if (!caseData) return;
    try {
      await updateCrimeCase(caseId, { assigned_officer_id: officerId || null } as any);
      fetchDetails();
      loadDropdowns();
    } catch (err: any) {
      alert(err?.message || 'Failed to assign officer');
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim() || !caseData) return;
    setAddingNote(true);
    try {
      await addInvestigationNote(caseId, noteContent);
      setNoteContent('');
      fetchDetails();
    } catch (err: any) {
      alert(err?.message || 'Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm('Delete this investigation note?')) return;
    try {
      await deleteInvestigationNote(caseId, noteId);
      fetchDetails();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete note');
    }
  };

  const handleLinkFir = async () => {
    if (!selectedFirToLink || !caseData) return;
    setLinking(true);
    try {
      await linkFIRs(caseId, [selectedFirToLink]);
      setSelectedFirToLink('');
      fetchDetails();
      loadDropdowns();
    } catch (err: any) {
      alert(err?.message || 'Failed to link FIR');
    } finally {
      setLinking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#1E6FD9] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="p-5 border border-[#C94A2A]/20 bg-[#C94A2A]/5 text-[#C94A2A] rounded-card text-xs flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error || 'Case not found'}</span>
        </div>
        <button onClick={onBack} className="flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] uppercase font-bold text-[10px]">
          <ArrowLeft className="w-3.5 h-3.5" /> {t.cc_back}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top controls header */}
      <div className="flex justify-between items-center pb-4 border-b border-border-color">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer text-xs uppercase font-bold"
        >
          <ArrowLeft className="w-4 h-4" /> {t.cc_back}
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('open-ai-assistant', {
                detail: { query: `Tell me about case ${caseData.case_number}. What is the status, priority, and key details?` }
              }));
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1E6FD9]/15 border border-[#1E6FD9]/30 hover:bg-[#1E6FD9]/25 hover:border-[#1E6FD9]/50 rounded font-mono text-[10px] uppercase text-[#1E6FD9] transition-all cursor-pointer"
          >
            <Sparkles className="w-3 h-3" /> Ask AI
          </button>
          <button
            onClick={onEdit}
            className="px-4 py-1.5 border border-border-color hover:border-[#1E6FD9]/40 hover:bg-[#1E6FD9]/10 rounded font-mono text-xs uppercase text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
          >
            Modify Dossier
          </button>
        </div>
      </div>

      {/* Case Overview Panel */}
      <div className="p-6 bg-secondary-bg border border-border-color rounded-card shadow-glow-blue/5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="text-[10px] text-[#0E9E78] font-bold tracking-[0.15em] uppercase">SAKSHA CRIME INCIDENT RECORDS</span>
            <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)] uppercase tracking-wider mt-1">{caseData.case_number}</h1>
            {caseData.category?.name && (
              <span className="inline-block mt-2 px-2 py-0.5 rounded bg-[var(--bg-tertiary)] border border-border-color text-[9px] text-[var(--text-secondary)] uppercase">
                CATEGORY: {caseData.category.name}{caseData.category.section_code ? ` (${caseData.category.section_code})` : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Status Select */}
            <div className="flex flex-col gap-1">
              <span className="text-[8px] text-[var(--text-muted)] uppercase">Clearance Status</span>
              <select
                value={caseData.status}
                onChange={(e) => handleUpdateStatus(e.target.value)}
                className="px-3 py-1.5 bg-[var(--bg-tertiary)] border border-border-color rounded text-xs font-mono font-bold text-[var(--text-primary)] cursor-pointer focus:border-[#1E6FD9]/60 focus:outline-none"
              >
                <option value="open">OPEN</option>
                <option value="assigned">ASSIGNED</option>
                <option value="investigating">INVESTIGATING</option>
                <option value="evidence collected">EVIDENCE COLLECTED</option>
                <option value="charge sheet filed">CHARGE SHEET FILED</option>
                <option value="closed">CLOSED</option>
              </select>
            </div>

            {/* Priority Select */}
            <div className="flex flex-col gap-1">
              <span className="text-[8px] text-[var(--text-muted)] uppercase">Threat Priority</span>
              <select
                value={caseData.priority}
                onChange={(e) => handleUpdatePriority(e.target.value)}
                className="px-3 py-1.5 bg-[var(--bg-tertiary)] border border-border-color rounded text-xs font-mono font-bold text-[var(--text-primary)] cursor-pointer focus:border-[#1E6FD9]/60 focus:outline-none"
              >
                <option value="low">LOW</option>
                <option value="medium">MEDIUM</option>
                <option value="high">HIGH</option>
                <option value="critical">CRITICAL</option>
              </select>
            </div>
          </div>
        </div>

        {/* Narrative Description */}
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed border-t border-border-color/60 mt-6 pt-4">
          {caseData.description || 'NO ADDITIONAL STATEMENT OR BRIEFING ENROLLED FOR THIS DOSSIER.'}
        </p>

        {/* District metadata info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-4 border-t border-border-color/30 text-[10px] text-[var(--text-muted)] uppercase">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-[#1E6FD9]" />
            <span>REPORTED: {formatCaseDate(caseData.reported_at)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[#0E9E78]" />
            <span>OCCURRED: {formatCaseDate(caseData.occurred_at)}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-[#C94A2A]" />
            <span>DISTRICT: {caseData.location?.district || '—'} | STATION: {caseData.location?.station || '—'}</span>
          </div>
        </div>
      </div>

      {/* Main split details workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Config panels & FIR links (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Progress Tracker Card */}
          <div className="p-5 bg-secondary-bg border border-border-color rounded-card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs uppercase tracking-wider font-bold text-[var(--text-primary)]">Investigation Progress Bar</h3>
              <span className="text-xs font-bold text-[#0E9E78]">{caseData.progress}% COMPLETE</span>
            </div>
            <div className="h-2.5 bg-[var(--bg-secondary)] rounded-full overflow-hidden border border-[var(--border-primary)]">
              <div
                className="h-full bg-gradient-to-r from-[#1E6FD9] to-[#0E9E78] transition-all duration-500"
                style={{ width: `${caseData.progress}%` }}
              />
            </div>
            {/* Direct controller adjustments */}
            <div className="flex justify-between mt-3 text-[10px] text-[var(--text-muted)]">
              <span>[INITIATED]</span>
              <button onClick={() => handleUpdateProgress(25)} className="hover:text-[var(--text-primary)]">25%</button>
              <button onClick={() => handleUpdateProgress(50)} className="hover:text-[var(--text-primary)]">50%</button>
              <button onClick={() => handleUpdateProgress(75)} className="hover:text-[var(--text-primary)]">75%</button>
              <button onClick={() => handleUpdateProgress(100)} className="hover:text-[var(--text-primary)]">100%</button>
              <span>[RESOLVED]</span>
            </div>
          </div>

          {/* Officer Assignment Panel */}
          <div className="p-5 bg-secondary-bg border border-border-color rounded-card">
            <h3 className="text-xs uppercase tracking-wider font-bold text-[var(--text-primary)] mb-4">Assigned Investigator</h3>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-[#1E6FD9]/10 border border-[#1E6FD9]/20 flex items-center justify-center text-[#1E6FD9]">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[var(--text-primary)] uppercase">
                    {caseData.assigned_officer ? caseData.assigned_officer.full_name : 'NO INVESTIGATING OFFICER ASSIGNED'}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-0.5 uppercase">
                    {caseData.assigned_officer ? `BADGE: ${caseData.assigned_officer.badge_number} | RANK: ${caseData.assigned_officer.rank || 'N/A'}` : 'Clearance allocation pending'}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1 w-full sm:w-60">
                <span className="text-[8px] text-[var(--text-muted)] uppercase">Change Assignee</span>
                <select
                  value={caseData.assigned_officer_id || ''}
                  onChange={(e) => handleAssignOfficer(e.target.value)}
                  className="px-2 py-1.5 bg-[var(--bg-tertiary)] border border-border-color rounded text-[11px] font-mono text-[var(--text-primary)] cursor-pointer focus:border-[#1E6FD9]/60 focus:outline-none"
                >
                  <option value="">[UNASSIGNED]</option>
                  {officers.map((off) => (
                    <option key={off.id} value={off.id}>
                      {off.full_name} ({off.badge_number})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Related FIR Linking */}
          <div className="p-5 bg-secondary-bg border border-border-color rounded-card">
            <div className="flex justify-between items-center mb-4 border-b border-border-color/60 pb-3">
              <h3 className="text-xs uppercase tracking-wider font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Link className="w-4 h-4 text-[#1E6FD9]" /> Linked FIR Records
              </h3>
              <span className="text-[10px] text-[var(--text-muted)] font-bold">{caseData.firs.length} LINKED</span>
            </div>

            {/* List of currently linked FIRs */}
            {caseData.firs.length === 0 ? (
              <p className="text-[10px] text-[var(--text-muted)] py-3 text-center uppercase">NO STATE FIRs CURRENTLY LINKED TO THIS CRIME DOSSIER</p>
            ) : (
              <div className="space-y-3 mb-4 max-h-[220px] overflow-y-auto pr-1">
                {caseData.firs.map((fir) => (
                  <div key={fir.id} className="p-3 bg-[var(--bg-secondary)]/40 border border-border-color/40 rounded flex items-center justify-between text-[11px]">
                    <div>
                      <div className="font-bold text-[var(--text-primary)] uppercase">{fir.fir_number}</div>
                      <div className="text-[9.5px] text-[var(--text-muted)] mt-0.5 uppercase">
                        COMPLAINANT: {fir.complainant_name} | SECTIONS: {fir.sections || 'NONE'}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-[#0E9E78]/10 text-[#0E9E78] text-[8.5px] uppercase font-bold">
                      {fir.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Form to link a new FIR */}
            <div className="flex flex-col sm:flex-row items-end gap-3 pt-3 border-t border-border-color/40">
              <div className="flex-grow w-full">
                <span className="text-[8px] text-[var(--text-muted)] uppercase mb-1 block">Link Additional FIR</span>
                <select
                  value={selectedFirToLink}
                  onChange={(e) => setSelectedFirToLink(e.target.value)}
                  className="w-full px-2 py-1.5 bg-[var(--bg-tertiary)] border border-border-color rounded text-[11px] font-mono text-[var(--text-primary)] cursor-pointer focus:border-[#1E6FD9]/60 focus:outline-none"
                >
                  <option value="">[SELECT FIR RECORD]</option>
                  {unlinkedFirs.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.fir_number} ({f.complainant_name})
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleLinkFir}
                disabled={!selectedFirToLink || linking}
                className="px-4 py-1.5 bg-[#1E6FD9] hover:bg-[#1E6FD9]/80 disabled:opacity-50 text-[var(--text-primary)] rounded text-[10px] uppercase font-bold shrink-0 cursor-pointer h-[30px]"
              >
                Link FIR
              </button>
            </div>
          </div>

          {/* AI Recommendations */}
          <div className="p-5 bg-secondary-bg border border-border-color rounded-card shadow-glow-blue/5 relative overflow-hidden">
            {/* Absolute watermark logo */}
            <div className="absolute right-[-10px] bottom-[-10px] text-[#1E6FD9]/5 rotate-[15deg]">
              <Sparkles className="w-24 h-24" />
            </div>

            <h3 className="text-xs uppercase tracking-wider font-bold text-[var(--text-primary)] flex items-center gap-2 mb-4 border-b border-border-color/60 pb-3">
              <Sparkles className="w-4 h-4 text-[#1E6FD9] animate-pulse" /> SAKSHA AI Predictive Assistance
            </h3>

            {caseData.ai_recommendations.length === 0 ? (
              <p className="text-[10px] text-[var(--text-muted)] uppercase text-center py-2">NO AI ASSISTANCE INSIGHTS GENERATED FOR THE CURRENT CLEARANCE STAGE.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {caseData.ai_recommendations.map((rec, i) => (
                  <div key={i} className="p-3 bg-[var(--bg-secondary)]/40 border border-[#1E6FD9]/15 hover:border-[#1E6FD9]/30 rounded flex gap-2.5 transition-colors">
                    <div className="p-1 bg-[#1E6FD9]/10 rounded text-[#1E6FD9] shrink-0 h-fit mt-0.5">
                      <Tag className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-[10.5px] font-bold text-[var(--text-primary)] uppercase">{rec.title}</div>
                      <div className="text-[9.5px] text-[var(--text-secondary)] leading-relaxed mt-1">
                        {rec.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Timeline & Notes (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Investigation Notes Panel */}
          <div className="p-5 bg-secondary-bg border border-border-color rounded-card">
            <h3 className="text-xs uppercase tracking-wider font-bold text-[var(--text-primary)] flex items-center gap-2 mb-4 border-b border-border-color/60 pb-3">
              <MessageSquare className="w-4 h-4 text-[#0E9E78]" /> Case Briefings & Notes
            </h3>

            {/* Note listing */}
            {caseData.notes.length === 0 ? (
              <p className="text-[10px] text-[var(--text-muted)] py-6 text-center uppercase">NO INVESTIGATION NOTES SUBMITTED ON THIS CRIME RECORDS BRIEFING YET.</p>
            ) : (
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1 mb-4">
                {caseData.notes.map((note) => (
                  <div key={note.id} className="p-3 bg-[var(--bg-secondary)]/30 border border-border-color/40 rounded flex flex-col gap-2 relative group/note">
                    <div className="flex justify-between items-center text-[9px] text-[var(--text-muted)] border-b border-[var(--border-primary)] pb-1.5">
                      <span className="font-bold text-[var(--text-primary)] uppercase">
                        {note.officer_name} ({note.officer_badge})
                      </span>
                      <span>{new Date(note.created_at).toLocaleDateString()} {new Date(note.created_at).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-[10.5px] text-[var(--text-secondary)] leading-relaxed break-words pr-4">
                      {note.content}
                    </p>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="absolute right-2.5 bottom-2.5 opacity-0 group-hover/note:opacity-100 p-1 hover:bg-[#C94A2A]/10 border border-border-color/40 rounded text-[var(--text-secondary)] hover:text-[#C94A2A] transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Submit Note Form */}
            <form onSubmit={handleAddNote} className="space-y-3 pt-3 border-t border-border-color/40">
              <textarea
                placeholder="TYPE CASE MEMORANDUM NOTE DETAILS HERE..."
                rows={3}
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                className="w-full p-2.5 bg-[var(--bg-tertiary)] border border-border-color rounded font-mono text-[11px] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[#0E9E78]/60 focus:outline-none uppercase resize-none"
              />
              <button
                type="submit"
                disabled={!noteContent.trim() || addingNote}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-[#0E9E78] hover:bg-[#0E9E78]/80 disabled:opacity-50 text-[var(--text-primary)] rounded text-[10px] uppercase font-bold cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" /> Save Investigation Note
              </button>
            </form>
          </div>

          {/* Chronological Timeline */}
          <div className="p-5 bg-secondary-bg border border-border-color rounded-card">
            <h3 className="text-xs uppercase tracking-wider font-bold text-[var(--text-primary)] flex items-center gap-2 mb-4 border-b border-border-color/60 pb-3">
              <Clock className="w-4 h-4 text-purple-400" /> Chronological Log Timeline
            </h3>

            {caseData.timeline.length === 0 ? (
              <p className="text-[10px] text-[var(--text-muted)] py-6 text-center uppercase">NO TELEMETRY WORKFLOW ACTIVITY LOGGED FOR THIS CASE RECORD.</p>
            ) : (
              <div className="relative pl-4 border-l border-border-color/60 space-y-5">
                {caseData.timeline.map((event, i) => (
                  <div key={i} className="relative text-[11px]">
                    {/* Pulsing indicator marker dot */}
                    <div className="absolute left-[-20.5px] top-1.5 w-2 h-2 rounded-full bg-purple-400 border border-[var(--border-primary)]" />
                    
                    <div className="text-[9.5px] text-[var(--text-muted)]">
                      {formatCaseDate(event.timestamp)}
                    </div>
                    <div className="font-bold text-[var(--text-primary)] uppercase mt-0.5">
                      {event.event}
                    </div>
                    {event.actor && (
                      <div className="text-[9px] text-[var(--text-secondary)] mt-0.5">
                        OPERATOR: {event.actor}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CrimeCaseDetails;
