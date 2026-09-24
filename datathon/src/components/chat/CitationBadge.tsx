import React, { useState } from 'react';
import { FileText, ShieldAlert, User, Database, X, BookOpen, ExternalLink } from 'lucide-react';
import type { ChatCitation, ChatSourceRecord } from '../../services/api';

interface CitationBadgeProps {
  citations: ChatCitation[];
  onOpenSource?: (record: ChatSourceRecord) => void;
}

const srcCfg = (s: string) => {
  const l = s.toLowerCase();
  if (l.includes('fir')) return { icon: FileText, color: '#1e6fd9', label: 'FIR' };
  if (l.includes('criminal') || l.includes('offender')) return { icon: User, color: '#d4820a', label: 'Criminal' };
  if (l.includes('evidence')) return { icon: ShieldAlert, color: '#c94a2a', label: 'Evidence' };
  if (l.includes('case')) return { icon: BookOpen, color: '#6c43cc', label: 'Case' };
  return { icon: Database, color: '#0e9e78', label: 'Record' };
};

const recordTitle = (r: ChatSourceRecord): string => {
  if (typeof r.fir_number === 'string') return `FIR ${r.fir_number}`;
  if (typeof r.case_number === 'string') return `Case ${r.case_number}`;
  if (typeof r.name === 'string') return String(r.name);
  if (typeof r.badge === 'string') return `Officer ${r.badge}`;
  return typeof r.type === 'string' ? String(r.type).toUpperCase() : 'Source record';
};

export const CitationBadge: React.FC<CitationBadgeProps> = ({ citations, onOpenSource }) => {
  const [active, setActive] = useState<ChatCitation | null>(null);
  if (!citations?.length) return null;

  return (
    <div className="chat-cite-wrap">
      <div className="chat-cite-header">Sources ({citations.length})</div>
      <div className="chat-cite-list">
        {citations.map((c, i) => {
          const cfg = srcCfg(c.source);
          const Ic = cfg.icon;
          const pct = Math.round(c.score * 100);
          return (
            <button key={i} onClick={() => setActive(c)} className="chat-cite-pill" style={{ borderColor: cfg.color + '30' }}>
              <Ic style={{ width: 14, height: 14, color: cfg.color, flexShrink: 0 }} />
              <span className="chat-cite-title">{c.title}</span>
              <span className="chat-cite-pct" style={{ color: pct >= 70 ? '#0e9e78' : pct >= 40 ? '#d4820a' : 'var(--text-muted)' }}>{pct}%</span>
            </button>
          );
        })}
      </div>

      {active && (
        <div className="chat-cite-modal-bg" onClick={() => setActive(null)}>
          <div className="chat-cite-modal" onClick={e => e.stopPropagation()}>
            <button onClick={() => setActive(null)} className="chat-cite-modal-x"><X size={18} /></button>
            <div className="chat-cite-modal-head">
              {(() => { const cfg = srcCfg(active.source); const Ic = cfg.icon; return <><Ic style={{ width: 18, height: 18, color: cfg.color }} /><span style={{ color: cfg.color, fontSize: 12, fontWeight: 700 }}>{cfg.label}</span></>; })()}
            </div>
            <div className="chat-cite-modal-title">{active.title}</div>
            <div className="chat-cite-modal-score">
              <span>Relevance</span>
              <div className="chat-cite-modal-bar-bg">
                <div className="chat-cite-modal-bar" style={{ width: `${Math.round(active.score * 100)}%` }} />
              </div>
              <span className="chat-cite-modal-pct">{Math.round(active.score * 100)}%</span>
            </div>
            {active.records?.length ? (
              <div className="chat-cite-records">
                <div className="chat-cite-records-hdr">Referenced SAKSHA records</div>
                {active.records.map((r, j) => (
                  <button
                    key={j}
                    className="chat-cite-record"
                    disabled={!onOpenSource}
                    onClick={() => { if (onOpenSource) { onOpenSource(r); setActive(null); } }}
                  >
                    <span className="chat-cite-record-title">{recordTitle(r)}</span>
                    {onOpenSource ? <ExternalLink size={12} className="chat-cite-record-go" /> : null}
                  </button>
                ))}
              </div>
            ) : null}
            <button onClick={() => setActive(null)} className="chat-cite-modal-close">Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CitationBadge;
