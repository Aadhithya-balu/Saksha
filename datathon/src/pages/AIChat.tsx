import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { useAuditStore } from '../store/auditStore';
import { useUserScope } from '../hooks/useUserScope';
import {
  chatQueryStream,
  listConversations,
  getConversation,
  createConversation,
  updateConversation,
  deleteConversation,
  deleteAllConversations,
  getCrimeCase,
  getReportDetail,
  type ChatCitation,
  type ChatSourceRecord,
  type ConversationSummary,
  type CrimeCaseDetailRecord,
  type ReportDetail,
} from '../services/api';
import { MarkdownRenderer } from '../components/chat/MarkdownRenderer';
import { CitationBadge } from '../components/chat/CitationBadge';
import {
  Send, Trash2, Copy, MessageSquare, Plus, FileText, Check,
  ShieldAlert, ArrowRight, RefreshCw, Search, Brain,
  Bot, User, TrendingUp, MapPin, MoreVertical, Pencil, EyeOff,
  Bookmark, X, Loader2, PanelLeft, PanelRight, ShieldCheck,
  ExternalLink, AlertTriangle,
} from 'lucide-react';

interface UiMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
  sources?: string[];
  citations?: ChatCitation[];
  followUpSuggestions?: string[];
  classification?: string;
  engine?: string;
}

interface Thread {
  key: string;
  serverId: string | null;
  title: string;
  messages: UiMessage[];
  temporary: boolean;
  streaming: boolean;
}

type GroupKey = 'today' | 'yesterday' | 'week' | 'older';

const FOLLOW_UPS: Record<string, string[]> = {
  case_details: ["Show the FIR linked to this case", "Who are the suspects?", "What is the investigation progress?", "Show related cases"],
  fir_lookup: ["Show full FIR details", "Who is the complainant?", "What sections are charged?", "Show linked case details"],
  criminal_history: ["Show network connections", "What are known aliases?", "Find similar offenders", "Assess risk score"],
  crime_statistics: ["District-wise breakdown", "Category trends", "Compare previous period", "Crime hotspots"],
  hotspot_analysis: ["Predict future hotspots", "Crime trend forecast", "Compare districts", "Related anomalies"],
  predictions: ["Risk assessment details", "6-month forecast", "Compare districts", "Hotspot predictions"],
  dashboard_analytics: ["Recent anomalies", "Offender dossiers", "Active notifications", "Crime trends"],
};

const PROMPTS = [
  { text: 'Investigate a case', icon: FileText, cat: 'Case', q: 'Show me the recent open cases in my authorized area' },
  { text: 'Review an FIR', icon: ShieldAlert, cat: 'FIR', q: 'Show me the latest FIRs in my authorized area' },
  { text: 'Find a person', icon: Search, cat: 'Criminal', q: 'What persons are linked to my authorized cases?' },
  { text: 'Crime statistics', icon: TrendingUp, cat: 'Analytics', q: 'Show me crime statistics and trends for my authorized area' },
  { text: 'Identify hotspots', icon: MapPin, cat: 'Hotspots', q: 'What are the current crime hotspots in my authorized area?' },
  { text: 'Assess district risk', icon: Brain, cat: 'Prediction', q: 'What is the latest crime risk assessment for my district?' },
];

const GROUP_LABELS: Array<{ key: GroupKey; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'Previous 7 Days' },
  { key: 'older', label: 'Older' },
];

const LAST_CONV_KEY = 'saksha_chat_last';

