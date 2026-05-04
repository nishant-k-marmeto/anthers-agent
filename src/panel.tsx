/**
 * AgentPanel — modern floating chat panel.
 *
 * Three display modes:
 *   'bubble'   — minimised to a launcher button (bottom-right corner)
 *   'float'    — compact floating card (400 × 600, bottom-right)
 *   'full'     — full-height side-panel (right edge, 460 px wide)
 *
 * ── Minimal setup ────────────────────────────────────────────────────────────
 *
 *   <AgentPanel
 *     isOpen={open}
 *     onClose={() => setOpen(false)}
 *     agent={useAgent()}
 *   />
 *
 * ── Full props ────────────────────────────────────────────────────────────────
 *
 *   <AgentPanel
 *     isOpen={open}
 *     onClose={() => setOpen(false)}
 *     agent={agent}
 *     defaultMode="float"            // 'float' | 'full'  (default: 'float')
 *     title="Nexus Agent"
 *     subtitle="Powered by Gemini"
 *     logoUrl="https://..."
 *     accentColor="#6366f1"
 *     screenLabel="products"
 *     suggestions={['Show products', 'Top expenses']}
 *     onFeedback={(id, type) => track('feedback', { id, type })}
 *     onTrack={(event, props) => mixpanel.track(event, props)}
 *   />
 */

import React, {
  useState, useRef, useEffect, useCallback, useMemo,
} from 'react';
import {
  X, Send, Loader2, Maximize2, Minimize2,
  ThumbsUp, ThumbsDown, TrendingUp, AlertTriangle, Info,
  Sparkles, ChevronRight, Bot, Zap, Copy, Check,
  Plus, Clock, Trash2, MessageSquare, PanelRightClose,
} from 'lucide-react';
import type { AgentMessage, Thread } from './types';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PanelMode = 'float' | 'full';
export type PanelPosition = 'right' | 'left' | 'bottom-right' | 'bottom-left'; // kept for back-compat

export type TrackEvent =
  | 'query_sent'
  | 'suggestion_clicked'
  | 'conversation_cleared'
  | 'panel_opened';

export interface AgentHookResult {
  messages: AgentMessage[];
  isLoading: boolean;
  sendMessage: (msg: string) => void;
  clearMessages: () => void;
  cancelRequest?: () => void;
  threads?: Thread[];
  currentThreadId?: string;
  newThread?: () => void;
  switchThread?: (id: string) => void;
  deleteThread?: (id: string) => void;
}

export interface AgentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  agent: AgentHookResult;
  defaultMode?: PanelMode;
  title?: string;
  subtitle?: string;
  logoUrl?: string;
  accentColor?: string;
  screenLabel?: string;
  suggestions?: readonly string[];
  onFeedback?: (messageId: string, type: 'positive' | 'negative') => void;
  onTrack?: (event: TrackEvent, props: Record<string, unknown>) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCENT = '#6366f1';

const DEFAULT_SUGGESTIONS = [
  'What are my top metrics this month?',
  'Where are costs growing fastest?',
  'Show me recent anomalies',
] as const;

// ── AgentPanel ────────────────────────────────────────────────────────────────

