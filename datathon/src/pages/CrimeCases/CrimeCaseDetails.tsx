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
  Briefcase,
  Calendar,
  User,
  Clock,
  Sparkles,
  Link,
  MessageSquare,
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
  onBack, // kept for interface compatibility but won't be rendered
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
          [ CLOSE PREVIEW ]
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {/* Top sticky header */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)] sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[var(--bg-elevated)] border border-[var(--border-primary)] rounded-lg flex items-center justify-center text-[var(--text-muted)]">
            <Briefcase className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-[14px] font-bold text-[var(--text-primary)] uppercase tracking-wider leading-none">
              {caseData.case_number}
            </h1>
            <span className="text-[9px] text-[var(--text-muted)] font-mono tracking-widest uppercase mt-1">
              Active Investigation Dossier
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('open-ai-assistant', {
                detail: { query: `Tell me about case ${caseData.case_number}. What is the status, priority, and key details?` }
              }));
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1E6FD9]/10 border border-[#1E6FD9]/30 hover:bg-[#1E6FD9]/20 hover:border-[#1E6FD9]/50 rounded font-mono text-[10px] uppercase text-[#1E6FD9] transition-all cursor-pointer font-bold tracking-wider"
          >
            <Sparkles className="w-3.5 h-3.5" /> AI Analysis
          </button>
          <button
            onClick={onEdit}
            className="px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] hover:border-[#1E6FD9]/40 hover:bg-[#1E6FD9]/10 rounded font-mono text-[10px] uppercase text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer font-bold tracking-wider"
          >
            Modify
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Case Metadata Bar */}
        <div className="flex flex-wrap items-center gap-6 p-4 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl">
          <div className="flex flex-col gap-1 min-w-[120px]">
            <span className="text-[9px] text-[var(--text-muted)] font-mono uppercase tracking-wider">Status</span>
            <select
              value={caseData.status}
              onChange={(e) => handleUpdateStatus(e.target.value)}
              className="bg-transparent border-none p-0 text-[11px] font-bold text-[var(--text-primary)] uppercase cursor-pointer focus:ring-0 focus:outline-none"
            >
              <option value="open">OPEN</option>
              <option value="assigned">ASSIGNED</option>
              <option value="investigating">INVESTIGATING</option>
              <option value="evidence collected">EVIDENCE COLLECTED</option>
              <option value="charge sheet filed">CHARGE SHEET</option>
              <option value="closed">CLOSED</option>
            </select>
          </div>
          
          <div className="w-px h-8 bg-[var(--border-primary)]" />
          
          <div className="flex flex-col gap-1 min-w-[120px]">
            <span className="text-[9px] text-[var(--text-muted)] font-mono uppercase tracking-wider">Priority</span>
            <select
              value={caseData.priority}
              onChange={(e) => handleUpdatePriority(e.target.value)}
              className="bg-transparent border-none p-0 text-[11px] font-bold text-[var(--text-primary)] uppercase cursor-pointer focus:ring-0 focus:outline-none"
            >
              <option value="low">LOW</option>
              <option value="medium">MEDIUM</option>
              <option value="high">HIGH</option>
              <option value="critical">CRITICAL</option>
            </select>
          </div>

          <div className="w-px h-8 bg-[var(--border-primary)] hidden md:block" />

          <div className="flex-1 min-w-[200px] flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-[var(--text-muted)] font-mono uppercase tracking-wider">Investigation Progress</span>
              <span className="text-[10px] font-bold font-mono text-[#0E9E78]">{caseData.progress}%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden border border-[var(--border-primary)]">
                <div
                  className="h-full bg-gradient-to-r from-[#1E6FD9] to-[#0E9E78] transition-all duration-500"
                  style={{ width: `${caseData.progress}%` }}
                />
              </div>
            </div>
            <div className="flex justify-between mt-1 text-[8px] text-[var(--text-muted)] font-mono uppercase">
              <button onClick={() => handleUpdateProgress(25)} className="hover:text-[var(--text-primary)] hover:underline">25%</button>
              <button onClick={() => handleUpdateProgress(50)} className="hover:text-[var(--text-primary)] hover:underline">50%</button>
              <button onClick={() => handleUpdateProgress(75)} className="hover:text-[var(--text-primary)] hover:underline">75%</button>
              <button onClick={() => handleUpdateProgress(100)} className="hover:text-[var(--text-primary)] hover:underline">100%</button>
            </div>
          </div>
        </div>

        {/* Overview & Description */}
        <div className="p-5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl">
          <h3 className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-3">Incident Briefing</h3>
          <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
            {caseData.description || 'NO ADDITIONAL STATEMENT OR BRIEFING ENROLLED FOR THIS DOSSIER.'}
          </p>
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-[var(--border-primary)]/50">
            <div className="flex items-center gap-1.5 text-[9px] font-mono text-[var(--text-muted)] uppercase">
              <Calendar className="w-3.5 h-3.5 text-[#1E6FD9]" />
              REPORTED: <span className="text-[var(--text-secondary)] font-bold">{formatCaseDate(caseData.reported_at)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] font-mono text-[var(--text-muted)] uppercase">
              <Clock className="w-3.5 h-3.5 text-[#0E9E78]" />
              OCCURRED: <span className="text-[var(--text-secondary)] font-bold">{formatCaseDate(caseData.occurred_at)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] font-mono text-[var(--text-muted)] uppercase">
              <MapPin className="w-3.5 h-3.5 text-[#C94A2A]" />
              LOC ID: <span className="text-[var(--text-secondary)] font-bold">{caseData.location_id.substring(0, 8)}</span>
            </div>
          </div>
        </div>

        {/* Grid for main content */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          
          {/* Left Column */}
          <div className="space-y-6">
            {/* Officer Assignment */}
            <div className="p-5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl">
              <h3 className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-[#1E6FD9]" /> Assigned Officer
              </h3>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#1E6FD9]/10 border border-[#1E6FD9]/20 flex items-center justify-center text-[#1E6FD9]">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[12px] font-bold text-[var(--text-primary)] uppercase">
                    {caseData.assigned_officer ? caseData.assigned_officer.full_name : 'UNASSIGNED'}
                  </div>
                  <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">
                    {caseData.assigned_officer ? `Badge: ${caseData.assigned_officer.badge_number}` : 'Clearance Pending'}
                  </div>
                </div>
              </div>
              
              <select
                value={caseData.assigned_officer_id || ''}
                onChange={(e) => handleAssignOfficer(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-[11px] font-mono text-[var(--text-primary)] cursor-pointer focus:border-[#1E6FD9]/60 focus:outline-none transition-colors"
              >
                <option value="">[ REASSIGN OFFICER ]</option>
                {officers.map((off) => (
                  <option key={off.id} value={off.id}>
                    {off.full_name} ({off.badge_number})
                  </option>
                ))}
              </select>
            </div>

            {/* AI Recommendations */}
            <div className="p-5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl relative overflow-hidden">
              <div className="absolute -right-4 -bottom-4 text-[#1E6FD9]/5">
                <Sparkles className="w-24 h-24" />
              </div>
              
              <h3 className="text-[10px] font-mono text-[#1E6FD9] uppercase tracking-wider mb-4 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" /> AI Analysis & Directives
              </h3>
              
              {caseData.ai_recommendations.length === 0 ? (
                <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase py-4">No AI directives generated.</p>
              ) : (
                <div className="space-y-3 relative z-10">
                  {caseData.ai_recommendations.map((rec, i) => (
                    <div key={i} className="p-3 bg-[#1E6FD9]/5 border border-[#1E6FD9]/20 rounded-lg flex gap-3">
                      <div className="mt-0.5 text-[#1E6FD9]">
                        <Tag className="w-3 h-3" />
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-[var(--text-primary)] uppercase">{rec.title}</div>
                        <div className="text-[10px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                          {rec.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* FIR Linking */}
            <div className="p-5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl">
              <h3 className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
                <Link className="w-3.5 h-3.5 text-[#0E9E78]" /> Associated FIRs
              </h3>
              
              {caseData.firs.length === 0 ? (
                <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase py-2">No FIRs Linked</p>
              ) : (
                <div className="space-y-2 mb-4">
                  {caseData.firs.map((fir) => (
                    <button 
                      key={fir.id} 
                      onClick={() => {
                        sessionStorage.setItem('selected_entity_id', fir.id);
                        window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab: 'fir', targetId: fir.id } }));
                      }}
                      className="w-full text-left p-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] hover:border-[#0E9E78]/50 hover:bg-[#0E9E78]/5 rounded-lg flex items-center justify-between transition-colors cursor-pointer group"
                    >
                      <div>
                        <div className="text-[11px] font-bold text-[var(--text-primary)] uppercase group-hover:text-[#0E9E78] transition-colors">{fir.fir_number}</div>
                        <div className="text-[9px] font-mono text-[var(--text-muted)] mt-0.5 uppercase">
                          {fir.sections || 'UNKNOWN SECTION'}
                        </div>
                      </div>
                      <span className="px-1.5 py-0.5 bg-[#0E9E78]/10 text-[#0E9E78] border border-[#0E9E78]/20 rounded text-[9px] font-mono font-bold uppercase">
                        {fir.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-3 border-t border-[var(--border-primary)]/50 mt-2">
                <select
                  value={selectedFirToLink}
                  onChange={(e) => setSelectedFirToLink(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-[10px] font-mono text-[var(--text-primary)] cursor-pointer focus:border-[#1E6FD9]/60 focus:outline-none"
                >
                  <option value="">[ LINK FIR RECORD ]</option>
                  {unlinkedFirs.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.fir_number}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleLinkFir}
                  disabled={!selectedFirToLink || linking}
                  className="px-3 py-1.5 bg-[#1E6FD9]/10 hover:bg-[#1E6FD9]/20 border border-[#1E6FD9]/30 disabled:opacity-50 text-[#1E6FD9] rounded-lg text-[10px] font-mono uppercase font-bold transition-colors cursor-pointer"
                >
                  Link
                </button>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6 flex flex-col h-full">
            {/* Investigation Notes */}
            <div className="p-5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl flex flex-col min-h-[300px]">
              <h3 className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-[#C94A2A]" /> Briefings & Notes
              </h3>
              
              <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1 min-h-[150px]">
                {caseData.notes.length === 0 ? (
                  <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase text-center py-8">No briefings submitted.</p>
                ) : (
                  caseData.notes.map((note) => (
                    <div key={note.id} className="p-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg relative group/note">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold text-[var(--text-primary)] uppercase">
                          {note.officer_name}
                        </span>
                        <span className="text-[8px] font-mono text-[var(--text-muted)]">
                          {formatCaseDate(note.created_at)}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                        {note.content}
                      </p>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="absolute right-2 top-2 p-1 rounded hover:bg-[#C94A2A]/10 text-[var(--text-muted)] hover:text-[#C94A2A] opacity-0 group-hover/note:opacity-100 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
              
              <form onSubmit={handleAddNote} className="mt-auto shrink-0 space-y-2">
                <textarea
                  placeholder="ADD MEMORANDUM..."
                  rows={2}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  className="w-full p-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-[11px] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[#1E6FD9]/60 focus:outline-none resize-none transition-colors"
                />
                <button
                  type="submit"
                  disabled={!noteContent.trim() || addingNote}
                  className="w-full py-2 bg-[var(--bg-elevated)] border border-[var(--border-primary)] hover:border-[#1E6FD9]/50 hover:bg-[#1E6FD9]/10 disabled:opacity-50 text-[var(--text-primary)] rounded-lg text-[10px] font-mono uppercase font-bold transition-all cursor-pointer"
                >
                  Save Note
                </button>
              </form>
            </div>

            {/* Timeline */}
            <div className="p-5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl flex-1 min-h-[250px]">
              <h3 className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-5 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-purple-400" /> Event Timeline
              </h3>
              
              {caseData.timeline.length === 0 ? (
                <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase">No telemetry logged.</p>
              ) : (
                <div className="relative pl-3 border-l border-[var(--border-primary)] space-y-4">
                  {caseData.timeline.map((event, i) => (
                    <div key={i} className="relative">
                      <div className="absolute -left-[16.5px] top-1.5 w-2 h-2 rounded-full bg-[var(--bg-secondary)] border-2 border-purple-400" />
                      <div className="text-[8px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
                        {formatCaseDate(event.timestamp)}
                      </div>
                      <div className="text-[11px] font-bold text-[var(--text-primary)] uppercase mt-0.5">
                        {event.event}
                      </div>
                      {event.actor && (
                        <div className="text-[9px] font-mono text-[var(--text-secondary)] mt-0.5">
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
    </div>
  );
};

export default CrimeCaseDetails;
