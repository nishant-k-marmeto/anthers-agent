/**
 * AgentPanel — plug-and-play chat panel UI with backdrop + slide-in animation.
 *
 * No external animation library required — pure CSS transitions.
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
 * ── All props ─────────────────────────────────────────────────────────────────
 *
 *   <AgentPanel
 *     isOpen={open}
 *     onClose={() => setOpen(false)}
 *     agent={agent}
 *     position="right"               // 'right' | 'left' | 'bottom-right' | 'bottom-left'
 *     title="Vision Agent"
 *     logoUrl="https://..."
 *     screenLabel="finance"
 *     suggestions={['Revenue trends', 'Cost anomalies']}
 *     onFeedback={(id, type) => analytics.track('feedback', { id, type })}
 *     onTrack={(event, props) => mixpanel.track(event, props)}
 *     // Events: 'query_sent' | 'suggestion_clicked' | 'conversation_cleared'
 *   />
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, Trash2, Send, Loader2,
  ThumbsUp, ThumbsDown,
  TrendingUp, AlertTriangle, Info,
  Sparkles, MessageSquare, ChevronRight,
  Bot, User,
} from 'lucide-react';
import type { AgentMessage } from './types';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PanelPosition = 'right' | 'left' | 'bottom-right' | 'bottom-left';

export interface AgentHookResult {
  messages:       AgentMessage[];
  isLoading:      boolean;
  sendMessage:    (msg: string) => void;
  clearMessages:  () => void;
  cancelRequest?: () => void;
}

export interface AgentPanelProps {
  isOpen:       boolean;
  onClose:      () => void;
  /** Pass the result of your useAgent() hook directly */
  agent:        AgentHookResult;
  position?:    PanelPosition;      // default: 'right'
  title?:       string;             // default: 'AI Assistant'
  logoUrl?:     string;             // shown in header + empty state
  screenLabel?: string;             // context chip e.g. 'finance'
  suggestions?: readonly string[];  // shown on empty state
  onFeedback?:  (messageId: string, type: 'positive' | 'negative') => void;
  /**
   * Analytics hook — all user interactions fire through here.
   * Events:
   *   'query_sent'           — user sends a message     props: { query, screen, is_suggestion }
   *   'suggestion_clicked'   — user clicks a suggestion props: { suggestion_text, suggestion_index, screen }
   *   'conversation_cleared' — user clears the chat     props: { screen, messages_count }
   */
  onTrack?: (
    event: 'query_sent' | 'suggestion_clicked' | 'conversation_cleared',
    props:  Record<string, unknown>,
  ) => void;
}

// ── Animation helpers ─────────────────────────────────────────────────────────

// Map position → initial hidden transform so the panel slides in from the right direction
const HIDDEN_TRANSFORM: Record<PanelPosition, string> = {
  'right':        'translateX(100%)',
  'left':         'translateX(-100%)',
  'bottom-right': 'translateY(100%)',
  'bottom-left':  'translateY(100%)',
};

const PANEL_BASE: Record<PanelPosition, string> = {
  'right':        'fixed right-0 top-0 h-full w-[450px] border-l',
  'left':         'fixed left-0 top-0 h-full w-[450px] border-r',
  'bottom-right': 'fixed bottom-6 right-6 h-[600px] w-[400px] rounded-2xl border',
  'bottom-left':  'fixed bottom-6 left-6  h-[600px] w-[400px] rounded-2xl border',
};

