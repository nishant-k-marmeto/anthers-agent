/**
 * AgentPanel — polished slide-in chat panel.
 *
 * ── Minimal setup ────────────────────────────────────────────────────────────
 *
 *   import { AgentPanel } from 'anthers-agent';
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
 *     position="right"               // 'right' | 'left' | 'bottom-right' | 'bottom-left'
 *     title="Vision Agent"
 *     subtitle="Powered by Gemini"
 *     logoUrl="https://..."
 *     accentColor="#6366f1"          // header + user-bubble color (any CSS color)
 *     screenLabel="finance"
 *     suggestions={['Revenue trends', 'Cost anomalies']}
 *     onFeedback={(id, type) => analytics.track('feedback', { id, type })}
 *     onTrack={(event, props) => mixpanel.track(event, props)}
 *     // Events: 'query_sent' | 'suggestion_clicked' | 'conversation_cleared' | 'panel_opened'
 *   />
 */

import React, {
  useState, useRef, useEffect, useCallback, useMemo,
} from 'react';
import {
  X, Trash2, Send, Loader2,
  ThumbsUp, ThumbsDown,
  TrendingUp, AlertTriangle, Info,
  Sparkles, MessageSquare, ChevronRight,
  Bot, Zap, Copy, Check,
  Plus, Clock, MoreVertical,
} from 'lucide-react';
import type { AgentMessage, Thread } from './types';

// ── Public types ──────────────────────────────────────────────────────────────

export type PanelPosition = 'right' | 'left' | 'bottom-right' | 'bottom-left';

export type TrackEvent =
  | 'query_sent'
  | 'suggestion_clicked'
  | 'conversation_cleared'
  | 'panel_opened';

export interface AgentHookResult {
  messages:        AgentMessage[];
  isLoading:       boolean;
  sendMessage:     (msg: string) => void;
  clearMessages:   () => void;
  cancelRequest?:  () => void;
  // Thread management
  threads?:        Thread[];
  currentThreadId?: string;
  newThread?:      () => void;
  switchThread?:   (id: string) => void;
  deleteThread?:   (id: string) => void;
}

export interface AgentPanelProps {
  isOpen:        boolean;
  onClose:       () => void;
  /** Pass the result of your useAgent() hook directly */
  agent:         AgentHookResult;
  position?:     PanelPosition;     // default: 'right'
  title?:        string;            // default: 'AI Assistant'
  subtitle?:     string;            // shown below title e.g. 'Powered by Gemini'
  logoUrl?:      string;            // shown in header + empty state
  accentColor?:  string;            // hex/rgb for user bubbles + send btn (default: #6366f1)
  screenLabel?:  string;            // context chip e.g. 'finance'
  suggestions?:  readonly string[]; // shown on empty state
  /** Called when user thumbs-up/down an assistant message */
  onFeedback?:   (messageId: string, type: 'positive' | 'negative') => void;
  /**
   * Analytics / event hook — all user interactions fire through here.
   *
   * Events:
   *   'panel_opened'         — panel becomes visible      props: { screen }
   *   'query_sent'           — user submits a message     props: { query, screen, is_suggestion }
   *   'suggestion_clicked'   — user clicks a suggestion   props: { suggestion_text, suggestion_index, screen }
   *   'conversation_cleared' — user clears the chat       props: { screen, messages_count }
   */
  onTrack?: (event: TrackEvent, props: Record<string, unknown>) => void;
}

// ── Layout constants ──────────────────────────────────────────────────────────

const HIDDEN_TRANSFORM: Record<PanelPosition, string> = {
  'right':        'translateX(100%)',
  'left':         'translateX(-100%)',
  'bottom-right': 'translateY(110%)',
  'bottom-left':  'translateY(110%)',
};

const PANEL_SIZE: Record<PanelPosition, string> = {
  'right':        'fixed right-0 top-0 h-full w-[420px] max-w-full',
  'left':         'fixed left-0 top-0 h-full w-[420px] max-w-full',
  'bottom-right': 'fixed bottom-5 right-5 h-[640px] w-[400px] rounded-2xl',
  'bottom-left':  'fixed bottom-5 left-5  h-[640px] w-[400px] rounded-2xl',
};

