import React, { useState, useEffect, useRef } from 'react';
import { chatQueryStream, type ChatCitation } from '../../services/api';
import { MarkdownRenderer } from '../chat/MarkdownRenderer';
import { CitationBadge } from '../chat/CitationBadge';
import {
  Sparkles, X, Send, Copy, Check, FileText,
  MessageSquare, ChevronRight, Search, Database, Brain, AlertTriangle
} from 'lucide-react';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
  sources?: string[];
  citations?: ChatCitation[];
  followUpSuggestions?: string[];
  engine?: string;
}

const FOLLOW_UP_MAP: Record<string, string[]> = {
  case_details: [
    "Show me the FIR linked to this case",
    "Who are the suspects?",
    "What is the investigation progress?"
  ],
  fir_lookup: [
    "Show full FIR details",
    "Who is the complainant?",
    "Show linked case details"
  ],
  criminal_history: [
    "Show criminal network connections",
    "Find similar offenders",
    "Assess criminal risk score"
  ],
  crime_statistics: [
    "Show district-wise breakdown",
    "Show category-wise trends",
    "Identify crime hotspots"
  ],
  dashboard_analytics: [
    "Show recent anomalies",
    "Show offender dossiers",
    "Crime trend analysis"
  ],
};

export const GlobalAIAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    const handleOpenAI = (e: Event) => {
      const customEvent = e as CustomEvent<{ query: string }>;
      const query = customEvent.detail?.query;
      if (query) {
        setIsOpen(true);
        setTimeout(() => {
          setInputMessage(query);
          setTimeout(() => handleSendMessage(query), 100);
        }, 200);
      }
    };
    window.addEventListener('open-ai-assistant', handleOpenAI);
    return () => window.removeEventListener('open-ai-assistant', handleOpenAI);
  }, []);

  const handleSendMessage = async (textToSend?: string) => {
    const messageText = textToSend || inputMessage;
    if (!messageText.trim()) return;

    const userMessage: Message = {
      id: `fab-msg-${Date.now()}-user`,
      sender: 'user',
      text: messageText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setSessionError(null);
    setNotice(null);
    setStreamStatus('Analyzing query intent...');

    const aiMessageId = `fab-msg-${Date.now()}-ai`;
    let accumulatedAnswer = '';
    let finalData: any = null;
    let pendingConversationId = conversationId;

    try {
      for await (const chunk of chatQueryStream(messageText, undefined, {
        conversationId: pendingConversationId,
        persist: true,
      })) {
        if (chunk.type === 'status') {
          setStreamStatus(chunk.content);
          setSessionError(null);
        } else if (chunk.type === 'meta') {
          const cid = chunk.content?.conversation_id ? String(chunk.content.conversation_id) : null;
          if (cid && cid !== pendingConversationId) {
            pendingConversationId = cid;
            setConversationId(cid);
          }
        } else if (chunk.type === 'notice') {
          setNotice(String(chunk.content || ''));
        } else if (chunk.type === 'token') {
          accumulatedAnswer += chunk.content;
          setMessages(prev => {
            const existing = prev.find(m => m.id === aiMessageId);
            if (existing) {
              return prev.map(m => m.id === aiMessageId ? { ...m, text: accumulatedAnswer } : m);
            }
            return [...prev, {
              id: aiMessageId,
              sender: 'ai',
              text: accumulatedAnswer,
              timestamp: new Date(),
            }];
          });
        } else if (chunk.type === 'final') {
          finalData = chunk.content;
        }
      }

      const classification = finalData?.classification || 'general';
      const followUps = FOLLOW_UP_MAP[classification] || FOLLOW_UP_MAP['dashboard_analytics'];

      setMessages(prev => prev.map(m => {
        if (m.id === aiMessageId) {
          return {
            ...m,
            text: finalData?.answer || accumulatedAnswer,
            sources: finalData?.sources || [],
            citations: finalData?.citations || [],
            followUpSuggestions: followUps,
            engine: finalData?.engine || undefined,
          };
        }
        return m;
      }));
    } catch (err: any) {
      const detail = err?.message || 'Unknown error';
      setSessionError(detail);
      setMessages(prev => [...prev, {
        id: aiMessageId,
        sender: 'ai',
        text: `I couldn't reach the assistant just now (**${detail}**).\n\nPlease make sure the backend is running on port 8000 and try again.`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
      setStreamStatus('');
    }
  };

  const clearConversation = () => {
    if (isLoading) return;
    setMessages([]);
    setConversationId(null);
    setNotice(null);
    setSessionError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  const handleCopyText = async (text: string, msgId: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard API unavailable (e.g. non-HTTPS) — silently ignore
    }
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleFollowUp = (suggestion: string) => {
    setInputMessage(suggestion);
    inputRef.current?.focus();
    setTimeout(() => handleSendMessage(suggestion), 50);
  };

  const getStepIcon = (status: string) => {
    if (status.includes('Analyzing')) return <Search className="w-3 h-3" />;
    if (status.includes('Querying') || status.includes('backend')) return <Database className="w-3 h-3" />;
    if (status.includes('Generating')) return <Brain className="w-3 h-3" />;
    return <ChevronRight className="w-3 h-3" />;
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 right-6 md:bottom-8 z-[100] w-14 h-14 rounded-full bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/85 text-[var(--text-primary)] shadow-glow-blue flex items-center justify-center transition-all hover:scale-110 cursor-pointer group"
          title="SAKSHA AI Assistant"
        >
          <Sparkles className="w-6 h-6 group-hover:animate-pulse" />
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--accent-teal)] rounded-full border-2 border-[var(--bg-secondary)] animate-pulse" />
        </button>
      )}

      {/* Slide-over Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-[300] flex justify-end pointer-events-none">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="relative w-full max-w-md bg-[var(--bg-secondary)] border-l border-border-color flex flex-col shadow-2xl pointer-events-auto animate-[slideInRight_0.3s_ease-out]">
            
            {/* Panel Header */}
            <div className="flex items-center justify-between p-4 border-b border-border-color bg-[var(--bg-secondary)]/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent-blue)]/15 border border-[var(--accent-blue)]/30 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-[var(--accent-blue)]" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider font-mono">SAKSHA AI</h3>
                  <p className="text-[9px] font-mono text-[var(--text-muted)] uppercase">Intelligence Assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {messages.length > 0 && (
                  <button
                    onClick={clearConversation}
                    className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded transition-colors cursor-pointer"
                    title="Clear chat"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center select-none space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-[var(--accent-blue)]/15 border border-[var(--accent-blue)]/30 flex items-center justify-center text-[var(--accent-blue)]">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wider font-mono">Quick Intelligence</p>
                    <p className="text-[10px] text-[var(--text-muted)] font-mono mt-1">
                      Ask about cases, criminals, FIRs, or crime data
                    </p>
                  </div>
                  <div className="space-y-2 w-full max-w-xs">
                    {[
                      "Show crime statistics and trends",
                      "List recent authorized cases",
                      "What are the current crime hotspots?"
                    ].map((q, i) => (
                      <button
                        key={i}
                        onClick={() => handleSendMessage(q)}
                        className="w-full p-2 bg-[var(--bg-secondary)]/50 border border-[var(--border-primary)] rounded text-[10px] font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-blue)]/40 transition-all text-left cursor-pointer"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  const isUser = msg.sender === 'user';
                  return (
                    <div key={msg.id} className={`flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-2 font-mono text-[8px] text-[var(--text-secondary)]">
                        <span>{isUser ? 'YOU' : 'AI'}</span>
                        <span>·</span>
                        <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      <div className={`p-3 rounded-lg border text-[11px] leading-relaxed max-w-[90%] text-left font-mono ${
                        isUser
                          ? 'bg-[var(--accent-blue)]/10 border-[var(--accent-blue)]/20 text-[var(--text-primary)]'
                          : 'bg-[var(--bg-tertiary)]/35 border-[var(--border-primary)] text-[var(--text-secondary)] relative group'
                      }`}>
                        {isUser ? (
                          <div className="whitespace-pre-wrap">{msg.text}</div>
                        ) : (
                          <MarkdownRenderer content={msg.text} />
                        )}

                        {!isUser && msg.citations && msg.citations.length > 0 && (
                          <CitationBadge citations={msg.citations} />
                        )}
                        {!isUser && msg.sources && msg.sources.length > 0 && !msg.citations?.length && (
                          <div className="mt-3 pt-2 border-t border-[var(--border-primary)]">
                            <div className="flex flex-wrap gap-1.5">
                              {msg.sources.map((src, sIdx) => (
                                <span key={sIdx} className="px-2 py-0.5 bg-[var(--bg-secondary)]/60 border border-[var(--border-primary)] rounded text-[8px] text-[var(--text-secondary)] flex items-center gap-1 font-mono">
                                  <FileText className="w-2.5 h-2.5 text-[var(--accent-teal)]" />
                                  {src}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {!isUser && msg.engine && (
                          <div className="mt-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--accent-purple)]/10 border border-[var(--accent-purple)]/20 text-[var(--accent-purple)] text-[8px] font-mono">
                            <Brain className="w-2.5 h-2.5" />
                            {msg.engine === 'local-template' ? 'On-device intelligence' : msg.engine}
                          </div>
                        )}

                        {!isUser && (
                          <button
                            onClick={() => handleCopyText(msg.text, msg.id)}
                            className="absolute right-2 top-2 p-1 bg-[var(--bg-secondary)]/70 border border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                          >
                            {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        )}
                      </div>

                      {!isUser && msg.followUpSuggestions && msg.followUpSuggestions.length > 0 && !isLoading && (
                        <div className="flex flex-wrap gap-1.5 mt-1 max-w-[90%]">
                          {msg.followUpSuggestions.map((s, sIdx) => (
                            <button
                              key={sIdx}
                              onClick={() => handleFollowUp(s)}
                              className="px-2 py-1 bg-[var(--accent-blue)]/10 border border-[var(--accent-blue)]/20 rounded text-[9px] font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-blue)]/40 transition-all cursor-pointer"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* Streaming loader */}
              {isLoading && (
                <div className="flex flex-col gap-1.5 items-start">
                  <div className="font-mono text-[8px] text-[var(--text-secondary)]">AI</div>
                  <div className="p-3 bg-[var(--bg-tertiary)]/35 border border-[var(--border-primary)] rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="flex space-x-1">
                        <div className="w-1.5 h-1.5 bg-[var(--accent-blue)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 bg-[var(--accent-blue)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 bg-[var(--accent-blue)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <div className="flex items-center gap-1 text-[9px] font-mono text-[var(--text-muted)]">
                        {getStepIcon(streamStatus)}
                        <span className="uppercase tracking-wider">{streamStatus || 'Processing...'}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-1.5">
                      {['Analyzing', 'Querying', 'Generating'].map((step, idx) => {
                        const isDone = streamStatus.includes('Generating') || (streamStatus.includes('Retrieved') && idx < 2) || (streamStatus.includes('Intent') && idx === 0);
                        const isCurrent = (idx === 0 && streamStatus.includes('Analyzing')) || (idx === 1 && (streamStatus.includes('Querying') || streamStatus.includes('Intent') || streamStatus.includes('Retrieved'))) || (idx === 2 && streamStatus.includes('Generating'));
                        return (
                          <div key={step} className={`flex items-center gap-1 text-[7px] font-mono uppercase ${isCurrent ? 'text-[var(--accent-blue)]' : isDone ? 'text-[var(--accent-teal)]' : 'text-[var(--text-disabled)]'}`}>
                            <div className={`w-1 h-1 rounded-full ${isCurrent ? 'bg-[var(--accent-blue)] animate-pulse' : isDone ? 'bg-[var(--accent-teal)]' : 'bg-[var(--bg-elevated)]'}`} />
                            {step}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Banners: session error / persistence notice */}
            {(sessionError || notice) && (
              <div className="px-4 py-2 border-t border-border-color bg-[var(--bg-secondary)]/40">
                {sessionError && (
                  <div className="flex items-start gap-2 text-[9px] font-mono text-[var(--accent-coral)]">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>{sessionError}</span>
                  </div>
                )}
                {notice && !sessionError && (
                  <div className="flex items-start gap-2 text-[9px] font-mono text-[var(--accent-amber)]">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>{notice}</span>
                  </div>
                )}
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-border-color bg-[var(--bg-secondary)]/30">
              <div className="flex items-end gap-2 bg-[var(--bg-secondary)]/70 border border-[var(--border-primary)] focus-within:border-[var(--accent-blue)]/40 rounded-lg p-2">
                <textarea
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about cases, criminals..."
                  className="flex-grow bg-transparent outline-none border-none text-[var(--text-primary)] text-[11px] font-mono resize-none max-h-20 py-1 placeholder:text-[var(--text-muted)]"
                  rows={1}
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={isLoading}
                  className="p-1.5 bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/85 text-[var(--text-primary)] disabled:opacity-30 rounded shrink-0 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[7px] font-mono text-[var(--text-disabled)] mt-1 text-center uppercase">
                Press Enter to send
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GlobalAIAssistant;