export function AgentPanel({
  isOpen,
  onClose,
  agent,
  defaultMode = 'float',
  title = 'AI Assistant',
  subtitle,
  logoUrl,
  accentColor = ACCENT,
  screenLabel,
  suggestions = DEFAULT_SUGGESTIONS,
  onFeedback,
  onTrack,
}: AgentPanelProps) {
  const {
    messages, isLoading, sendMessage, clearMessages, cancelRequest,
    threads, currentThreadId, newThread, switchThread, deleteThread,
  } = agent;

  const [mode, setMode] = useState<PanelMode>(defaultMode);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<Record<string, 'positive' | 'negative'>>({});

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const trackedOpen = useRef(false);

  const hasThreads = !!(threads && threads.length > 0 && newThread && switchThread);

  // ── Open / close animation ────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 320);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // ── Track panel open ──────────────────────────────────────────────────────
  useEffect(() => {
    if (visible && !trackedOpen.current) {
      trackedOpen.current = true;
      onTrack?.('panel_opened', { screen: screenLabel ?? null });
    }
    if (!visible) trackedOpen.current = false;
  }, [visible, screenLabel, onTrack]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (nearBottom || isLoading) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  // ── Focus input on open ───────────────────────────────────────────────────
  useEffect(() => {
    if (visible) setTimeout(() => inputRef.current?.focus(), 100);
  }, [visible]);

  // ── Auto-resize textarea ──────────────────────────────────────────────────
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
  }, [input]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSend = useCallback((text?: string, isSuggestion = false) => {
    const query = (text ?? input).trim();
    if (!query || isLoading) return;
    onTrack?.('query_sent', { query, screen: screenLabel ?? null, is_suggestion: isSuggestion });
    sendMessage(query);
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
  }, [input, isLoading, screenLabel, sendMessage, onTrack]);

  const handleSuggestion = useCallback((s: string, i: number) => {
    onTrack?.('suggestion_clicked', { suggestion_text: s, suggestion_index: i, screen: screenLabel ?? null });
    handleSend(s, true);
  }, [screenLabel, onTrack, handleSend]);

  const handleClear = useCallback(() => {
    if (!window.confirm('Clear this conversation?')) return;
    onTrack?.('conversation_cleared', { screen: screenLabel ?? null, messages_count: messages.length });
    clearMessages();
    setFeedback({});
  }, [screenLabel, messages.length, clearMessages, onTrack]);

  const handleFeedback = useCallback((msg: AgentMessage, type: 'positive' | 'negative') => {
    if (feedback[msg.id]) return;
    setFeedback(prev => ({ ...prev, [msg.id]: type }));
    onFeedback?.(msg.id, type);
  }, [feedback, onFeedback]);

  const handleClose = useCallback(() => { cancelRequest?.(); onClose(); }, [cancelRequest, onClose]);

  if (!mounted) return null;

  // ── Panel geometry ────────────────────────────────────────────────────────
  const isFloat = mode === 'float';

  const panelStyle: React.CSSProperties = isFloat
    ? {
      position: 'fixed',
      bottom: 24,
      right: 24,
      width: 400,
      height: 620,
      borderRadius: 20,
      zIndex: 9999,
      transform: visible ? 'scale(1) translateY(0)' : 'scale(0.94) translateY(24px)',
      opacity: visible ? 1 : 0,
      transition: 'transform 0.28s cubic-bezier(0.22,1,0.36,1), opacity 0.22s ease',
      transformOrigin: 'bottom right',
    }
    : {
      position: 'fixed',
      top: 0,
      right: 0,
      bottom: 0,
      width: 460,
      zIndex: 9999,
      transform: visible ? 'translateX(0)' : 'translateX(100%)',
      opacity: visible ? 1 : 0,
      transition: 'transform 0.32s cubic-bezier(0.22,1,0.36,1), opacity 0.25s ease',
    };

  return (
    <>
      {/* Backdrop — only in full mode */}
      {!isFloat && (
        <div
          aria-hidden
          onClick={handleClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 9998,
            background: 'rgba(15,20,40,0.25)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.28s ease',
          }}
        />
      )}

      {/* Panel */}
      <div
        role="dialog"
        aria-label={title}
        aria-modal="true"
        style={{
          ...panelStyle,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: '#ffffff',
          boxShadow: isFloat
            ? '0 24px 64px -8px rgba(0,0,0,0.18), 0 8px 24px -4px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06)'
            : '0 0 0 1px rgba(0,0,0,0.06), -12px 0 48px -8px rgba(0,0,0,0.12)',
        }}
      >
        {/* Header */}
        <Header
          title={title}
          subtitle={subtitle}
          logoUrl={logoUrl}
          accentColor={accentColor}
          screenLabel={screenLabel}
          mode={mode}
          hasThreads={hasThreads}
          sidebarOpen={sidebarOpen}
          messageCount={messages.length}
          onToggleSidebar={() => setSidebarOpen(o => !o)}
          onToggleMode={() => setMode(m => m === 'float' ? 'full' : 'float')}
          onClear={handleClear}
          onClose={handleClose}
        />

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Thread sidebar */}
          {hasThreads && sidebarOpen && (
            <ThreadSidebar
              threads={threads!}
              currentThreadId={currentThreadId!}
              accentColor={accentColor}
              onNew={() => { newThread!(); setSidebarOpen(false); }}
              onSwitch={id => { switchThread!(id); setSidebarOpen(false); }}
              onDelete={deleteThread}
            />
          )}

          {/* Messages */}
          <div
            ref={scrollRef}
            style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', background: '#f7f8fc' }}
          >
            {messages.length === 0 ? (
              <EmptyState
                title={title}
                logoUrl={logoUrl}
                accentColor={accentColor}
                screenLabel={screenLabel}
                suggestions={suggestions}
                onSuggestion={handleSuggestion}
              />
            ) : (
              <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {messages.map((msg, idx) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    accentColor={accentColor}
                    feedbackGiven={feedback[msg.id]}
                    onFeedback={handleFeedback}
                    isLast={idx === messages.length - 1}
                  />
                ))}
                {isLoading && !messages.some(m => m.loading) && <TypingIndicator accentColor={accentColor} />}
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <InputBar
          ref={inputRef}
          value={input}
          isLoading={isLoading}
          accentColor={accentColor}
          screenLabel={screenLabel}
          onChange={setInput}
          onSend={() => handleSend()}
          onCancel={cancelRequest}
        />
      </div>
    </>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

function Header({
  title, subtitle, logoUrl, accentColor, screenLabel, mode,
  hasThreads, sidebarOpen, messageCount,
  onToggleSidebar, onToggleMode, onClear, onClose,
}: {
  title: string; subtitle?: string; logoUrl?: string; accentColor: string;
  screenLabel?: string; mode: PanelMode; hasThreads: boolean; sidebarOpen: boolean;
  messageCount: number; onToggleSidebar: () => void; onToggleMode: () => void;
  onClear: () => void; onClose: () => void;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 16px',
      borderBottom: '1px solid rgba(0,0,0,0.06)',
      background: `linear-gradient(135deg, ${accentColor} 0%, ${adjustHex(accentColor, -20)} 100%)`,
      flexShrink: 0,
    }}>
      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {hasThreads && (
          <button
            onClick={onToggleSidebar}
            title={sidebarOpen ? 'Hide threads' : 'Threads'}
            style={{
              ...iconBtn,
              background: sidebarOpen ? 'rgba(255,255,255,0.25)' : 'transparent',
              color: 'rgba(255,255,255,0.85)',
            }}
          >
            <MessageSquare size={15} />
          </button>
        )}

        {/* Avatar */}
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, backdropFilter: 'blur(8px)',
        }}>
          {logoUrl
            ? <img src={logoUrl} alt={title} style={{ width: 22, height: 22, objectFit: 'contain' }} />
            : <Bot size={16} color="white" strokeWidth={2} />
          }
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600, color: '#fff', fontSize: 13.5, lineHeight: 1.2 }}>{title}</span>
            {/* Live dot */}
            <span style={{ position: 'relative', display: 'flex', width: 7, height: 7, flexShrink: 0 }}>
              <span style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: '#4ade80', opacity: 0.7,
                animation: 'ping 1.5s ease-in-out infinite',
              }} />
              <span style={{ borderRadius: '50%', background: '#4ade80', width: 7, height: 7, flexShrink: 0 }} />
            </span>
          </div>
          {(subtitle || screenLabel) && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 1, display: 'block' }}>
              {subtitle ?? `${screenLabel} context`}
            </span>
          )}
        </div>
      </div>

      {/* Right actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        {messageCount > 0 && (
          <button onClick={onClear} title="Clear chat" style={{ ...iconBtn, color: 'rgba(255,255,255,0.7)' }}>
            <Trash2 size={14} strokeWidth={1.75} />
          </button>
        )}
        <button
          onClick={onToggleMode}
          title={mode === 'float' ? 'Expand to sidebar' : 'Minimize to card'}
          style={{ ...iconBtn, color: 'rgba(255,255,255,0.7)' }}
        >
          {mode === 'float'
            ? <Maximize2 size={14} strokeWidth={2} />
            : <Minimize2 size={14} strokeWidth={2} />
          }
        </button>
        <button onClick={onClose} title="Close" style={{ ...iconBtn, color: 'rgba(255,255,255,0.7)' }}>
          <X size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

// ── ThreadSidebar ─────────────────────────────────────────────────────────────

function ThreadSidebar({
  threads, currentThreadId, accentColor, onNew, onSwitch, onDelete,
}: {
  threads: Thread[]; currentThreadId: string; accentColor: string;
  onNew: () => void; onSwitch: (id: string) => void; onDelete?: (id: string) => void;
}) {
  const [hoverId, setHoverId] = useState<string | null>(null);

  function relTime(iso: string) {
    const d = Date.now() - new Date(iso).getTime();
    const m = Math.floor(d / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  }

  return (
    <div style={{
      width: 168, flexShrink: 0, display: 'flex', flexDirection: 'column',
      borderRight: '1px solid rgba(0,0,0,0.06)', background: '#fafafa', overflow: 'hidden',
    }}>
      {/* New thread */}
      <button
        onClick={onNew}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '11px 14px', borderBottom: '1px solid rgba(0,0,0,0.06)',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: accentColor, fontSize: 12, fontWeight: 600, width: '100%',
        }}
      >
        <Plus size={13} strokeWidth={2.5} />
        New chat
      </button>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {threads.map(t => {
          const active = t.id === currentThreadId;
          return (
            <div
              key={t.id}
              style={{ position: 'relative' }}
              onMouseEnter={() => setHoverId(t.id)}
              onMouseLeave={() => setHoverId(null)}
            >
              {/* Active bar */}
              {active && (
                <div style={{
                  position: 'absolute', left: 0, top: 6, bottom: 6,
                  width: 3, borderRadius: '0 3px 3px 0', background: accentColor,
                }} />
              )}
              <button
                onClick={() => onSwitch(t.id)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '10px 14px 10px 18px',
                  background: active ? `${accentColor}0f` : hoverId === t.id ? '#f0f0f5' : 'transparent',
                  border: 'none', cursor: 'pointer',
                }}
              >
                <div style={{
                  fontSize: 11.5, lineHeight: 1.4, color: active ? '#1e1e2e' : '#555',
                  fontWeight: active ? 600 : 400,
                  overflow: 'hidden', display: '-webkit-box',
                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  paddingRight: 16,
                }}>
                  {t.title}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Clock size={9} color="#aaa" />
                  <span style={{ fontSize: 10, color: '#aaa' }}>{relTime(t.updatedAt)}</span>
                </div>
              </button>

              {/* Delete on hover */}
              {onDelete && hoverId === t.id && (
                <button
                  onClick={e => { e.stopPropagation(); onDelete(t.id); }}
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    padding: 4, borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: 'transparent', color: '#ccc',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; (e.currentTarget as HTMLButtonElement).style.background = '#fef2f2'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ccc'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                >
                  <Trash2 size={11} strokeWidth={1.75} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState({
  title, logoUrl, accentColor, screenLabel, suggestions, onSuggestion,
}: {
  title: string; logoUrl?: string; accentColor: string; screenLabel?: string;
  suggestions: readonly string[]; onSuggestion: (s: string, i: number) => void;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '32px 20px', minHeight: 400, textAlign: 'center',
    }}>
      {/* Icon */}
      <div style={{
        width: 60, height: 60, borderRadius: 18,
        background: `linear-gradient(135deg, ${accentColor}18, ${accentColor}35)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 16, boxShadow: `0 4px 20px ${accentColor}25`,
      }}>
        {logoUrl
          ? <img src={logoUrl} alt={title} style={{ width: 36, height: 36, objectFit: 'contain' }} />
          : <Sparkles size={26} strokeWidth={1.5} color={accentColor} />
        }
      </div>

      <h4 style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', margin: '0 0 6px' }}>
        How can I help you?
      </h4>
      <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, maxWidth: 260, margin: 0 }}>
        {screenLabel
          ? `Ask anything about your ${screenLabel} data — I'll fetch live results.`
          : "Ask about your data, metrics, or trends."}
      </p>

      {suggestions.length > 0 && (
        <div style={{ width: '100%', marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#cbd5e1', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
            Try asking
          </p>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => onSuggestion(s, i)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 8, padding: '11px 16px', textAlign: 'left',
                background: '#fff', border: '1px solid #e8eaf0', borderRadius: 12,
                cursor: 'pointer', fontSize: 13, color: '#4a4a6a', lineHeight: 1.4,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = accentColor + '60';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 2px 8px ${accentColor}18`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#e8eaf0';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
              }}
            >
              <span>{s}</span>
              <ChevronRight size={13} color="#cbd5e1" strokeWidth={2.5} style={{ flexShrink: 0 }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── InputBar ──────────────────────────────────────────────────────────────────

const InputBar = React.forwardRef<HTMLTextAreaElement, {
  value: string; isLoading: boolean; accentColor: string; screenLabel?: string;
  onChange: (v: string) => void; onSend: () => void; onCancel?: () => void;
}>(({ value, isLoading, accentColor, screenLabel, onChange, onSend, onCancel }, ref) => {
  const canSend = !!value.trim() && !isLoading;

  return (
    <div style={{
      padding: '12px 14px 14px', borderTop: '1px solid rgba(0,0,0,0.06)',
      background: '#fff', flexShrink: 0,
    }}>
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 8,
        background: '#f4f5f9', borderRadius: 14,
        padding: '10px 10px 10px 14px',
        border: '1.5px solid transparent',
        transition: 'border-color 0.15s',
      }}
        onFocusCapture={e => (e.currentTarget.style.borderColor = accentColor + '60')}
        onBlurCapture={e => (e.currentTarget.style.borderColor = 'transparent')}
      >
        <textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
          }}
          placeholder="Ask me anything…"
          disabled={isLoading}
          style={{
            flex: 1, resize: 'none', border: 'none', outline: 'none',
            background: 'transparent', fontSize: 13.5, color: '#1a1a2e',
            lineHeight: 1.55, fontFamily: 'inherit', maxHeight: 112,
            padding: 0,
          }}
        />

        {isLoading ? (
          <button
            onClick={onCancel}
            title="Stop generating"
            style={{
              width: 34, height: 34, borderRadius: 10, border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', background: '#fee2e2', color: '#ef4444',
              flexShrink: 0,
            }}
          >
            <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
          </button>
        ) : (
          <button
            onClick={onSend}
            disabled={!canSend}
            title="Send (Enter)"
            style={{
              width: 34, height: 34, borderRadius: 10, border: 'none',
              cursor: canSend ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: canSend ? accentColor : '#e2e4ed',
              color: '#fff', flexShrink: 0,
              transition: 'background 0.15s, transform 0.1s',
              transform: 'scale(1)',
            }}
            onMouseDown={e => canSend && ((e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.92)')}
            onMouseUp={e => ((e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)')}
          >
            <Send size={14} strokeWidth={2.5} />
          </button>
        )}
      </div>

      <p style={{ fontSize: 10.5, color: '#c0c4d4', textAlign: 'center', marginTop: 8, lineHeight: 1 }}>
        {screenLabel && <><strong style={{ color: '#b0b5ca', fontWeight: 600 }}>{screenLabel}</strong> · </>}
        Enter ↵ send &nbsp;·&nbsp; Shift+Enter new line
      </p>
    </div>
  );
});
InputBar.displayName = 'InputBar';

// ── TypingIndicator ───────────────────────────────────────────────────────────

function TypingIndicator({ accentColor }: { accentColor: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
      <AgentAvatar accentColor={accentColor} />
      <div style={{
        background: '#fff', borderRadius: '18px 18px 18px 4px',
        padding: '12px 16px', display: 'flex', gap: 5, alignItems: 'center',
        boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
      }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              width: 6, height: 6, borderRadius: '50%', background: '#c8ccd8',
              animation: `bounce 1.2s ease-in-out ${i * 0.18}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── MessageBubble ─────────────────────────────────────────────────────────────

const INSIGHT_STYLES = {
  warning: { bg: '#fffbeb', border: '#fcd34d', icon: AlertTriangle, iconColor: '#f59e0b', text: '#92400e' },
  positive: { bg: '#f0fdf4', border: '#86efac', icon: TrendingUp, iconColor: '#22c55e', text: '#14532d' },
  neutral: { bg: '#f8fafc', border: '#e2e8f0', icon: Info, iconColor: '#94a3b8', text: '#475569' },
} as const;

function MessageBubble({ message, accentColor, feedbackGiven, onFeedback, isLast }: {
  message: AgentMessage; accentColor: string;
  feedbackGiven?: 'positive' | 'negative';
  onFeedback: (m: AgentMessage, t: 'positive' | 'negative') => void;
  isLast: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

  const timeLabel = useMemo(() =>
    new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    [message.timestamp],
  );

  const handleCopy = useCallback(() => {
    const text = message.response?.narrative ?? message.content ?? '';
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [message]);

  // User bubble
  if (message.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', gap: 8 }}>
        <div style={{
          maxWidth: '78%', background: accentColor, color: '#fff',
          borderRadius: '18px 18px 4px 18px', padding: '10px 15px',
          fontSize: 13.5, lineHeight: 1.55, boxShadow: `0 2px 12px ${accentColor}40`,
        }}>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message.content}</p>
        </div>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', background: '#e8eaf0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: '#64748b', flexShrink: 0,
        }}>U</div>
      </div>
    );
  }

  // Loading bubble
  if (message.loading) {
    return <TypingIndicator accentColor={accentColor} />;
  }

  // Error bubble
  if (message.error) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <AgentAvatar accentColor="#ef4444" error />
        <div style={{
          background: '#fff5f5', border: '1px solid #fecaca', borderRadius: '18px 18px 18px 4px',
          padding: '12px 15px', maxWidth: '82%',
        }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#f87171', margin: '0 0 4px' }}>Something went wrong</p>
          <p style={{ fontSize: 13, color: '#ef4444', margin: 0 }}>{message.error}</p>
        </div>
      </div>
    );
  }

  const res = message.response;
  const narrative = res?.narrative ?? message.content ?? '';

  // Agent bubble
  return (
    <div
      style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <AgentAvatar accentColor={accentColor} />

      <div style={{ flex: 1, minWidth: 0, maxWidth: '86%', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Narrative bubble */}
        <div style={{
          background: '#fff', borderRadius: '18px 18px 18px 4px',
          padding: '12px 16px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
        }}>
          <FormattedText text={narrative} />
        </div>

        {/* Insight cards */}
        {res?.insights?.map((ins, i) => {
          const s = INSIGHT_STYLES[ins.type as keyof typeof INSIGHT_STYLES] ?? INSIGHT_STYLES.neutral;
          return (
            <div
              key={i}
              style={{
                display: 'flex', gap: 10, borderRadius: 10,
                padding: '10px 12px', border: `1px solid ${s.border}`,
                background: s.bg,
              }}
            >
              <s.icon size={13} color={s.iconColor} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: s.text, margin: 0 }}>{ins.title}</p>
                <p style={{ fontSize: 11.5, color: s.text, opacity: 0.75, margin: '2px 0 0' }}>{ins.detail}</p>
              </div>
            </div>
          );
        })}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {res && <ConfidenceBadge level={res.confidence} />}
            {res && (res.apisCalled?.length ?? 0) > 0 && (
              <span style={{ fontSize: 10.5, color: '#94a3b8' }} title={res.apisCalled?.join(', ')}>
                via {res.apisCalled?.[0]}{(res.apisCalled?.length ?? 0) > 1 ? ` +${(res.apisCalled?.length ?? 0) - 1}` : ''}
              </span>
            )}
            <span style={{ fontSize: 10.5, color: '#c8ccd8' }}>{timeLabel}</span>
          </div>

          {/* Actions — visible on hover */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, opacity: hovered ? 1 : 0, transition: 'opacity 0.15s' }}>
            <button
              onClick={handleCopy}
              title="Copy"
              style={{ ...actionBtn, color: copied ? '#22c55e' : '#c8ccd8' }}
              onMouseEnter={e => !copied && ((e.currentTarget as HTMLButtonElement).style.color = '#64748b')}
              onMouseLeave={e => !copied && ((e.currentTarget as HTMLButtonElement).style.color = '#c8ccd8')}
            >
              {copied ? <Check size={11} strokeWidth={2.5} /> : <Copy size={11} strokeWidth={2} />}
            </button>
            {(['positive', 'negative'] as const).map(type => (
              <button
                key={type}
                onClick={() => onFeedback(message, type)}
                disabled={!!feedbackGiven}
                title={type === 'positive' ? 'Good' : 'Bad'}
                style={{
                  ...actionBtn,
                  color: feedbackGiven === type
                    ? type === 'positive' ? '#22c55e' : '#ef4444'
                    : '#c8ccd8',
                }}
                onMouseEnter={e => !feedbackGiven && ((e.currentTarget as HTMLButtonElement).style.color = type === 'positive' ? '#22c55e' : '#ef4444')}
                onMouseLeave={e => !feedbackGiven && ((e.currentTarget as HTMLButtonElement).style.color = '#c8ccd8')}
              >
                {type === 'positive' ? <ThumbsUp size={11} strokeWidth={2} /> : <ThumbsDown size={11} strokeWidth={2} />}
              </button>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function AgentAvatar({ accentColor, error }: { accentColor: string; error?: boolean }) {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
      background: error ? '#fee2e2' : `${accentColor}1a`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Sparkles size={13} strokeWidth={2} color={error ? '#ef4444' : accentColor} />
    </div>
  );
}

function ConfidenceBadge({ level }: { level?: string }) {
  if (!level) return null;
  const map: Record<string, { bg: string; color: string }> = {
    high: { bg: '#f0fdf4', color: '#16a34a' },
    medium: { bg: '#fffbeb', color: '#d97706' },
    low: { bg: '#f8fafc', color: '#94a3b8' },
  };
  const s = map[level] ?? map.low;
  return (
    <span style={{
      padding: '2px 7px', borderRadius: 20, fontSize: 10, fontWeight: 700,
      background: s.bg, color: s.color, letterSpacing: '0.02em',
    }}>
      {level}
    </span>
  );
}

function FormattedText({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {lines.map((line, i) => {
        const isBullet = /^[\-•]\s/.test(line.trimStart());
        const trimmed = isBullet ? line.trimStart().slice(2).trim() : line;
        const parts = trimmed.split(/(\*\*[^*]+\*\*)/g);
        const rendered = parts.map((p, j) =>
          p.startsWith('**') && p.endsWith('**')
            ? <strong key={j} style={{ fontWeight: 700, color: '#1e1e2e' }}>{p.slice(2, -2)}</strong>
            : <span key={j}>{p}</span>,
        );
        if (isBullet) {
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ marginTop: 7, width: 4, height: 4, borderRadius: '50%', background: '#94a3b8', flexShrink: 0 }} />
              <span style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.6 }}>{rendered}</span>
            </div>
          );
        }
        if (!line.trim()) return <div key={i} style={{ height: 4 }} />;
        return (
          <p key={i} style={{ margin: 0, fontSize: 13.5, color: '#374151', lineHeight: 1.6 }}>
            {rendered}
          </p>
        );
      })}
    </div>
  );
}

// ── Style helpers ─────────────────────────────────────────────────────────────

const iconBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 8, border: 'none',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', transition: 'background 0.15s, color 0.15s',
};

const actionBtn: React.CSSProperties = {
  padding: 5, borderRadius: 6, border: 'none', cursor: 'pointer',
  background: 'transparent', display: 'flex', alignItems: 'center', transition: 'color 0.12s',
};

// ── Tiny hex brightness adjuster (for gradient end-stop) ─────────────────────

function adjustHex(hex: string, amount: number): string {
  try {
    const n = parseInt(hex.replace('#', ''), 16);
    const clamp = (v: number) => Math.max(0, Math.min(255, v));
    const r = clamp(((n >> 16) & 0xff) + amount);
    const g = clamp(((n >> 8) & 0xff) + amount);
    const b = clamp((n & 0xff) + amount);
    return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
  } catch {
    return hex;
  }
}

// ── Inject keyframe animations once ──────────────────────────────────────────

if (typeof document !== 'undefined' && !document.getElementById('agent-panel-styles')) {
  const style = document.createElement('style');
  style.id = 'agent-panel-styles';
  style.textContent = `
    @keyframes bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-5px); }
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @keyframes ping {
      0%, 100% { transform: scale(1); opacity: 0.7; }
      50% { transform: scale(1.6); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}