function deriveTitle(text: string): string {
  const c = text.replace(/\s+/g, ' ').trim();
  if (!c) return 'New Chat';
  if (c.length <= 48) return c;
  const cut = c.slice(0, 48);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > 0 ? cut.slice(0, sp) : cut).trim()}...`;
}

function groupOf(iso: string): GroupKey {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.floor((day(new Date()) - day(new Date(iso))) / 86400000);
  if (diff <= 0) return 'today';
  if (diff === 1) return 'yesterday';
  if (diff <= 7) return 'week';
  return 'older';
}

function relTime(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'yesterday' : `${d}d ago`;
}

function recordLabel(r: ChatSourceRecord): string {
  if (typeof r.fir_number === 'string') return `FIR ${r.fir_number}`;
  if (typeof r.case_number === 'string') return `Case ${r.case_number}`;
  if (typeof r.name === 'string') return String(r.name);
  if (typeof r.badge === 'string') return `Officer ${r.badge}`;
  if (typeof r.type === 'string') return String(r.type).toUpperCase();
  return 'Source record';
}

function recordKindLabel(r: ChatSourceRecord): string {
  switch (r.type) {
    case 'fir': return 'FIR';
    case 'case': return 'CASE';
    case 'criminal': return 'PERSON';
    case 'officer': return 'OFFICER';
    case 'evidence': return 'EVIDENCE';
    case 'victim': return 'VICTIM';
    default: return 'RECORD';
  }
}

function recordTabForKind(kind: string | null | undefined): string | null {
  switch (kind) {
    case 'fir': return 'fir';
    case 'case': return 'crime_cases';
    case 'criminal': return 'criminals';
    case 'evidence': return 'evidence';
    case 'victim': return 'victims';
    default: return null;
  }
}

function formatDateIso(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export const AIChat: React.FC = () => {
  const { user } = useAuthStore();
  const { addLog } = useAuditStore();
  const { scopeLabel, canSelectDistrict, personaDescriptor } = useUserScope();

  const [focusCase, setFocusCase] = useState<CrimeCaseDetailRecord | null>(null);
  const [focusReport, setFocusReport] = useState<ReportDetail | null>(null);
  const [ctxOpen, setCtxOpen] = useState(false);

  const [convos, setConvos] = useState<ConversationSummary[] | null>(null);
  const [listError, setListError] = useState('');
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);

  const [threads, setThreads] = useState<Record<string, Thread>>({});
  const threadsRef = useRef<Record<string, Thread>>({});
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const [loadingConv, setLoadingConv] = useState(false);

  const [input, setInput] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  const [menuId, setMenuId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [confirmDlg, setConfirmDlg] = useState<
    { kind: 'one'; id: string; title: string } | { kind: 'all' } | null
  >(null);
  const [rowBusy, setRowBusy] = useState(false);

  const [banner, setBanner] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null);

  const [loadedTotals, setLoadedTotals] = useState<Record<string, number>>({});

  const [sideOpen, setSideOpen] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<number | null>(null);
  const bootstrapped = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const entityChatStarted = useRef(false);

  useEffect(() => {
    const consumeStoredEntity = () => {
      const stored = sessionStorage.getItem('selected_entity_id');
      if (!stored || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(stored)) return;
      const entityType = sessionStorage.getItem('selected_entity_type') || 'case';
      sessionStorage.removeItem('selected_entity_id');
      sessionStorage.removeItem('selected_entity_type');

entityChatStarted.current = true;
      const key = `d-${Date.now()}`;
      const thread: Thread = { key, serverId: null, title: 'New Chat', messages: [], temporary: false, streaming: false };
      setThreads(p => {
        threadsRef.current = { ...threadsRef.current, [key]: thread };
        return { ...p, [key]: thread };
      });
      setActiveKey(key);
      setSideOpen(false); setBanner(null); setFocusCase(null); setFocusReport(null); setInput('');

      if (entityType === 'report') {
        void getReportDetail(stored)
          .then(r => setFocusReport(r))
          .catch(() => { setFocusReport(null); });
        return;
      }
      void getCrimeCase(stored)
        .then(c => {
          setFocusCase(c);
          setInput(`Analyze case ${c.case_number}. Review its linked FIRs, evidence, and involved persons, and summarize what is known from SAKSHA records.`);
          inputRef.current?.focus();
        })
        .catch(() => { /* record may be outside scope or no longer accessible */ });
    };
    const onNav = (e: Event) => {
      const ev = e as CustomEvent<{ tab: string; targetId?: string }>;
      if (ev.detail?.tab === 'ai_chat' && ev.detail.targetId) consumeStoredEntity();
    };
    consumeStoredEntity();
    window.addEventListener('navigate-tab', onNav);
    return () => window.removeEventListener('navigate-tab', onNav);
  }, []);

  const cur = activeKey ? threads[activeKey] || null : null;
  const loading = !!(cur && cur.streaming);
  const listLoading = convos === null;

  const ctxSources = useMemo(() => {
    const openable: Array<{ key: string; label: string; kind: string | null; kindLabel: string; id?: string }> = [];
    const seen = new Set<string>();
    for (const m of cur?.messages || []) {
      if (m.sender !== 'ai') continue;
      for (const c of m.citations || []) {
        for (const r of c.records || []) {
          const k = r.id ? `id:${r.id}` : `label:${recordLabel(r)}`;
          if (seen.has(k)) continue;
          seen.add(k);
          openable.push({
            key: k,
            label: recordLabel(r),
            kind: typeof r.type === 'string' ? r.type : null,
            kindLabel: recordKindLabel(r),
            id: r.id,
          });
        }
      }
    }
    return openable.slice(0, 24);
  }, [cur]);

  const openCase = (id: string) =>
    window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab: 'crime_cases', targetId: id } }));

  const openRecord = (kind: string | null, id?: string) => {
    const tab = recordTabForKind(kind);
    if (tab && id) {
      window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab, targetId: id } }));
    }
  };

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [cur?.messages.length, loading, status]);

  const fetchList = async (q?: string): Promise<ConversationSummary[]> => {
    try {
      if (q !== undefined) setSearching(true); else setConvos(null);
      setListError('');
      const res = await listConversations(q ? { q } : undefined);
      setConvos(res.items);
      return res.items;
    } catch (e: any) {
      setListError(e?.message || 'Unable to load chat history.');
      return [];
    } finally {
      setConvos(p => p || []);
      setSearching(false);
    }
  };

  useEffect(() => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    if (!search.trim()) { fetchList(); return; }
    searchTimer.current = window.setTimeout(() => fetchList(search.trim()), 300);
    return () => { if (searchTimer.current) window.clearTimeout(searchTimer.current); };
  }, [search]);

  const patchThread = (key: string, fn: (t: Thread) => Thread) => {
    setThreads(prev => {
      if (!prev[key]) return prev;
      const updated = fn(prev[key]);
      threadsRef.current = { ...prev, [key]: updated };
      return { ...prev, [key]: updated };
    });
  };

  const openConversation = async (id: string) => {
    const existing = threads[id];
    if (existing) { setActiveKey(id); setSideOpen(false); setBanner(null); return; }
    setLoadingConv(true); setBanner(null);
    try {
      const d = await getConversation(id, { limit: 200 });
      const msgs: UiMessage[] = d.messages.map(m => ({
        id: m.id,
        sender: m.role === 'user' ? 'user' : 'ai',
        text: m.content,
        timestamp: new Date(m.created_at),
        sources: m.sources ?? [],
        citations: (m.citations ?? []) as ChatCitation[],
        classification: m.classification ?? undefined,
        followUpSuggestions: m.classification ? FOLLOW_UPS[m.classification] : undefined,
      }));
      setThreads(p => {
        const thread: Thread = { key: d.id, serverId: d.id, title: d.title, messages: msgs, temporary: false, streaming: false };
        threadsRef.current = { ...threadsRef.current, [d.id]: thread };
        return { ...p, [d.id]: thread };
      });
      setLoadedTotals(p => ({ ...p, [d.id]: d.total_messages }));
      setActiveKey(d.id);
      localStorage.setItem(LAST_CONV_KEY, d.id);
      setSideOpen(false);
      setInput('');
    } catch (e: any) {
      setBanner({ tone: 'error', text: e?.message || 'Unable to open this conversation.' });
    } finally {
      setLoadingConv(false);
    }
  };

  useEffect(() => {
    if (bootstrapped.current || convos === null || listError || entityChatStarted.current) return;
    bootstrapped.current = true;
    const last = localStorage.getItem(LAST_CONV_KEY);
    if (last && convos.some(c => c.id === last)) openConversation(last);
  }, [convos, listError]);

  useEffect(() => {
    if (activeKey === null) return;
    setThreads(prev => {
      const next: Record<string, Thread> = {};
      for (const t of Object.values(prev)) {
        const isActive = t.key === activeKey;
        const finishedSaved = !t.streaming && t.serverId !== null && !t.temporary;
        const emptyDraft = t.messages.length === 0 && !t.streaming;
        if (isActive || t.streaming || (!finishedSaved && !emptyDraft)) next[t.key] = t;
      }
      return next;
    });
  }, [activeKey]);

  const startChat = (temporary: boolean) => {
    const key = `d-${Date.now()}`;
    const thread: Thread = { key, serverId: null, title: 'New Chat', messages: [], temporary, streaming: false };
    setThreads(p => {
      threadsRef.current = { ...threadsRef.current, [key]: thread };
      return { ...p, [key]: thread };
    });
    setActiveKey(key);
    setBanner(null); setInput(''); setSideOpen(false); setFocusCase(null); setFocusReport(null);
  };

  const dismissThread = (key: string) => {
    setThreads(p => { const n = { ...p }; delete n[key]; return n; });
    const r = { ...threadsRef.current }; delete r[key]; threadsRef.current = r;
    if (activeKey === key) setActiveKey(null);
  };

  const streamExchange = async (key: string, msg: string) => {
    const thread = threadsRef.current[key] || {
      key,
      serverId: null,
      title: 'New Chat',
      messages: [],
      temporary: false,
      streaming: false,
    };
    const aid = `a-${Date.now()}`;
    patchThread(key, t => ({ ...t, streaming: true }));
    setStatus('Understanding your query...');
    if (user) addLog(user.name, user.badgeId, 'REVIEW', `AI Copilot: ${msg.slice(0, 60)}`);

    let acc = '';
    let fd: any = null;
    let boundId = thread.serverId;

    try {
      for await (const ch of chatQueryStream(msg, undefined, {
        conversationId: thread.serverId ?? undefined,
        persist: !thread.temporary,
      })) {
        if (ch.type === 'status') setStatus(String(ch.content || ''));
        else if (ch.type === 'meta') {
          const cid = ch.content?.conversation_id ? String(ch.content.conversation_id) : null;
          const title = ch.content?.title ? String(ch.content.title) : null;
          if (cid && cid !== boundId) { boundId = cid; patchThread(key, t => ({ ...t, serverId: cid })); }
          if (title) patchThread(key, t => ({ ...t, title }));
        } else if (ch.type === 'token') {
          acc += String(ch.content || '');
          setStatus('');
          const s = acc;
          patchThread(key, t => {
            const msgs = [...t.messages];
            const lastAi = msgs.length > 0 ? msgs[msgs.length - 1] : null;
            if (lastAi && lastAi.id === aid) msgs[msgs.length - 1] = { ...lastAi, text: s };
            else msgs.push({ id: aid, sender: 'ai', text: s, timestamp: new Date() });
            return { ...t, messages: msgs };
          });
        } else if (ch.type === 'final') {
          fd = ch.content;
        } else if (ch.type === 'notice') {
          setBanner({ tone: 'error', text: String(ch.content || 'Unable to save this conversation.') });
        }
      }

      const fu = FOLLOW_UPS[fd?.classification || 'general'] || FOLLOW_UPS.dashboard_analytics;
      patchThread(key, t => ({
        ...t,
        messages: t.messages.map(m => m.id === aid ? {
          ...m,
          text: fd?.answer || acc,
          sources: fd?.sources || [],
          citations: (fd?.citations || []) as ChatCitation[],
          classification: fd?.classification,
          engine: fd?.engine || undefined,
          followUpSuggestions: fu,
        } : m),
        streaming: false,
      }));

      if (!thread.temporary && boundId) {
        localStorage.setItem(LAST_CONV_KEY, boundId);
        await fetchList(search.trim() || undefined);
        setBanner(null);
      }
    } catch (e: any) {
      patchThread(key, t => ({
        ...t,
        streaming: false,
        messages: [...t.messages, {
          id: aid, sender: 'ai',
          text: `## Error\n\n${e?.message || 'Unknown error'}\n\nEnsure backend is running on port 8000.`,
          timestamp: new Date(),
        }],
      }));
      if (!thread.temporary) {
        setBanner({ tone: 'error', text: 'The assistant could not respond. Nothing was saved for this attempt.' });
      }
    } finally {
      setStatus('');
    }
  };

  const send = async (textArg?: string) => {
    const msg = (textArg ?? input).trim();
    if (!msg || loading) return;

    let key = activeKey;
    let thread = key ? threadsRef.current[key] : undefined;
    if (!thread) {
      key = `d-${Date.now()}`;
      thread = { key, serverId: null, title: deriveTitle(msg), messages: [], temporary: false, streaming: false };
      setThreads(p => ({ ...p, [key as string]: thread as Thread }));
      threadsRef.current = { ...threadsRef.current, [key as string]: thread as Thread };
      setActiveKey(key);
    } else if (thread.title === 'New Chat' && thread.messages.length === 0 && !thread.serverId) {
      patchThread(thread.key, t => ({ ...t, title: deriveTitle(msg) }));
    }

    const um: UiMessage = { id: `u-${Date.now()}`, sender: 'user', text: msg, timestamp: new Date() };
    patchThread(key as string, t => ({ ...t, messages: [...t.messages, um] }));
    setInput('');
    await streamExchange(key as string, msg);
  };

  const regenerate = () => {
    if (!cur) return;
    if (cur.serverId && !cur.temporary) return;
    const lu = [...cur.messages].reverse().find(m => m.sender === 'user');
    if (!lu) return;
    const msgs = [...cur.messages];
    while (msgs.length > 0 && msgs[msgs.length - 1].sender === 'ai') msgs.pop();
    patchThread(cur.key, t => ({ ...t, messages: msgs }));
    streamExchange(cur.key, lu.text);
  };

  const followUp = (s: string) => { setInput(s); setTimeout(() => send(s), 50); };

  const copy = async (t: string, id: string) => {
    try { await navigator.clipboard.writeText(t); } catch { /* clipboard unavailable */ }
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const beginRename = (id: string, current: string) => {
    setMenuId(null);
    setRenaming({ id, value: current });
  };

  const commitRename = async () => {
    const r = renaming;
    if (!r) return;
    const clean = r.value.trim();
    setRenaming(null);
    if (!clean) return;
    setRowBusy(true);
    try {
      await updateConversation(r.id, { title: clean });
      setConvos(p => (p || []).map(c => c.id === r.id ? { ...c, title: clean } : c));
      if (cur && cur.serverId === r.id) patchThread(cur.key, t => ({ ...t, title: clean }));
    } catch (e: any) {
      setBanner({ tone: 'error', text: e?.message || 'Could not rename conversation.' });
    } finally {
      setRowBusy(false);
    }
  };

  const saveTemporary = async () => {
    if (!cur || !cur.temporary) return;
    const seed = cur.messages
      .filter(m => !(m.sender === 'ai' && /^## Error/.test(m.text)))
      .map(m => ({
        role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.text,
        classification: m.classification,
        sources: m.sources,
        citations: m.citations,
      }));
    if (seed.length === 0) { setBanner({ tone: 'error', text: 'Nothing to save yet.' }); return; }
    setRowBusy(true);
    try {
      const firstUser = cur.messages.find(m => m.sender === 'user');
      const d = await createConversation({
        title: cur.title !== 'New Chat' ? cur.title : deriveTitle(firstUser?.text || ''),
        temporary: false,
        messages: seed,
      });
      patchThread(cur.key, t => ({ ...t, serverId: d.id, temporary: false, title: d.title }));
      localStorage.setItem(LAST_CONV_KEY, d.id);
      await fetchList(search.trim() || undefined);
      setLoadedTotals(p => ({ ...p, [d.id]: d.total_messages }));
      setBanner({ tone: 'ok', text: 'Conversation saved.' });
      setTimeout(() => setBanner(b => (b && b.tone === 'ok' ? null : b)), 3000);
    } catch (e: any) {
      setBanner({ tone: 'error', text: e?.message || 'Unable to save conversation.' });
    } finally {
      setRowBusy(false);
    }
  };

  const confirmDeleteOne = async () => {
    if (!confirmDlg || confirmDlg.kind !== 'one') return;
    const { id } = confirmDlg;
    setConfirmDlg(null); setMenuId(null);
    setRowBusy(true);
    try {
      await deleteConversation(id);
      setConvos(p => (p || []).filter(c => c.id !== id));
      dismissThread(id);
    } catch (e: any) {
      setBanner({ tone: 'error', text: e?.message || 'Could not delete conversation.' });
    } finally {
      setRowBusy(false);
    }
  };

  const confirmDeleteAll = async () => {
    setConfirmDlg(null);
    setRowBusy(true);
    try {
      await deleteAllConversations();
      setConvos([]);
      localStorage.removeItem(LAST_CONV_KEY);
      Object.keys(threads).forEach(k => dismissThread(k));
    } catch (e: any) {
      setBanner({ tone: 'error', text: e?.message || 'Could not delete history.' });
    } finally {
      setRowBusy(false);
    }
  };

  const loadEarlier = async () => {
    if (!cur || !cur.serverId) return;
    setLoadingConv(true);
    try {
      const d = await getConversation(cur.serverId, { limit: 500 });
      const msgs: UiMessage[] = d.messages.map(m => ({
        id: m.id,
        sender: m.role === 'user' ? 'user' : 'ai',
        text: m.content,
        timestamp: new Date(m.created_at),
        sources: m.sources ?? [],
        citations: (m.citations ?? []) as ChatCitation[],
        classification: m.classification ?? undefined,
      }));
      patchThread(cur.key, t => ({ ...t, messages: msgs }));
      setLoadedTotals(p => ({ ...p, [cur.key]: d.total_messages }));
    } catch (e: any) {
      setBanner({ tone: 'error', text: e?.message || 'Unable to load earlier messages.' });
    } finally {
      setLoadingConv(false);
    }
  };

  const groups: Record<GroupKey, ConversationSummary[]> = { today: [], yesterday: [], week: [], older: [] };
  (convos || []).forEach(c => groups[groupOf(c.updated_at)].push(c));
  const inProgress = Object.values(threads).filter(t =>
    (t.streaming || (!t.serverId && !t.temporary && t.messages.length > 0)) ||
    (t.temporary && t.messages.length > 0));

  const renderSidebarItem = (c: ConversationSummary) => (
    <div
      key={c.id}
      onClick={() => { if (!loading) openConversation(c.id); }}
      className={`chat-side-item${activeKey === c.id ? ' active' : ''}${renaming?.id === c.id ? ' renaming' : ''}`}
    >
      <MessageSquare size={15} />
      {renaming?.id === c.id ? (
        <input
          autoFocus
          className="chat-rename-input"
          value={renaming.value}
          disabled={rowBusy}
          onChange={e => setRenaming({ ...renaming, value: e.target.value })}
          onClick={e => e.stopPropagation()}
          onKeyDown={e => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') setRenaming(null);
          }}
          onBlur={() => setTimeout(commitRename, 100)}
        />
      ) : (
        <span className="chat-side-item-text">{c.title}</span>
      )}
      <span className="chat-side-item-time">{relTime(c.updated_at)}</span>
      <button
        onClick={e => { e.stopPropagation(); setMenuId(menuId === c.id ? null : c.id); }}
        className={`chat-side-del${menuId === c.id ? ' show' : ''}`}
        title="Options"
      >
        <MoreVertical size={14} />
      </button>
      {menuId === c.id && (
        <div className="chat-menu" onClick={e => e.stopPropagation()}>
          <button className="chat-menu-item" onClick={() => beginRename(c.id, c.title)}>
            <Pencil size={13} /><span>Rename</span>
          </button>
          <button className="chat-menu-item danger" onClick={() => { setMenuId(null); setConfirmDlg({ kind: 'one', id: c.id, title: c.title }); }}>
            <Trash2 size={13} /><span>Delete</span>
          </button>
        </div>
      )}
    </div>
  );

  const renderDraftItem = (t: Thread) => (
    <div
      key={t.key}
      onClick={() => { setActiveKey(t.key); setSideOpen(false); }}
      className={`chat-side-item${activeKey === t.key ? ' active' : ''}`}
    >
      {t.temporary ? <EyeOff size={15} /> : <MessageSquare size={15} />}
      <span className="chat-side-item-text">{t.title}</span>
      {t.temporary && <span className="chat-temp-chip">TEMP</span>}
      {t.streaming && <Loader2 size={13} className="chat-spin" />}
      <button
        onClick={e => { e.stopPropagation(); if (!t.streaming) dismissThread(t.key); }}
        className="chat-side-del"
        title={t.streaming ? 'Generating...' : 'Close'}
      >
        <X size={14} />
      </button>
    </div>
  );

  const totalActive = loadedTotals[cur?.key || ''] || 0;
  const canLoadEarlier = !!cur && cur.messages.length > 0 && totalActive > cur.messages.length;

  return (
    <div className="chat-root">
      {/* Sidebar */}
      <aside className={`chat-side${sideOpen ? ' open' : ''}`}>
        <div className="chat-side-top">
          <button onClick={() => startChat(false)} className="chat-side-new">
            <Plus size={16} /><span>New chat</span>
          </button>
          <button onClick={() => startChat(true)} className="chat-side-temp">
            <EyeOff size={14} /><span>Temporary chat</span>
          </button>

          <div className="chat-side-search">
            <Search size={14} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search history..."
            />
            {searching && <Loader2 size={13} className="chat-spin" />}
            {!searching && search && (
              <button onClick={() => setSearch('')} className="chat-search-clear"><X size={12} /></button>
            )}
          </div>

          <div className="chat-side-list custom-scrollbar">
            {listLoading && (
              <>
                {[0, 1, 2].map(i => <div key={i} className="chat-skel" />)}
              </>
            )}

            {!listLoading && listError && (
              <div className="chat-side-error">
                <AlertTriangle size={14} />
                <span>{listError}</span>
                <button onClick={() => fetchList(search.trim() || undefined)}>Retry</button>
              </div>
            )}

            {!listLoading && !listError && inProgress.length > 0 && (
              <>
                <div className="chat-side-hdr">In progress</div>
                {inProgress.map(renderDraftItem)}
              </>
            )}

            {!listLoading && !listError && GROUP_LABELS.map(g => groups[g.key].length > 0 && (
              <React.Fragment key={g.key}>
                <div className="chat-side-hdr">{g.label}</div>
                {groups[g.key].map(renderSidebarItem)}
              </React.Fragment>
            ))}

            {!listLoading && !listError && (convos || []).length === 0 && inProgress.length === 0 && (
              <div className="chat-side-empty">
                {search ? 'No conversations match your search.' : 'No saved conversations yet.'}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={() => { if ((convos || []).length > 0) setConfirmDlg({ kind: 'all' }); }}
          className="chat-side-clear"
          disabled={(convos || []).length === 0}
        >
          <Trash2 size={14} /><span>Delete all history</span>
        </button>
      </aside>
      {sideOpen && <div className="chat-side-overlay" onClick={() => setSideOpen(false)} />}

      {/* Main */}
      <main className="chat-main">
        <div className="chat-topbar">
          <button onClick={() => setSideOpen(true)} className="chat-side-toggle" title="History">
            <PanelLeft size={16} />
          </button>
          <span className="chat-topbar-title">
            {cur ? cur.title : 'SAKSHA AI Intelligence'}
            {cur?.temporary && <span className="chat-temp-chip">TEMPORARY</span>}
          </span>
          {focusCase && (
            <span className="chat-scope-chip chat-case-chip" title={`Investigating ${focusCase.case_number}`}>
              <Bookmark size={12} />
              {focusCase.case_number}
            </span>
          )}
          <div className="chat-topbar-right">
            <span
              className="chat-scope-chip"
              title={personaDescriptor || (canSelectDistrict ? 'All authorized districts' : `Authorized district: ${scopeLabel}`)}
            >
              <ShieldCheck size={12} />
              <span className="chat-scope-chip-text">{canSelectDistrict ? 'STATE SCOPE' : scopeLabel.toUpperCase()}</span>
            </span>
            <button onClick={() => setCtxOpen(o => !o)} className="chat-ctx-toggle" title="Conversation context">
              <PanelRight size={16} />
            </button>
          </div>
        </div>

        {focusCase && (
          <div className="chat-case-ribbon">
            <Bookmark size={13} className="shrink-0" />
            <span className="min-w-0 truncate">
              <b>Case context</b>
              <em> · {focusCase.case_number}</em>
              {focusCase.category?.name ? <em> · {focusCase.category.name}</em> : null}
              <span className="chat-case-ribbon-note"> — ask about its FIR, evidence, or persons</span>
            </span>
            <button onClick={() => setFocusCase(null)} title="Clear case focus" className="chat-case-ribbon-x">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="chat-scroll custom-scrollbar">
          {loadingConv && !cur ? (
            <div className="chat-welcome"><Loader2 size={22} className="chat-spin" /></div>
          ) : !cur || cur.messages.length === 0 ? (
            <div className="chat-welcome">
              <div className="chat-welcome-icon"><Bot size={28} /></div>
              <h2 className="chat-welcome-title">How can I help you?</h2>
              <p className="chat-welcome-sub">
                {cur?.temporary
                  ? 'This is a temporary chat. Messages stay in this session only until you save it.'
                  : 'SAKSHA AI answers from your authorized records only — cases, FIRs, persons, evidence, statistics, or predictions.'}
              </p>
              <div className="chat-prompts">
                {PROMPTS.map((p, i) => {
                  const Ic = p.icon;
                  return (
                    <button key={i} onClick={() => send(p.q)} className="chat-prompt-card">
                      <Ic size={16} className="chat-prompt-icon" />
                      <div className="chat-prompt-body">
                        <span className="chat-prompt-cat">{p.cat}</span>
                        <span className="chat-prompt-text">{p.text}</span>
                      </div>
                      <ArrowRight size={14} className="chat-prompt-arrow" />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="chat-msgs">
              {canLoadEarlier && (
                <button onClick={loadEarlier} className="chat-load-earlier" disabled={loadingConv}>
                  {loadingConv ? <Loader2 size={13} className="chat-spin" /> : null}
                  Show earlier messages
                  {totalActive > 500 ? ` (latest ${cur!.messages.length} of ${totalActive})` : ''}
                </button>
              )}
              {cur.messages.map((m, mi) => {
                const u = m.sender === 'user';
                const last = !u && mi === cur.messages.length - 1;
                const lu = cur.messages.slice(0, mi).reverse().find(x => x.sender === 'user');
                const regenerable = last && !loading && !!lu && (!cur.serverId || cur.temporary);
                return (
                  <div key={m.id} className={`chat-msg ${u ? 'msg-u' : 'msg-a'}`}>
                    <div className={`chat-avatar ${u ? 'av-u' : 'av-a'}`}>
                      {u ? <User size={16} /> : <Bot size={16} />}
                    </div>
                    <div className="chat-msg-body">
                      <span className="chat-msg-name">{u ? 'You' : 'SAKSHA AI Intelligence'}</span>
                      {u ? (
                        <p className="chat-msg-user-text">{m.text}</p>
                      ) : (
                        <div className="chat-msg-ai-content">
                          <MarkdownRenderer content={m.text} />
                          {m.citations?.length ? <CitationBadge
                              citations={m.citations}
                              onOpenSource={r => openRecord(typeof r.type === 'string' ? r.type : null, r.id)}
                            /> : m.sources?.length ? (
                            <div className="chat-sources">
                              <span className="chat-sources-hdr">Sources</span>
                              <div className="chat-sources-row">
                                {m.sources.map((s, i) => <span key={i} className="chat-source-tag"><FileText size={13} />{s}</span>)}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )}
                      {!u && (
                        <div className="chat-msg-actions">
                          {m.engine && (
                            <span className="chat-engine-tag" title="Answer engine">
                              <Brain size={12} />
                              {m.engine === 'local-template' ? 'On-device intelligence' : m.engine}
                            </span>
                          )}
                          <button onClick={() => copy(m.text, m.id)} className="chat-action-btn" title="Copy">
                            {copied === m.id ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                          {regenerable && lu && (
                            <button onClick={regenerate} className="chat-action-btn" title="Regenerate">
                              <RefreshCw size={14} /><span>Regenerate</span>
                            </button>
                          )}
                        </div>
                      )}
                      {!u && last && !loading && m.followUpSuggestions?.length ? (
                        <div className="chat-followups">
                          {m.followUpSuggestions.map((s, i) => (
                            <button key={i} onClick={() => followUp(s)} className="chat-followup">{s}</button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {loading && (
            <div className="chat-msg msg-a">
              <div className="chat-avatar av-a"><Bot size={16} /></div>
              <div className="chat-msg-body">
                <span className="chat-msg-name">SAKSHA AI Intelligence</span>
                <div className="chat-thinking">
                  <span className="chat-thinking-dot" /><span className="chat-thinking-dot" /><span className="chat-thinking-dot" />
                  <span className="chat-thinking-text">{status || 'Thinking...'}</span>
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {banner && (
          <div className={`chat-banner ${banner.tone === 'ok' ? 'ok' : 'err'}`}>
            <AlertTriangle size={14} />
            <span>{banner.text}</span>
            <button onClick={() => setBanner(null)}><X size={13} /></button>
          </div>
        )}

        {cur?.temporary && (
          <div className="chat-temp-banner">
            <EyeOff size={14} />
            <span>Temporary chat — not stored unless you save it.</span>
            <button onClick={saveTemporary} disabled={rowBusy || cur.messages.length === 0}>
              <Bookmark size={13} />{rowBusy ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}

        <div className="chat-input-wrap">
          <div className="chat-input-box">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={cur?.temporary ? 'Temporary message...' : 'Message SAKSHA AI...'}
              className="chat-ta"
              rows={1}
            />
            <button onClick={() => send()} disabled={loading || !input.trim()} className="chat-send"><Send size={18} /></button>
          </div>
          <p className="chat-input-note">Enter to send · Shift+Enter for newline</p>
        </div>
      </main>

      {/* Context panel */}
      <aside className={`chat-ctx${ctxOpen ? ' open' : ''}`}>
        <div className="chat-ctx-head">
          <span className="chat-ctx-title"><Brain size={14} /> Context</span>
          <button onClick={() => setCtxOpen(false)} className="chat-ctx-close" title="Close context"><X size={16} /></button>
        </div>
        <div className="chat-ctx-body custom-scrollbar">
          <div className="chat-ctx-scope-line" title={personaDescriptor || undefined}>
            <ShieldCheck size={13} className="chat-ctx-scope-ic" />
            <span>{canSelectDistrict ? 'All authorized districts' : `Authorized district: ${scopeLabel}`}</span>
          </div>

          {focusReport ? (
            <div className="chat-ctx-card">
              <div className="chat-ctx-card-hdr">
                <span className="chat-ctx-card-name">{focusReport.title || focusReport.report_type.toUpperCase()}</span>
                <span className="chat-ctx-status">{focusReport.status.toUpperCase()}</span>
              </div>
              <div className="chat-ctx-card-meta">TYPE · {focusReport.report_type.toUpperCase()}</div>
              <div className="chat-ctx-card-meta">DISTRICT · {focusReport.district || 'STATE-WIDE'}</div>
              <div className="chat-ctx-card-meta">
                VERSION · v{focusReport.version}
                {typeof focusReport.snapshot_row_count === 'number'
                  ? ` · ${focusReport.snapshot_row_count} captured record${focusReport.snapshot_row_count === 1 ? '' : 's'}`
                  : ''}
              </div>
              <div className="chat-ctx-card-meta">SOURCES · {focusReport.source_record_count} linked</div>
            </div>
          ) : focusCase ? (
            <div className="chat-ctx-card">
              <div className="chat-ctx-card-hdr">
                <span className="chat-ctx-card-name">{focusCase.case_number}</span>
                <span className="chat-ctx-status">{focusCase.status.toUpperCase()}</span>
              </div>
              {focusCase.category?.name && (
                <div className="chat-ctx-card-meta">CATEGORY · {focusCase.category.name}</div>
              )}
              <div className="chat-ctx-card-meta">PRIORITY · {(focusCase.priority ?? 'medium').toUpperCase()}</div>
              <div className="chat-ctx-card-meta">DISTRICT · {focusCase.location?.district || '—'}</div>
              <div className="chat-ctx-card-meta">REPORTED · {formatDateIso(focusCase.reported_at)}</div>
              <div className="chat-ctx-card-meta">OCCURRED · {formatDateIso(focusCase.occurred_at)}</div>
              {focusCase.description ? (
                <div className="chat-ctx-card-desc">{focusCase.description}</div>
              ) : null}
              <button onClick={() => openCase(focusCase.id)} className="chat-ctx-open">
                <ExternalLink size={13} /> Open case
              </button>
            </div>
          ) : (
            <div className="chat-ctx-empty">
              Connect a case or report from elsewhere (Crime Cases → Ask AI, Reports → Ask AI) to focus this session on its records.
            </div>
          )}

          {ctxSources.length > 0 && (
            <>
              <div className="chat-ctx-sub">Referenced records</div>
              <div className="chat-ctx-records">
                {ctxSources.map(s => s.id && recordTabForKind(s.kind) ? (
                  <button key={s.key} onClick={() => openRecord(s.kind, s.id)} className="chat-ctx-record" title={`Open ${s.label}`}>
                    <span className="chat-ctx-record-kind">{s.kindLabel}</span>
                    <span className="chat-ctx-record-label">{s.label}</span>
                    <ExternalLink size={12} className="chat-ctx-record-go" />
                  </button>
                ) : (
                  <div key={s.key} className="chat-ctx-record">
                    <span className="chat-ctx-record-kind">{s.kindLabel}</span>
                    <span className="chat-ctx-record-label">{s.label}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {cur && !cur.streaming && !focusCase && !focusReport && ctxSources.length === 0 && (
            <div className="chat-ctx-empty">
              Sources retrieved by SAKSHA AI will surface here with one-click navigation to the originating records.
            </div>
          )}
        </div>
      </aside>
      {ctxOpen && <div className="chat-ctx-overlay" onClick={() => setCtxOpen(false)} />}

      {/* Confirm dialogs */}
      {confirmDlg && (
        <div className="chat-confirm-overlay" onClick={() => setConfirmDlg(null)}>
          <div className="chat-confirm" onClick={e => e.stopPropagation()}>
            <h3>{confirmDlg.kind === 'all' ? 'Delete all history?' : 'Delete conversation?'}</h3>
            <p>
              {confirmDlg.kind === 'all'
                ? 'Every saved conversation will be permanently removed from the database. This cannot be undone.'
                : `"${confirmDlg.title}" will be permanently deleted along with all of its messages. This cannot be undone.`}
            </p>
            <div className="chat-confirm-actions">
              <button onClick={() => setConfirmDlg(null)} className="ghost">Cancel</button>
              <button
                onClick={confirmDlg.kind === 'all' ? confirmDeleteAll : confirmDeleteOne}
                className="danger"
                disabled={rowBusy}
              >
                {rowBusy ? 'Deleting...' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIChat;