const DEFAULT_SUGGESTIONS = [
  'What are my top metrics this month?',
  'Where are costs growing fastest?',
  'Explain any unusual patterns',
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export function AgentPanel({
  isOpen,
  onClose,
  agent,
  position    = 'right',
  title       = 'AI Assistant',
  logoUrl,
  screenLabel,
  suggestions = DEFAULT_SUGGESTIONS,
  onFeedback,
  onTrack,
}: AgentPanelProps) {
  const { messages, isLoading, sendMessage, clearMessages, cancelRequest } = agent;

  const [input,     setInput]     = useState('');
  const [feedback,  setFeedback]  = useState<Record<string, 'positive' | 'negative'>>({});
  const [mounted,   setMounted]   = useState(false);
  const [visible,   setVisible]   = useState(false);

  const scrollRef   = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);

  // Mount → trigger animation → unmount on close
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      // double rAF so the element is in the DOM before we set visible = true
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 320);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Auto-scroll to bottom when new message arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Focus input when panel opens
  useEffect(() => {
    if (visible) setTimeout(() => inputRef.current?.focus(), 50);
  }, [visible]);

  const handleSend = useCallback((text?: string, isSuggestion = false) => {
    const query = (text ?? input).trim();
    if (!query || isLoading) return;
    onTrack?.('query_sent', { query, screen: screenLabel ?? null, is_suggestion: isSuggestion });
    sendMessage(query);
    setInput('');
  }, [input, isLoading, screenLabel, sendMessage, onTrack]);

  const handleSuggestion = useCallback((s: string, i: number) => {
    onTrack?.('suggestion_clicked', { suggestion_text: s, suggestion_index: i, screen: screenLabel ?? null });
    handleSend(s, true);
  }, [screenLabel, onTrack, handleSend]);

  const handleClear = useCallback(() => {
    if (!window.confirm('Clear conversation?')) return;
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

  if (!mounted) return null;

  const transform = visible ? 'translateX(0) translateY(0)' : HIDDEN_TRANSFORM[position];

  return (
    <>
      {/* ── Backdrop ──────────────────────────────────────────── */}
      <div
        onClick={handleClose}
        style={{
          position:   'fixed',
          inset:      0,
          zIndex:     9998,
          background: 'rgba(15,23,42,0.25)',
          backdropFilter: 'blur(2px)',
          opacity:    visible ? 1 : 0,
          transition: 'opacity 0.3s ease',
          pointerEvents: visible ? 'auto' : 'none',
        }}
      />

      {/* ── Panel ─────────────────────────────────────────────── */}
      <div
        className={`${PANEL_BASE[position]} bg-white shadow-2xl border-slate-200 flex flex-col overflow-hidden`}
        style={{
          zIndex:     9999,
          transform,
          opacity:    visible ? 1 : 0,
          transition: 'transform 0.32s cubic-bezier(0.32,0.72,0,1), opacity 0.32s ease',
        }}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={title} className="w-8 h-8 rounded-lg shadow-sm object-contain" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                <Bot size={18} strokeWidth={2} />
              </div>
            )}
            <div>
              <h3 className="font-semibold text-slate-800 text-sm leading-tight">{title}</h3>
              {screenLabel && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Context: {screenLabel}
                </span>
              )}
            </div>
            {/* Online indicator */}
            <span className="relative flex h-2 w-2 ml-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleClear}
              title="Clear conversation"
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 size={15} strokeWidth={1.75} />
            </button>
            <button
              onClick={handleClose}
              title="Close"
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </div>
        </header>

        {/* Messages area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-5 space-y-6 bg-white"
        >
          {/* Empty state */}
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 px-6 opacity-90">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500 shadow-sm">
                <MessageSquare size={30} strokeWidth={1.5} />
              </div>
              <div>
                <h4 className="text-base font-semibold text-slate-700">How can I help you today?</h4>
                <p className="text-sm text-slate-400 mt-1">
                  {screenLabel
                    ? `Ask me anything about your ${screenLabel} data.`
                    : 'Ask me about your data, metrics, or insights.'}
                </p>
              </div>

              {suggestions.length > 0 && (
                <div className="w-full pt-2 space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    Try asking
                  </p>
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestion(s, i)}
                      className="w-full p-3 text-left text-sm text-slate-600 bg-slate-50
                                 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200
                                 border border-slate-200 rounded-xl transition-all group
                                 flex items-center justify-between"
                    >
                      <span>{s}</span>
                      <ChevronRight
                        size={14}
                        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Message list */}
          {messages.map(msg => (
            <MessageBubble
              key={msg.id}
              message={msg}
              feedbackGiven={feedback[msg.id]}
              onFeedback={handleFeedback}
            />
          ))}
        </div>

        {/* Input area */}
        <div className="px-4 pt-3 pb-4 border-t border-slate-100 bg-slate-50/60 shrink-0">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              placeholder="Type a message..."
              disabled={isLoading}
              className="flex-1 text-sm bg-white border border-slate-200 rounded-xl px-4 py-2.5
                         focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400
                         disabled:opacity-50 placeholder:text-slate-400 transition-all"
            />
            <button
              onClick={() => handleSend()}
              disabled={isLoading || !input.trim()}
              className="w-10 h-10 flex items-center justify-center shrink-0 bg-indigo-600 text-white
                         rounded-xl hover:bg-indigo-700 active:scale-95 shadow-sm
                         disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isLoading
                ? <Loader2 size={16} className="animate-spin" />
                : <Send size={16} strokeWidth={2} />
              }
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 text-center">
            {screenLabel ? <><span className="capitalize font-medium">{screenLabel}</span> · </> : null}
            Enter ↵ to send
          </p>
        </div>
      </div>
    </>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