const ACCENT_DEFAULT = '#6366f1';

const DEFAULT_SUGGESTIONS = [
  'What are my top metrics this month?',
  'Where are costs growing fastest?',
  'Explain any unusual patterns',
] as const;

// ── Main component ────────────────────────────────────────────────────────────

export function AgentPanel({
  isOpen,
  onClose,
  agent,
  position     = 'right',
  title        = 'AI Assistant',
  subtitle,
  logoUrl,
  accentColor  = ACCENT_DEFAULT,
  screenLabel,
  suggestions  = DEFAULT_SUGGESTIONS,
  onFeedback,
  onTrack,
}: AgentPanelProps) {
  const {
    messages, isLoading, sendMessage, clearMessages, cancelRequest,
    threads, currentThreadId, newThread, switchThread, deleteThread,
  } = agent;

  const hasThreads = !!(threads && threads.length > 0 && newThread && switchThread);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [input,     setInput]     = useState('');
  const [feedback,  setFeedback]  = useState<Record<string, 'positive' | 'negative'>>({});
  const [mounted,   setMounted]   = useState(false);
  const [visible,   setVisible]   = useState(false);

  const scrollRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const trackedOpen = useRef(false);

  // ── Mount / unmount animation ──────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 340);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // ── Fire panel_opened once per open ───────────────────────────────────────
  useEffect(() => {
    if (visible && !trackedOpen.current) {
      trackedOpen.current = true;
      onTrack?.('panel_opened', { screen: screenLabel ?? null });
    }
    if (!visible) trackedOpen.current = false;
  }, [visible, screenLabel, onTrack]);

  // ── Auto-scroll on new messages ───────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Smooth scroll only if within 120px of bottom (user hasn't scrolled up)
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom || isLoading) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // ── Focus input on open ───────────────────────────────────────────────────
  useEffect(() => {
    if (visible) setTimeout(() => inputRef.current?.focus(), 80);
  }, [visible]);

  // ── Auto-resize textarea ──────────────────────────────────────────────────
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  // ── Handlers ──────────────────────────────────────────────────────────────

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

  const handleClose = useCallback(() => {
    cancelRequest?.();
    onClose();
  }, [cancelRequest, onClose]);

  // ── Render guard ──────────────────────────────────────────────────────────
  if (!mounted) return null;

  const panelTransform = visible ? 'translateX(0) translateY(0)' : HIDDEN_TRANSFORM[position];
  const isFloating = position === 'bottom-right' || position === 'bottom-left';

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={handleClose}
        style={{
          position:       'fixed',
          inset:          0,
          zIndex:         9998,
          background:     'rgba(10,15,30,0.35)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          opacity:        visible ? 1 : 0,
          transition:     'opacity 0.3s ease',
          pointerEvents:  visible ? 'auto' : 'none',
        }}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-label={title}
        aria-modal="true"
        className={`${PANEL_SIZE[position]} flex flex-col overflow-hidden bg-white shadow-2xl ${isFloating ? '' : 'border-l border-slate-200/70'}`}
        style={{
          zIndex:     9999,
          transform:  panelTransform,
          opacity:    visible ? 1 : 0,
          transition: 'transform 0.34s cubic-bezier(0.22,1,0.36,1), opacity 0.28s ease',
        }}
      >
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <PanelHeader
          title={title}
          subtitle={subtitle}
          logoUrl={logoUrl}
          accentColor={accentColor}
          screenLabel={screenLabel}
          isFloating={isFloating}
          messageCount={messages.length}
          hasThreads={hasThreads}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(o => !o)}
          onClear={handleClear}
          onClose={handleClose}
        />

        {/* ── Body (sidebar + messages) ─────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">

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

          {/* Message list */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto overscroll-contain scroll-smooth"
            style={{ background: '#f8f9fc' }}
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
              <div className="px-4 py-5 space-y-4">
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
                {isLoading && !messages.some(m => m.loading) && (
                  <TypingIndicator />
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Input area ───────────────────────────────────────────────────── */}
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

// ── PanelHeader ───────────────────────────────────────────────────────────────

function PanelHeader({
  title, subtitle, logoUrl, accentColor, screenLabel, isFloating,
  messageCount, hasThreads, sidebarOpen, onToggleSidebar, onClear, onClose,
}: {
  title: string; subtitle?: string; logoUrl?: string; accentColor: string;
  screenLabel?: string; isFloating: boolean; messageCount: number;
  hasThreads: boolean; sidebarOpen: boolean;
  onToggleSidebar: () => void; onClear: () => void; onClose: () => void;
}) {
  return (
    <header
      className={`shrink-0 flex items-center justify-between px-4 py-3 border-b border-black/[0.06] ${isFloating ? 'rounded-t-2xl' : ''}`}
      style={{ background: `linear-gradient(135deg, ${accentColor}f2 0%, ${accentColor}d0 100%)` }}
    >
      {/* Left: threads toggle + logo + title */}
      <div className="flex items-center gap-2 min-w-0">
        {hasThreads && (
          <button
            onClick={onToggleSidebar}
            title={sidebarOpen ? 'Hide threads' : 'Show threads'}
            className={`p-1.5 rounded-lg transition-colors shrink-0 ${sidebarOpen ? 'bg-white/25 text-white' : 'text-white/70 hover:text-white hover:bg-white/20'}`}
          >
            <MessageSquare size={15} strokeWidth={1.75} />
          </button>
        )}

        {logoUrl ? (
          <img src={logoUrl} alt={title} className="w-8 h-8 rounded-xl object-contain bg-white/20 p-1 shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0 backdrop-blur-sm">
            <Bot size={16} className="text-white" strokeWidth={2} />
          </div>
        )}

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white text-sm leading-tight truncate">{title}</h3>
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-300 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
            </span>
          </div>
          {(subtitle || screenLabel) && (
            <p className="text-[11px] text-white/70 leading-tight truncate mt-0.5">
              {subtitle ?? `Context: ${screenLabel}`}
            </p>
          )}
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-0.5 shrink-0">
        {messageCount > 0 && (
          <button
            onClick={onClear}
            title="Clear conversation"
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-colors"
          >
            <Trash2 size={15} strokeWidth={1.75} />
          </button>
        )}
        <button
          onClick={onClose}
          title="Close"
          className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-colors"
        >
          <X size={17} strokeWidth={2} />
        </button>
      </div>
    </header>
  );
}

// ── ThreadSidebar ─────────────────────────────────────────────────────────────

function ThreadSidebar({
  threads, currentThreadId, accentColor, onNew, onSwitch, onDelete,
}: {
  threads: Thread[];
  currentThreadId: string;
  accentColor: string;
  onNew: () => void;
  onSwitch: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  function relativeTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div
      className="w-[180px] shrink-0 flex flex-col border-r border-slate-100 bg-white overflow-hidden"
      style={{ background: '#fafafa' }}
    >
      {/* New thread button */}
      <button
        onClick={onNew}
        className="flex items-center gap-2 px-3 py-3 text-xs font-semibold border-b border-slate-100
                   hover:bg-slate-50 transition-colors w-full text-left"
        style={{ color: accentColor }}
      >
        <Plus size={13} strokeWidth={2.5} />
        New thread
      </button>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto">
        {threads.map(thread => {
          const isActive = thread.id === currentThreadId;
          const isHovered = hoveredId === thread.id;

          return (
            <div
              key={thread.id}
              className="relative group"
              onMouseEnter={() => setHoveredId(thread.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <button
                onClick={() => onSwitch(thread.id)}
                className={`w-full text-left px-3 py-2.5 transition-colors ${
                  isActive
                    ? 'bg-slate-100'
                    : 'hover:bg-slate-50'
                }`}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <span
                    className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r"
                    style={{ background: accentColor }}
                  />
                )}
                <p
                  className={`text-xs leading-snug line-clamp-2 pr-4 ${
                    isActive ? 'font-medium text-slate-800' : 'text-slate-600'
                  }`}
                >
                  {thread.title}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <Clock size={9} className="text-slate-300 shrink-0" />
                  <span className="text-[10px] text-slate-400">
                    {relativeTime(thread.updatedAt)}
                  </span>
                </div>
              </button>

              {/* Delete button — appears on hover */}
              {onDelete && isHovered && (
                <button
                  onClick={e => { e.stopPropagation(); onDelete(thread.id); }}
                  title="Delete thread"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded
                             text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
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
    <div className="h-full min-h-[400px] flex flex-col items-center justify-center px-6 pb-6 pt-8 text-center">
      {/* Icon / logo */}
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-md"
        style={{ background: `linear-gradient(135deg, ${accentColor}22 0%, ${accentColor}44 100%)` }}
      >
        {logoUrl ? (
          <img src={logoUrl} alt={title} className="w-10 h-10 object-contain" />
        ) : (
          <Sparkles size={28} strokeWidth={1.5} style={{ color: accentColor }} />
        )}
      </div>

      <h4 className="text-[15px] font-semibold text-slate-800">How can I help you?</h4>
      <p className="text-sm text-slate-400 mt-1.5 max-w-[280px] leading-relaxed">
        {screenLabel
          ? `Ask anything about your ${screenLabel} data — I'll pull live numbers.`
          : "Ask about your data, metrics, or trends and I’ll find the answers."}
      </p>

      {suggestions.length > 0 && (
        <div className="w-full mt-6 space-y-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center justify-center gap-1.5">
            <Zap size={10} className="text-slate-300" />
            Suggested questions
          </p>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => onSuggestion(s, i)}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-sm
                         text-slate-600 bg-white border border-slate-200/80 rounded-xl
                         hover:border-opacity-80 hover:shadow-sm active:scale-[0.99]
                         group transition-all duration-150"
              style={{
                // @ts-ignore
                '--hover-border': accentColor,
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = accentColor + '60')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '')}
            >
              <span className="leading-snug">{s}</span>
              <ChevronRight
                size={14}
                className="shrink-0 text-slate-300 group-hover:text-slate-500 transition-colors"
                style={{ color: '' }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── InputBar ──────────────────────────────────────────────────────────────────

const InputBar = React.forwardRef<
  HTMLTextAreaElement,
  {
    value: string; isLoading: boolean; accentColor: string; screenLabel?: string;
    onChange: (v: string) => void; onSend: () => void; onCancel?: () => void;
  }
>(({ value, isLoading, accentColor, screenLabel, onChange, onSend, onCancel }, ref) => {
  const canSend = !!value.trim() && !isLoading;

  return (
    <div className="shrink-0 bg-white border-t border-slate-100 px-3 pt-2.5 pb-3">
      <div
        className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2
                   focus-within:border-opacity-60 focus-within:shadow-sm transition-all"
        style={{ '--focus-color': accentColor } as React.CSSProperties}
        onFocusCapture={e => (e.currentTarget.style.borderColor = accentColor + '80')}
        onBlurCapture={e => (e.currentTarget.style.borderColor = '')}
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
          className="flex-1 resize-none bg-transparent text-sm text-slate-800 placeholder:text-slate-400
                     focus:outline-none disabled:opacity-50 leading-relaxed py-0.5"
          style={{ maxHeight: 120 }}
        />

        {/* Send / cancel */}
        {isLoading ? (
          <button
            onClick={onCancel}
            title="Stop generating"
            className="w-8 h-8 flex items-center justify-center rounded-xl shrink-0 mb-0.5
                       text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Loader2 size={16} className="animate-spin" />
          </button>
        ) : (
          <button
            onClick={onSend}
            disabled={!canSend}
            title="Send (Enter)"
            className="w-8 h-8 flex items-center justify-center rounded-xl shrink-0 mb-0.5
                       text-white shadow-sm active:scale-90
                       disabled:opacity-35 disabled:cursor-not-allowed transition-all"
            style={{ background: canSend ? accentColor : '#94a3b8' }}
          >
            <Send size={14} strokeWidth={2.5} />
          </button>
        )}
      </div>

      <p className="text-[10px] text-slate-300 text-center mt-1.5">
        {screenLabel && <><span className="text-slate-400 font-medium capitalize">{screenLabel}</span> · </>}
        Enter ↵ to send · Shift+Enter for new line
      </p>
    </div>
  );
});
InputBar.displayName = 'InputBar';

// ── TypingIndicator ───────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2.5">
      <AgentAvatar />
      <div className="bg-white border border-slate-100 shadow-sm rounded-2xl rounded-bl-sm px-4 py-3.5 flex gap-1.5 items-center">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
            style={{ animationDelay: `${i * 0.16}s`, animationDuration: '1s' }}
          />
        ))}
      </div>
    </div>
  );
}

// ── MessageBubble ─────────────────────────────────────────────────────────────

const INSIGHT_META = {
  warning:  { icon: AlertTriangle, bg: 'bg-amber-50',  border: 'border-amber-200', text: 'text-amber-800',  ic: 'text-amber-500' },
  positive: { icon: TrendingUp,    bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', ic: 'text-emerald-500' },
  neutral:  { icon: Info,          bg: 'bg-slate-50',  border: 'border-slate-200',  text: 'text-slate-700',  ic: 'text-slate-400' },
} as const;

function MessageBubble({
  message, accentColor, feedbackGiven, onFeedback, isLast,
}: {
  message:       AgentMessage;
  accentColor:   string;
  feedbackGiven?: 'positive' | 'negative';
  onFeedback:    (m: AgentMessage, t: 'positive' | 'negative') => void;
  isLast:        boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const text = message.response?.narrative ?? message.content ?? '';
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [message]);

  const timeLabel = useMemo(() =>
    new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    [message.timestamp],
  );

  // ── User message ───────────────────────────────────────────────────────────
  if (message.role === 'user') {
    return (
      <div className="flex justify-end items-end gap-2">
        <div
          className="max-w-[78%] text-sm text-white rounded-2xl rounded-br-sm px-4 py-2.5
                     leading-relaxed shadow-sm"
          style={{ background: accentColor }}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0 text-slate-500 text-[11px] font-bold">
          U
        </div>
      </div>
    );
  }

  // ── Loading bubble ─────────────────────────────────────────────────────────
  if (message.loading) {
    return <TypingIndicator />;
  }

  // ── Error bubble ───────────────────────────────────────────────────────────
  if (message.error) {
    return (
      <div className="flex items-start gap-2.5">
        <AgentAvatar error />
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-2xl rounded-tl-sm
                        px-4 py-3 leading-relaxed max-w-[82%]">
          <p className="font-medium text-xs text-red-400 mb-1">Something went wrong</p>
          <p>{message.error}</p>
        </div>
      </div>
    );
  }

  const res = message.response;
  const narrative = res?.narrative ?? message.content ?? '';

  // ── Assistant message ──────────────────────────────────────────────────────
  return (
    <div className="flex items-start gap-2.5 group">
      <AgentAvatar accentColor={accentColor} />

      <div className="flex-1 min-w-0 max-w-[85%] space-y-2">
        {/* Narrative */}
        <div className="bg-white border border-slate-100 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3
                        text-sm text-slate-800 leading-relaxed">
          <FormattedText text={narrative} />
        </div>

        {/* Insight cards */}
        {res?.insights?.map((ins, i) => {
          const meta = INSIGHT_META[ins.type as keyof typeof INSIGHT_META] ?? INSIGHT_META.neutral;
          return (
            <div
              key={i}
              className={`flex gap-2.5 rounded-xl px-3 py-2.5 text-xs border
                          ${meta.bg} ${meta.border}`}
            >
              <meta.icon size={13} className={`${meta.ic} shrink-0 mt-0.5`} strokeWidth={2} />
              <div className={meta.text}>
                <p className="font-semibold">{ins.title}</p>
                <p className="opacity-70 mt-0.5">{ins.detail}</p>
              </div>
            </div>
          );
        })}

        {/* Footer row */}
        <div className="flex items-center justify-between pl-0.5 pr-0.5">
          {/* Left: confidence + source + time */}
          <div className="flex items-center gap-2 text-[10px] text-slate-400 min-w-0">
            {res && (
              <>
                <ConfidenceBadge level={res.confidence} />
                {res.apisCalled?.length > 0 && (
                  <span className="truncate text-slate-400" title={res.apisCalled.join(', ')}>
                    via {res.apisCalled[0]}
                    {res.apisCalled.length > 1 ? ` +${res.apisCalled.length - 1}` : ''}
                  </span>
                )}
              </>
            )}
            <span className="text-slate-300 shrink-0">{timeLabel}</span>
          </div>

          {/* Right: copy + feedback */}
          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Copy */}
            <button
              onClick={handleCopy}
              title="Copy response"
              className="p-1.5 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors"
            >
              {copied ? <Check size={11} strokeWidth={2.5} className="text-emerald-500" /> : <Copy size={11} strokeWidth={2} />}
            </button>

            {/* Thumbs */}
            {(['positive', 'negative'] as const).map(type => (
              <button
                key={type}
                onClick={() => onFeedback(message, type)}
                disabled={!!feedbackGiven}
                title={type === 'positive' ? 'Good response' : 'Bad response'}
                className={`p-1.5 rounded-lg transition-all ${
                  feedbackGiven === type
                    ? type === 'positive' ? 'text-emerald-500 bg-emerald-50' : 'text-red-500 bg-red-50'
                    : feedbackGiven
                      ? 'text-slate-200 cursor-default'
                      : type === 'positive'
                        ? 'text-slate-300 hover:text-emerald-500 hover:bg-emerald-50'
                        : 'text-slate-300 hover:text-red-500 hover:bg-red-50'
                }`}
              >
                {type === 'positive'
                  ? <ThumbsUp size={11} strokeWidth={2} />
                  : <ThumbsDown size={11} strokeWidth={2} />
                }
              </button>
            ))}
            {feedbackGiven && (
              <span className="text-[10px] text-slate-300 ml-0.5">Thanks!</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AgentAvatar({ error, accentColor }: { error?: boolean; accentColor?: string }) {
  return (
    <div
      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${error ? 'bg-red-100' : ''}`}
      style={!error ? { background: `${accentColor ?? ACCENT_DEFAULT}22` } : undefined}
    >
      <Sparkles
        size={13}
        strokeWidth={2}
        style={{ color: error ? '#ef4444' : (accentColor ?? ACCENT_DEFAULT) }}
      />
    </div>
  );
}

function ConfidenceBadge({ level }: { level?: string }) {
  if (!level) return null;
  const styles: Record<string, string> = {
    high:   'bg-emerald-100 text-emerald-700',
    medium: 'bg-amber-100 text-amber-700',
    low:    'bg-slate-100 text-slate-500',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${styles[level] ?? styles.low}`}>
      {level}
    </span>
  );
}

/** Minimal inline-text formatter: **bold**, bullet lines starting with - or • */
function FormattedText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const isBullet = /^[\-•]\s/.test(line.trimStart());
        const trimmed  = isBullet ? line.trimStart().slice(2).trim() : line;
        const parts    = trimmed.split(/(\*\*[^*]+\*\*)/g);
        const rendered = parts.map((p, j) =>
          p.startsWith('**') && p.endsWith('**')
            ? <strong key={j} className="font-semibold text-slate-900">{p.slice(2, -2)}</strong>
            : <span key={j}>{p}</span>,
        );
        if (isBullet) {
          return (
            <div key={i} className="flex items-start gap-1.5">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-400 shrink-0" />
              <span>{rendered}</span>
            </div>
          );
        }
        return <p key={i} className={line.trim() === '' ? 'h-2' : ''}>{rendered}</p>;
      })}
    </div>
  );
}
