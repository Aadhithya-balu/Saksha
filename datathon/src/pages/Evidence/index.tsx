import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRBAC } from '../../hooks/useRBAC';
import { Search, Plus, Filter, HardDrive, FileText, UploadCloud, Cpu, Download, Sparkles, Send, ExternalLink } from 'lucide-react';
import { apiRequest, chatQueryStream } from '../../services/api';
import { CardSkeleton } from '../../components/ui/Skeleton';
import PageHeader from '../../components/ui/PageHeader';
import { MarkdownRenderer } from '../../components/chat/MarkdownRenderer';

interface Evidence {
  id: string;
  case_id: string;
  title: string;
  description: string;
  evidence_type: string;
  status: string;
  storage_path: string | null;
  created_at: string;
}

const EVIDENCE_STATUS_TONE: Record<string, { color: string; background: string }> = {
  ['Analyzed']: { color: 'var(--accent-teal-light)', background: 'var(--accent-teal-subtle)' },
  ['Pending']: { color: 'var(--accent-amber-light)', background: 'var(--accent-amber-subtle)' },
  ['Assigned']: { color: 'var(--accent-cyan-light)', background: 'var(--accent-cyan-subtle)' },
  ['Under Analysis']: { color: 'var(--accent-purple-light)', background: 'var(--accent-purple-subtle)' },
  ['Assignment Rejected']: { color: 'var(--accent-coral-light)', background: 'var(--accent-coral-subtle)' },
  ['Returned']: { color: 'var(--text-secondary)', background: 'var(--bg-tertiary)' },
};