const INSIGHT_STYLES = {
  warning:  { icon: AlertTriangle, cls: 'bg-amber-50 border-amber-200', text: 'text-amber-800', ic: 'text-amber-500' },
  positive: { icon: TrendingUp,    cls: 'bg-green-50 border-green-200',  text: 'text-green-800', ic: 'text-green-500' },
  neutral:  { icon: Info,          cls: 'bg-slate-50 border-slate-200',  text: 'text-slate-700', ic: 'text-slate-400' },
} as const;

function MessageBubble({
  message,
  feedbackGiven,
  onFeedback,
}: {
  message:       AgentMessage;
  feedbackGiven?: 'positive' | 'negative';
  onFeedback:    (m: AgentMessage, t: 'positive' | 'negative') => void;
}) {
  // User message
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="flex gap-2.5 flex-row-reverse items-end max-w-[82%]">
          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
            <User size={14} className="text-slate-500" />
          </div>
          <div className="bg-indigo-600 text-white text-sm rounded-2xl rounded-tr-sm px-4 py-2.5 leading-relaxed shadow-sm">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  // Loading bubble
  if (message.loading) {
    return (
      <div className="flex gap-2.5 items-end">
        <AgentAvatar />
        <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3.5">
          <div className="flex gap-1.5 items-center">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error bubble
  if (message.error) {
    return (
      <div className="flex gap-2.5 items-end">
        <AgentAvatar error />
        <div className="bg-red-50 border border-red-200 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-red-600 leading-relaxed max-w-[82%]">
          {message.error}
        </div>
      </div>
    );
  }

  const res = message.response;

  return (
    <div className="flex gap-2.5 items-start">
      <AgentAvatar />
      <div className="flex-1 min-w-0 space-y-2.5 max-w-[85%]">
        {/* Main narrative bubble */}
        <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-800 leading-relaxed">
          {res?.narrative ?? message.content}
        </div>

        {/* Insight cards */}
        {res?.insights?.map((insight, i) => {
          const s = INSIGHT_STYLES[insight.type as keyof typeof INSIGHT_STYLES] ?? INSIGHT_STYLES.neutral;
          return (
            <div key={i} className={`flex gap-2.5 rounded-xl px-3 py-2.5 text-xs border ${s.cls}`}>
              <s.icon size={13} className={`${s.ic} shrink-0 mt-0.5`} strokeWidth={2} />
              <div className={s.text}>
                <p className="font-semibold">{insight.title}</p>
                <p className="opacity-75 mt-0.5">{insight.detail}</p>
              </div>
            </div>
          );
        })}

        {/* Footer: confidence + apis called + feedback */}
        {res && (
          <div className="flex items-center justify-between pt-0.5 px-0.5">
            {/* Left: confidence + api source */}
            <div className="flex items-center gap-2 text-[10px] text-slate-400 min-w-0">
              <span className={`px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${
                res.confidence === 'high'   ? 'bg-green-100 text-green-700'  :
                res.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                              'bg-slate-100 text-slate-500'
              }`}>
                {res.confidence}
              </span>
              {res.apisCalled?.length > 0 && (
                <span className="truncate" title={res.apisCalled.join(', ')}>
                  via {res.apisCalled[0]}{res.apisCalled.length > 1 ? ` +${res.apisCalled.length - 1}` : ''}
                </span>
              )}
              <span className="shrink-0 text-slate-300">
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* Right: thumbs feedback */}
            <div className="flex items-center gap-1 shrink-0">
              {(['positive', 'negative'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => onFeedback(message, type)}
                  disabled={!!feedbackGiven}
                  title={type === 'positive' ? 'Good response' : 'Bad response'}
                  className={`p-1.5 rounded-lg transition-all ${
                    feedbackGiven === type
                      ? type === 'positive' ? 'text-green-600 bg-green-100' : 'text-red-500 bg-red-100'
                      : feedbackGiven
                        ? 'text-slate-300 cursor-default'
                        : type === 'positive'
                          ? 'text-slate-400 hover:text-green-600 hover:bg-green-50'
                          : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                  }`}
                >
                  {type === 'positive'
                    ? <ThumbsUp size={12} strokeWidth={2} />
                    : <ThumbsDown size={12} strokeWidth={2} />
                  }
                </button>
              ))}
              {feedbackGiven && (
                <span className="text-[10px] text-slate-400 ml-0.5">Thanks!</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AgentAvatar({ error }: { error?: boolean }) {
  return (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
      error ? 'bg-red-100' : 'bg-indigo-100'
    }`}>
      <Sparkles size={13} strokeWidth={2} className={error ? 'text-red-500' : 'text-indigo-600'} />
    </div>
  );
}