const EvidencePage: React.FC = () => {
  const { isSCRB, isInspector, isIO, isForensic, isAdmin } = useRBAC();
  // canWrite: roles allowed to create/edit evidence (admin, investigator, inspector, crime_analyst)
  const canWrite = isAdmin || isSCRB || isIO || isInspector;
  // canUpload: roles allowed to upload files (admin, investigator, forensic, crime_analyst)
  const canUpload = isAdmin || isSCRB || isIO || isForensic;
  // canAssign: roles allowed to assign evidence (admin, investigator, inspector, crime_analyst)
  const canAssign = isAdmin || isSCRB || isIO || isInspector;
  // canSummary: roles allowed to generate AI summary (admin, investigator, inspector, forensic, crime_analyst)
  const canSummary = isAdmin || isSCRB || isIO || isInspector || isForensic;
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cases, setCases] = useState<any[]>([]);
  
  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [currentEvidence, setCurrentEvidence] = useState<Partial<Evidence>>({
    title: '', description: '', evidence_type: 'Digital', case_id: ''
  });
  const [evidenceDetail, setEvidenceDetail] = useState<any>(null);
  const [assigneeId, setAssigneeId] = useState('');

  // Inline AI Chat state
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiChatInput, setAiChatInput] = useState('');
  const [aiChatMessages, setAiChatMessages] = useState<Array<{ id: string; sender: 'user' | 'ai'; text: string }>>([]);
  const [aiChatLoading, setAiChatLoading] = useState(false);
  const [aiChatStatus, setAiChatStatus] = useState('');
  const aiChatEndRef = useRef<HTMLDivElement>(null);

  const scrollToAiChatBottom = useCallback(() => {
    aiChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToAiChatBottom();
  }, [aiChatMessages, scrollToAiChatBottom]);

  const sendAiChatMessage = useCallback(async (text?: string) => {
    const msg = text || aiChatInput;
    if (!msg.trim() || aiChatLoading) return;

    const userMsg = { id: `u-${Date.now()}`, sender: 'user' as const, text: msg };
    setAiChatMessages(prev => [...prev, userMsg]);
    setAiChatInput('');
    setAiChatLoading(true);
    setAiChatStatus('Analyzing evidence...');

    const aiMsgId = `a-${Date.now()}`;
    let acc = '';
    let finalData: any = null;

    try {
      for await (const chunk of chatQueryStream(msg)) {
        if (chunk.type === 'status') {
          setAiChatStatus(chunk.content);
        } else if (chunk.type === 'token') {
          acc += chunk.content;
          const current = acc;
          setAiChatMessages(prev => {
            const existing = prev.find(m => m.id === aiMsgId);
            if (existing) {
              return prev.map(m => m.id === aiMsgId ? { ...m, text: current } : m);
            }
            return [...prev, { id: aiMsgId, sender: 'ai' as const, text: current }];
          });
        } else if (chunk.type === 'final') {
          finalData = chunk.content;
        }
      }

      const finalAnswer = finalData?.answer || acc;
      setAiChatMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: finalAnswer } : m));
    } catch (e: any) {
      const errText = e?.message || 'Failed to get AI response. Ensure backend is running.';
      setAiChatMessages(prev => {
        const existing = prev.find(m => m.id === aiMsgId);
        if (existing) {
          return prev.map(m => m.id === aiMsgId ? { ...m, text: `**Error:** ${errText}` } : m);
        }
        return [...prev, { id: aiMsgId, sender: 'ai' as const, text: `**Error:** ${errText}` }];
      });
    } finally {
      setAiChatLoading(false);
      setAiChatStatus('');
    }
  }, [aiChatInput, aiChatLoading]);

  const fetchEvidence = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const data = await apiRequest<{ results: Evidence[] }>(`/evidence?${params.toString()}`);
      setEvidenceList(data.results || []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch evidence');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchEvidence();
  }, [search, statusFilter]);

  useEffect(() => {
    const fetchCases = async () => {
      try {
        const data = await apiRequest<{ results: any[] }>(`/crime-cases?page_size=100`);
        setCases(data.results || []);
      } catch (e) {
        console.error(e);
      }
    };
    void fetchCases();
  }, []);

  const handleCreate = async () => {
    if (!currentEvidence.case_id?.trim() || !currentEvidence.title?.trim() || !currentEvidence.evidence_type?.trim()) {
      setError('Case ID, title, and evidence type are required.');
      return;
    }

    try {
      // Normalize optional fields
      const payload = { ...currentEvidence };
      Object.keys(payload).forEach(key => {
        if (payload[key as keyof typeof payload] === '') {
          payload[key as keyof typeof payload] = null;
        }
      });
      
      await apiRequest(`/evidence`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      setIsFormOpen(false);
      setError(null);
      void fetchEvidence();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create evidence');
    }
  };

  const handleUpload = async (id: string, file: File) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      await apiRequest(`/evidence/${id}/upload`, {
        method: 'POST',
        body: formData
      });
      
      setError(null);
      void openDetail(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to upload file');
    }
  };

  const downloadFile = async (id: string) => {
    try {
      // apiRequest assumes JSON response, so we still use fetch for blob download
      const { accessToken, API_BASE_URL } = await import('../../services/api').then(m => ({ 
        accessToken: m.getStoredTokens().accessToken, 
        API_BASE_URL: m.API_BASE_URL 
      }));
      const res = await fetch(`${API_BASE_URL}/evidence/${id}/download`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
      });
      if (!res.ok) {
        let msg = res.statusText;
        try { const d = await res.json(); msg = d.detail || d.message || msg; } catch { /* non-JSON error body */ }
        throw new Error(msg || 'Failed to download file');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] ?? `evidence-${id}`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to download file');
    }
  };

  const generateAISummary = async (id: string) => {
    try {
      await apiRequest(`/evidence/${id}/summary`, { method: 'POST' });
      setError(null);
      void openDetail(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate AI summary');
    }
  };

  const assignEvidence = async (evidenceId: string) => {
    if (!assigneeId.trim()) {
      setError('Enter an officer badge number, name, or user UUID.');
      return;
    }

    try {
      await apiRequest(`/evidence/${evidenceId}/assign?assigned_to=${encodeURIComponent(assigneeId.trim())}`, {
        method: 'POST'
      });
      setAssigneeId('');
      setError(null);
      void openDetail(evidenceId);
      void fetchEvidence();
    } catch(e) {
      setError(e instanceof Error ? e.message : 'Failed to assign evidence');
    }
  };

  const handleAssignmentAction = async (evidenceId: string, assignmentId: string, action: 'accept' | 'complete' | 'return' | 'reject') => {
    try {
      await apiRequest(`/evidence/${evidenceId}/assignments/${assignmentId}/${action}`, {
        method: 'POST'
      });
      setError(null);
      void openDetail(evidenceId);
      void fetchEvidence();
    } catch(e) {
      setError(e instanceof Error ? e.message : 'Failed to update assignment');
    }
  };

  const openDetail = async (id: string) => {
    try {
      const data = await apiRequest(`/evidence/${id}`);
      setEvidenceDetail(data);
      setIsDetailOpen(true);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open evidence');
    }
  };

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header — plain-language, effortless scan */}
      <PageHeader
        title="Evidence Files"
        subtitle="Case exhibits, chain of custody, and analysis results."
        icon={<HardDrive className="w-5 h-5" />}
        actions={
          <>
            <div className="relative">
              <input
                type="text"
                placeholder="Search evidence…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="sk-input w-56 pl-9 pr-3 py-1.5"
              />
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="sk-select appearance-none w-44 px-3 py-1.5 pr-8 cursor-pointer"
              >
                <option value="">All statuses</option>
                <option value="Pending">Pending</option>
                <option value="Assigned">Assigned</option>
                <option value="Under Analysis">Under analysis</option>
                <option value="Analyzed">Analysed</option>
                <option value="Returned">Returned</option>
                <option value="Assignment Rejected">Rejected</option>
              </select>
              <Filter className="w-3.5 h-3.5 text-[var(--text-muted)] absolute right-3 top-2.5 pointer-events-none" />
            </div>
            {canWrite && (
              <button
                onClick={() => {
                  setCurrentEvidence({ title: '', description: '', evidence_type: 'Digital', case_id: '' });
                  setIsFormOpen(true);
                }}
                className="sk-btn cursor-pointer"
                style={{ background: 'var(--accent-coral)', borderColor: 'var(--accent-coral)', color: '#fff' }}
              >
                <Plus className="w-4 h-4" /> Log Evidence
              </button>
            )}
          </>
        }
      />

      {error && (
        <div className="px-4 py-3 bg-[#C94A2A]/10 border border-[#C94A2A]/30 rounded text-[var(--accent-coral)] text-xs font-mono">
          {error}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {evidenceList.map((item) => (
              <div 
                key={item.id} 
                onClick={() => openDetail(item.id)}
                className="bg-secondary-bg border border-border-color rounded-lg p-5 flex flex-col gap-4 hover:border-[#C94A2A]/50 transition-colors cursor-pointer group overflow-hidden"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-[#C94A2A]/20 flex items-center justify-center text-[#C94A2A] border border-[#C94A2A]/40 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="overflow-hidden">
                      <h3 className="text-[var(--text-primary)] font-bold text-sm truncate" title={item.title}>{item.title}</h3>
                      <p className="text-[var(--text-muted)] font-mono text-[10px] uppercase font-bold tracking-wider">{item.evidence_type}</p>
                    </div>
                  </div>
                </div>
                
                <p className="text-xs text-[var(--text-secondary)] line-clamp-2 break-words" title={item.description}>{item.description}</p>
                
                <div className="mt-auto pt-4 border-t border-border-color flex justify-between items-center">
                  <span
                    className="sk-chip px-2 py-0.5"
                    style={EVIDENCE_STATUS_TONE[item.status] || { color: 'var(--text-secondary)', background: 'var(--bg-tertiary)' }}
                  >
                    {item.status}
                  </span>
                  {item.storage_path && (
                    <span title="File Attached" className="inline-flex">
                      <HardDrive className="w-4 h-4 text-[#1E6FD9]" />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-[var(--bg-surface)]/80 flex items-center justify-center p-4">
          <div className="bg-secondary-bg border border-[#C94A2A]/40 rounded-lg shadow-glow-orange max-w-md w-full p-6 animate-[fadeIn_0.2s_ease-out]">
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4 uppercase font-mono">Log New Evidence</h2>
            
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Case</label>
                {cases.length > 0 ? (
                  <select 
                    value={currentEvidence.case_id} 
                    onChange={e => setCurrentEvidence({...currentEvidence, case_id: e.target.value})} 
                    className="bg-[var(--bg-surface)] border border-border-color rounded px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[#C94A2A] outline-none"
                  >
                    <option value="">Select a Case...</option>
                    {cases.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.case_number} - {c.description ? (c.description.length > 40 ? `${c.description.slice(0, 40)}...` : c.description) : 'No description'}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input type="text" value={currentEvidence.case_id} onChange={e => setCurrentEvidence({...currentEvidence, case_id: e.target.value})} className="bg-[var(--bg-surface)] border border-border-color rounded px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[#C94A2A] outline-none" placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000" />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Title</label>
                <input type="text" value={currentEvidence.title} onChange={e => setCurrentEvidence({...currentEvidence, title: e.target.value})} className="bg-[var(--bg-surface)] border border-border-color rounded px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[#C94A2A] outline-none" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Description</label>
                <textarea value={currentEvidence.description} onChange={e => setCurrentEvidence({...currentEvidence, description: e.target.value})} className="bg-[var(--bg-surface)] border border-border-color rounded px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[#C94A2A] outline-none min-h-[80px]" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Evidence Type</label>
                <select value={currentEvidence.evidence_type} onChange={e => setCurrentEvidence({...currentEvidence, evidence_type: e.target.value})} className="bg-[var(--bg-surface)] border border-border-color rounded px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[#C94A2A] outline-none">
                  <option value="Digital">Digital (CCTV, Mobile, PC)</option>
                  <option value="Physical">Physical</option>
                  <option value="Biological">Biological</option>
                  <option value="Document">Documentary</option>
                </select>
              </div>
            </div>
            
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsFormOpen(false)} className="px-4 py-2 border border-border-color rounded text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/10 transition-colors font-mono">Cancel</button>
              <button onClick={handleCreate} className="px-4 py-2 bg-[#C94A2A] hover:bg-[#A83D22] rounded text-sm text-[var(--text-primary)] font-bold transition-colors font-mono">Save Evidence</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {isDetailOpen && evidenceDetail && (() => {
        const statusColors: Record<string, { bg: string; text: string; border: string }> = {
          'Analyzed': { bg: 'bg-emerald-950/40', text: 'text-emerald-400', border: 'border-emerald-900/40' },
          'Under Analysis': { bg: 'bg-blue-950/40', text: 'text-blue-400', border: 'border-blue-900/40' },
          'Assigned': { bg: 'bg-amber-950/40', text: 'text-amber-400', border: 'border-amber-900/40' },
          'Pending': { bg: 'bg-slate-950/40', text: 'text-slate-400', border: 'border-slate-900/40' },
          'Returned': { bg: 'bg-purple-950/40', text: 'text-purple-400', border: 'border-purple-900/40' },
          'Assignment Rejected': { bg: 'bg-red-950/40', text: 'text-red-400', border: 'border-red-900/40' },
        };
        const sc = statusColors[evidenceDetail.status] || statusColors['Pending'];
        const typeIcons: Record<string, string> = { Digital: '💻', Physical: '📦', Biological: '🧬', Document: '📄' };
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6" style={{ zIndex: 500 }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsDetailOpen(false)} />
          <div className="relative w-full max-w-5xl h-[92vh] bg-[var(--bg-elevated)] border border-[var(--border-primary)] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-[fadeIn_0.2s_ease-out]">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-[var(--border-secondary)] flex items-start justify-between gap-4 shrink-0" style={{ borderLeftWidth: 4, borderLeftColor: '#C94A2A' }}>
              <div className="min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-2xl">{typeIcons[evidenceDetail.evidence_type] || '📁'}</span>
                  <div className="min-w-0">
                    <h2 className="text-base md:text-lg font-extrabold text-[var(--text-primary)] font-mono uppercase tracking-wider truncate" title={evidenceDetail.title}>{evidenceDetail.title}</h2>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase border ${sc.bg} ${sc.text} ${sc.border}`}>{evidenceDetail.status}</span>
                      <span className="px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase bg-[#C94A2A]/10 text-[#C94A2A] border border-[#C94A2A]/20">{evidenceDetail.evidence_type}</span>
                      <span className="text-[8.5px] font-mono text-[var(--text-muted)]">ID: {evidenceDetail.id}</span>
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsDetailOpen(false)} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors shrink-0 text-xs font-mono">
                ✕ CLOSE
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Column (2/3) */}
                <div className="lg:col-span-2 space-y-5 min-w-0">
                  
                  {/* Description */}
                  <div className="p-5 bg-[var(--bg-secondary)]/40 border border-[var(--border-primary)] rounded-lg">
                    <h3 className="text-[9px] text-[var(--text-muted)] uppercase font-bold tracking-[0.15em] mb-3 font-mono">Description</h3>
                    <p className="text-[var(--text-primary)] text-sm leading-relaxed break-words">{evidenceDetail.description}</p>
                  </div>

                  {/* Case & Metadata Grid */}
                  <div className="p-5 bg-[var(--bg-secondary)]/40 border border-[var(--border-primary)] rounded-lg">
                    <h3 className="text-[9px] text-[var(--text-muted)] uppercase font-bold tracking-[0.15em] mb-4 font-mono border-b border-[var(--border-muted)] pb-3">Case Information</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[10px] text-[var(--text-muted)] uppercase">
                      <div className="min-w-0">
                        <span className="block mb-1">Case Reference</span>
                        <span className="text-[var(--text-primary)] font-bold block mt-0.5 break-all font-mono text-[10px] normal-case">{evidenceDetail.case_id}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="block mb-1">Evidence Type</span>
                        <span className="text-[var(--text-primary)] font-bold block mt-0.5">{evidenceDetail.evidence_type}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="block mb-1">Created</span>
                        <span className="text-[var(--text-primary)] font-bold block mt-0.5">{new Date(evidenceDetail.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Digital Asset */}
                  <div className="p-5 bg-[var(--bg-secondary)]/40 border border-[var(--border-primary)] rounded-lg relative overflow-hidden">
                    <div className="absolute right-[-10px] bottom-[-10px] text-[#1E6FD9]/5 rotate-[15deg]"><HardDrive className="w-24 h-24" /></div>
                    <div className="flex items-center justify-between mb-4 border-b border-[var(--border-muted)] pb-3 relative z-10">
                      <h3 className="text-[9px] text-[var(--text-muted)] uppercase font-bold tracking-[0.15em] font-mono flex items-center gap-2">
                        <HardDrive className="w-3 h-3 text-[#1E6FD9]" /> Digital Asset & Metadata
                      </h3>
                      <div className="flex gap-2 shrink-0">
                        {evidenceDetail.metadata && (
                          <button onClick={() => void downloadFile(evidenceDetail.id)} className="flex items-center gap-1 text-[9px] bg-[#1E6FD9]/15 border border-[#1E6FD9]/30 text-[#1E6FD9] px-2.5 py-1 rounded hover:bg-[#1E6FD9]/25 hover:border-[#1E6FD9]/50 transition-all font-mono uppercase font-bold">
                            <Download className="w-3 h-3" /> Download
                          </button>
                        )}
                        {canUpload && (
                          <label className="cursor-pointer flex items-center gap-1 text-[9px] bg-[#C94A2A]/10 border border-[#C94A2A]/20 text-[#C94A2A] px-2.5 py-1 rounded hover:bg-[#C94A2A]/20 hover:border-[#C94A2A]/40 transition-all font-mono uppercase font-bold">
                            <UploadCloud className="w-3 h-3" /> Upload
                            <input type="file" className="hidden" onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                void handleUpload(evidenceDetail.id, e.target.files[0]);
                              }
                            }} />
                          </label>
                        )}
                      </div>
                    </div>
                    {evidenceDetail.metadata ? (
                      <div className="space-y-3 relative z-10">
                        <div className="grid grid-cols-2 gap-4 text-[10px]">
                          <div className="p-3 bg-[var(--bg-secondary)]/70 border border-[var(--border-primary)] rounded min-w-0">
                            <span className="text-[var(--text-muted)] uppercase block mb-1 font-bold">Filename</span>
                            <span className="text-[var(--text-primary)] font-bold block break-words">{evidenceDetail.metadata.filename}</span>
                          </div>
                          <div className="p-3 bg-[var(--bg-secondary)]/70 border border-[var(--border-primary)] rounded min-w-0">
                            <span className="text-[var(--text-muted)] uppercase block mb-1 font-bold">Size & Type</span>
                            <span className="text-[var(--text-primary)] font-bold block break-words">{(evidenceDetail.metadata.filesize / 1024 / 1024).toFixed(2)} MB &bull; {evidenceDetail.metadata.mime_type}</span>
                          </div>
                        </div>
                        <div className="min-w-0">
                          <span className="text-[var(--text-muted)] text-[10px] uppercase font-bold block mb-2">Extracted Metadata</span>
                          <pre className="p-3 bg-[#060b13] border border-[var(--border-primary)] rounded text-[#0E9E78] font-mono text-[10px] leading-relaxed overflow-auto max-h-40 break-words whitespace-pre-wrap">
                            {JSON.stringify(evidenceDetail.metadata.extracted_data, null, 2)}
                          </pre>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 border border-dashed border-[var(--border-primary)] rounded-lg text-center">
                        <HardDrive className="w-10 h-10 mx-auto mb-3 text-[var(--text-muted)] opacity-40" />
                        <p className="text-[var(--text-muted)] text-[10px] font-mono uppercase">No digital file attached</p>
                        <p className="text-[var(--text-muted)] text-[8px] font-mono mt-1 opacity-60">Upload evidence files for forensic analysis</p>
                      </div>
                    )}
                  </div>

                  {/* AI Summary */}
                  <div className="p-5 bg-[var(--bg-secondary)]/40 border border-[var(--border-primary)] rounded-lg relative overflow-hidden">
                    <div className="absolute right-[-10px] bottom-[-10px] text-[#6C43CC]/5 rotate-[15deg]"><Sparkles className="w-24 h-24" /></div>
                    <div className="flex items-center justify-between mb-4 border-b border-[var(--border-muted)] pb-3 relative z-10">
                      <h3 className="text-[9px] text-[var(--text-muted)] uppercase font-bold tracking-[0.15em] font-mono flex items-center gap-2">
                        <Cpu className="w-3 h-3 text-[#6C43CC]" /> AI Summary & Analysis
                      </h3>
                      <div className="flex items-center gap-2 shrink-0">
                        {canSummary && (
                          <button onClick={() => void generateAISummary(evidenceDetail.id)} className="flex items-center gap-1 text-[9px] bg-[#6C43CC]/15 border border-[#6C43CC]/30 text-[#6C43CC] px-2.5 py-1 rounded hover:bg-[#6C43CC]/25 hover:border-[#6C43CC]/50 transition-all font-mono uppercase font-bold">
                            <Cpu className="w-3 h-3" /> Generate
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (!aiChatOpen) {
                              setAiChatOpen(true);
                              if (aiChatMessages.length === 0) {
                                const initQuery = `Tell me about evidence "${evidenceDetail.title}" (ID: ${evidenceDetail.id}, Type: ${evidenceDetail.evidence_type}, Status: ${evidenceDetail.status}). What are the key details, and what analysis would you recommend?`;
                                setAiChatMessages([{ id: 'init', sender: 'user', text: initQuery }]);
                                void sendAiChatMessage(initQuery);
                              }
                            } else {
                              setAiChatOpen(false);
                            }
                          }}
                          className={`flex items-center gap-1 text-[9px] border px-2.5 py-1 rounded transition-all font-mono uppercase font-bold ${aiChatOpen ? 'bg-[#6C43CC]/25 border-[#6C43CC]/50 text-[#6C43CC]' : 'bg-[#1E6FD9]/15 border-[#1E6FD9]/30 text-[#1E6FD9] hover:bg-[#1E6FD9]/25 hover:border-[#1E6FD9]/50'}`}
                        >
                          <Sparkles className="w-3 h-3" /> {aiChatOpen ? 'Close AI' : 'Ask AI'}
                        </button>
                      </div>
                    </div>

                    {/* Existing AI Summaries */}
                    {evidenceDetail.ai_summaries && evidenceDetail.ai_summaries.length > 0 && !aiChatOpen && (
                      <div className="space-y-3 relative z-10">
                        {evidenceDetail.ai_summaries.map((s: any) => (
                          <div key={s.id} className="p-3 bg-[var(--bg-secondary)]/70 border border-[#6C43CC]/15 hover:border-[#6C43CC]/30 rounded transition-colors">
                            <span className="text-[8px] text-[var(--text-muted)] block mb-1.5 font-mono uppercase">{new Date(s.created_at).toLocaleString()}</span>
                            <p className="text-xs text-[var(--text-primary)] leading-relaxed break-words">{s.summary}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {!aiChatOpen && (!evidenceDetail.ai_summaries || evidenceDetail.ai_summaries.length === 0) && (
                      <div className="p-8 border border-dashed border-[var(--border-primary)] rounded-lg text-center relative z-10">
                        <Sparkles className="w-10 h-10 mx-auto mb-3 text-[var(--text-muted)] opacity-40" />
                        <p className="text-[var(--text-muted)] text-[10px] font-mono uppercase">No AI analysis generated</p>
                        <p className="text-[var(--text-muted)] text-[8px] font-mono mt-1 opacity-60">Click Generate to run forensic AI analysis</p>
                      </div>
                    )}

                    {/* Inline AI Chat Panel */}
                    {aiChatOpen && (
                      <div className="relative z-10 flex flex-col" style={{ height: '360px' }}>
                        {/* Chat Messages */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 mb-3 pr-1">
                          {aiChatMessages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[90%] rounded-lg px-3 py-2 text-[11px] leading-relaxed ${
                                msg.sender === 'user'
                                  ? 'bg-[#1E6FD9]/15 border border-[#1E6FD9]/30 text-[var(--text-primary)]'
                                  : 'bg-[var(--bg-secondary)]/80 border border-[var(--border-primary)] text-[var(--text-primary)]'
                              }`}>
                                {msg.sender === 'ai' ? (
                                  <div className="prose prose-invert prose-xs max-w-none [&_p]:my-1 [&_h1]:text-xs [&_h2]:text-xs [&_h3]:text-xs [&_ul]:my-1 [&_ol]:my-1 [&_li]:text-[11px] [&_code]:text-[10px] [&_pre]:text-[10px] [&_pre]:bg-black/30 [&_pre]:p-2 [&_pre]:rounded">
                                    <MarkdownRenderer content={msg.text} />
                                  </div>
                                ) : (
                                  <p>{msg.text}</p>
                                )}
                              </div>
                            </div>
                          ))}
                          {aiChatLoading && (
                            <div className="flex justify-start">
                              <div className="bg-[var(--bg-secondary)]/80 border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-mono text-[var(--text-muted)]">
                                <span className="inline-block animate-pulse">{aiChatStatus || 'Thinking...'}</span>
                              </div>
                            </div>
                          )}
                          <div ref={aiChatEndRef} />
                        </div>

                        {/* Open in Full Chat */}
                        <div className="flex justify-end mb-2">
                          <button
                            onClick={() => {
                              const fullQuery = aiChatMessages.find(m => m.sender === 'user')?.text || `Tell me about evidence ${evidenceDetail.title}`;
                              window.dispatchEvent(new CustomEvent('open-ai-assistant', { detail: { query: fullQuery } }));
                            }}
                            className="flex items-center gap-1 text-[8px] text-[var(--text-muted)] hover:text-[#1E6FD9] transition-colors font-mono uppercase"
                          >
                            <ExternalLink className="w-3 h-3" /> Open in Full Chat
                          </button>
                        </div>

                        {/* Chat Input */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={aiChatInput}
                            onChange={(e) => setAiChatInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendAiChatMessage(); } }}
                            placeholder="Ask a follow-up question..."
                            disabled={aiChatLoading}
                            className="flex-1 bg-[var(--bg-secondary)]/70 border border-[var(--border-primary)] rounded px-3 py-2 text-[10px] text-[var(--text-primary)] font-mono outline-none focus:border-[#6C43CC] transition-colors disabled:opacity-50"
                          />
                          <button
                            onClick={() => void sendAiChatMessage()}
                            disabled={aiChatLoading || !aiChatInput.trim()}
                            className="px-3 py-2 bg-[#6C43CC]/20 hover:bg-[#6C43CC]/30 border border-[#6C43CC]/30 hover:border-[#6C43CC]/50 text-[#6C43CC] rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Send className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column (1/3) */}
                <div className="lg:col-span-1 space-y-5 min-w-0">

                  {/* Assignments */}
                  <div className="p-5 bg-[var(--bg-secondary)]/40 border border-[var(--border-primary)] rounded-lg">
                    <h3 className="text-[9px] text-[var(--text-muted)] uppercase font-bold tracking-[0.15em] mb-4 font-mono border-b border-[var(--border-muted)] pb-3 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#C94A2A]" /> Assignments
                    </h3>
                    {canAssign && (
                      <div className="mb-4 flex gap-2">
                        <input
                          type="text"
                          value={assigneeId}
                          onChange={(e) => setAssigneeId(e.target.value)}
                          placeholder="Officer badge, name, or user UUID"
                          className="min-w-0 flex-1 bg-[var(--bg-secondary)]/70 border border-[var(--border-primary)] rounded px-2.5 py-1.5 text-[10px] text-[var(--text-primary)] font-mono outline-none focus:border-[#C94A2A] transition-colors"
                        />
                        <button onClick={() => void assignEvidence(evidenceDetail.id)} className="px-3 py-1.5 bg-[#C94A2A]/10 hover:bg-[#C94A2A]/20 border border-[#C94A2A]/20 hover:border-[#C94A2A]/40 text-[#C94A2A] text-[9px] rounded transition-all font-mono uppercase font-bold">Assign</button>
                      </div>
                    )}
                    <div className="space-y-3">
                      {evidenceDetail.assignments && evidenceDetail.assignments.length > 0 ? (
                        evidenceDetail.assignments.map((a: any) => (
                          <div key={a.id} className="p-3 bg-[var(--bg-secondary)]/70 border border-[var(--border-primary)] rounded">
                            <span className="text-[8px] text-[var(--text-muted)] block mb-1 font-mono uppercase break-all">To: {a.assigned_to}</span>
                            <span className="text-[var(--text-primary)] text-[10px] block mb-2 font-bold">{a.status}</span>
                            {(isForensic || isIO || isSCRB || isInspector) && (
                              <div className="flex gap-1.5 mt-2">
                                {a.status === 'Assigned' && (
                                  <>
                                    <button onClick={() => void handleAssignmentAction(evidenceDetail.id, a.id, 'accept')} className="px-2 py-1 bg-[#0E9E78]/10 hover:bg-[#0E9E78]/20 border border-[#0E9E78]/20 hover:border-[#0E9E78]/40 text-[#0E9E78] text-[8px] rounded transition-all font-mono uppercase font-bold">Accept</button>
                                    <button onClick={() => void handleAssignmentAction(evidenceDetail.id, a.id, 'reject')} className="px-2 py-1 bg-[#D4820A]/10 hover:bg-[#D4820A]/20 border border-[#D4820A]/20 hover:border-[#D4820A]/40 text-[#D4820A] text-[8px] rounded transition-all font-mono uppercase font-bold">Reject</button>
                                  </>
                                )}
                                {a.status === 'In Progress' && (
                                  <button onClick={() => void handleAssignmentAction(evidenceDetail.id, a.id, 'complete')} className="px-2 py-1 bg-[#1E6FD9]/10 hover:bg-[#1E6FD9]/20 border border-[#1E6FD9]/20 hover:border-[#1E6FD9]/40 text-[#1E6FD9] text-[8px] rounded transition-all font-mono uppercase font-bold">Complete</button>
                                )}
                                {(a.status === 'In Progress' || a.status === 'Completed') && (
                                  <button onClick={() => void handleAssignmentAction(evidenceDetail.id, a.id, 'return')} className="px-2 py-1 bg-[#C94A2A]/10 hover:bg-[#C94A2A]/20 border border-[#C94A2A]/20 hover:border-[#C94A2A]/40 text-[#C94A2A] text-[8px] rounded transition-all font-mono uppercase font-bold">Return</button>
                                )}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="p-4 border border-dashed border-[var(--border-primary)] rounded text-center">
                          <p className="text-[var(--text-muted)] text-[9px] font-mono uppercase">No assignments yet</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Chain of Custody */}
                  <div className="p-5 bg-[var(--bg-secondary)]/40 border border-[var(--border-primary)] rounded-lg">
                    <h3 className="text-[9px] text-[var(--text-muted)] uppercase font-bold tracking-[0.15em] mb-4 font-mono border-b border-[var(--border-muted)] pb-3 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#D4820A]" /> Chain of Custody
                    </h3>
                    {evidenceDetail.chain_of_custody && evidenceDetail.chain_of_custody.length > 0 ? (
                      <div className="relative pl-4 border-l border-[var(--border-primary)] space-y-4">
                        {evidenceDetail.chain_of_custody.map((custody: any) => (
                          <div key={custody.id} className="relative pl-4 min-w-0">
                            <div className="absolute left-[-17px] top-1.5 w-2 h-2 rounded-full bg-[#D4820A] border border-[var(--border-primary)]" />
                            <span className="text-[8px] text-[var(--text-muted)] font-mono block uppercase">{new Date(custody.timestamp).toLocaleString()}</span>
                            <strong className="text-[var(--text-primary)] text-[10px] block mt-0.5 break-words">{custody.action}</strong>
                            <span className="text-[var(--text-secondary)] text-[9px] block break-words mt-0.5">To: {custody.to_user}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 border border-dashed border-[var(--border-primary)] rounded text-center">
                        <p className="text-[var(--text-muted)] text-[9px] font-mono uppercase">No custody transfers recorded</p>
                      </div>
                    )}
                  </div>

                  {/* Event Timeline */}
                  <div className="p-5 bg-[var(--bg-secondary)]/40 border border-[var(--border-primary)] rounded-lg">
                    <h3 className="text-[9px] text-[var(--text-muted)] uppercase font-bold tracking-[0.15em] mb-4 font-mono border-b border-[var(--border-muted)] pb-3 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-400" /> Event Timeline
                    </h3>
                    {evidenceDetail.timeline && evidenceDetail.timeline.length > 0 ? (
                      <div className="relative pl-4 border-l border-[var(--border-primary)] space-y-4">
                        {evidenceDetail.timeline.map((event: any) => (
                          <div key={event.id} className="relative pl-4 min-w-0">
                            <div className="absolute left-[-17px] top-1.5 w-2 h-2 rounded-full bg-purple-400 border border-[var(--border-primary)]" />
                            <span className="text-[8px] text-[var(--text-muted)] font-mono block uppercase">{new Date(event.created_at).toLocaleString()}</span>
                            <strong className="text-[var(--text-primary)] text-[10px] block mt-0.5 break-words">{event.action}</strong>
                            <span className="text-[var(--text-secondary)] text-[9px] block break-words mt-0.5">by {event.performed_by} ({event.role})</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 border border-dashed border-[var(--border-primary)] rounded text-center">
                        <p className="text-[var(--text-muted)] text-[9px] font-mono uppercase">No events recorded</p>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
};

export default EvidencePage;
