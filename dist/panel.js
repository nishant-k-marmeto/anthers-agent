import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
import React, { useState, useRef, useEffect, useCallback, useMemo, } from 'react';
import { X, Trash2, Send, Loader2, ThumbsUp, ThumbsDown, TrendingUp, AlertTriangle, Info, Sparkles, ChevronRight, Bot, Zap, Copy, Check, } from 'lucide-react';
// ── Layout constants ──────────────────────────────────────────────────────────
const HIDDEN_TRANSFORM = {
    'right': 'translateX(100%)',
    'left': 'translateX(-100%)',
    'bottom-right': 'translateY(110%)',
    'bottom-left': 'translateY(110%)',
};
const PANEL_SIZE = {
    'right': 'fixed right-0 top-0 h-full w-[420px] max-w-full',
    'left': 'fixed left-0 top-0 h-full w-[420px] max-w-full',
    'bottom-right': 'fixed bottom-5 right-5 h-[640px] w-[400px] rounded-2xl',
    'bottom-left': 'fixed bottom-5 left-5  h-[640px] w-[400px] rounded-2xl',
};
const ACCENT_DEFAULT = '#6366f1';
const DEFAULT_SUGGESTIONS = [
    'What are my top metrics this month?',
    'Where are costs growing fastest?',
    'Explain any unusual patterns',
];
// ── Main component ────────────────────────────────────────────────────────────
export function AgentPanel({ isOpen, onClose, agent, position = 'right', title = 'AI Assistant', subtitle, logoUrl, accentColor = ACCENT_DEFAULT, screenLabel, suggestions = DEFAULT_SUGGESTIONS, onFeedback, onTrack, }) {
    const { messages, isLoading, sendMessage, clearMessages, cancelRequest } = agent;
    const [input, setInput] = useState('');
    const [feedback, setFeedback] = useState({});
    const [mounted, setMounted] = useState(false);
    const [visible, setVisible] = useState(false);
    const scrollRef = useRef(null);
    const inputRef = useRef(null);
    const trackedOpen = useRef(false);
    // ── Mount / unmount animation ──────────────────────────────────────────────
    useEffect(() => {
        if (isOpen) {
            setMounted(true);
            requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
        }
        else {
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
        if (!visible)
            trackedOpen.current = false;
    }, [visible, screenLabel, onTrack]);
    // ── Auto-scroll on new messages ───────────────────────────────────────────
    useEffect(() => {
        const el = scrollRef.current;
        if (!el)
            return;
        // Smooth scroll only if within 120px of bottom (user hasn't scrolled up)
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        if (nearBottom || isLoading) {
            el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        }
    }, [messages, isLoading]);
    // ── Focus input on open ───────────────────────────────────────────────────
    useEffect(() => {
        if (visible)
            setTimeout(() => inputRef.current?.focus(), 80);
    }, [visible]);
    // ── Auto-resize textarea ──────────────────────────────────────────────────
    useEffect(() => {
        const el = inputRef.current;
        if (!el)
            return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }, [input]);
    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleSend = useCallback((text, isSuggestion = false) => {
        const query = (text ?? input).trim();
        if (!query || isLoading)
            return;
        onTrack?.('query_sent', { query, screen: screenLabel ?? null, is_suggestion: isSuggestion });
        sendMessage(query);
        setInput('');
        if (inputRef.current)
            inputRef.current.style.height = 'auto';
    }, [input, isLoading, screenLabel, sendMessage, onTrack]);
    const handleSuggestion = useCallback((s, i) => {
        onTrack?.('suggestion_clicked', { suggestion_text: s, suggestion_index: i, screen: screenLabel ?? null });
        handleSend(s, true);
    }, [screenLabel, onTrack, handleSend]);
    const handleClear = useCallback(() => {
        if (!window.confirm('Clear this conversation?'))
            return;
        onTrack?.('conversation_cleared', { screen: screenLabel ?? null, messages_count: messages.length });
        clearMessages();
        setFeedback({});
    }, [screenLabel, messages.length, clearMessages, onTrack]);
    const handleFeedback = useCallback((msg, type) => {
        if (feedback[msg.id])
            return;
        setFeedback(prev => ({ ...prev, [msg.id]: type }));
        onFeedback?.(msg.id, type);
    }, [feedback, onFeedback]);
    const handleClose = useCallback(() => {
        cancelRequest?.();
        onClose();
    }, [cancelRequest, onClose]);
    // ── Render guard ──────────────────────────────────────────────────────────
    if (!mounted)
        return null;
    const panelTransform = visible ? 'translateX(0) translateY(0)' : HIDDEN_TRANSFORM[position];
    const isFloating = position === 'bottom-right' || position === 'bottom-left';
    return (_jsxs(_Fragment, { children: [_jsx("div", { "aria-hidden": true, onClick: handleClose, style: {
                    position: 'fixed',
                    inset: 0,
                    zIndex: 9998,
                    background: 'rgba(10,15,30,0.35)',
                    backdropFilter: 'blur(3px)',
                    WebkitBackdropFilter: 'blur(3px)',
                    opacity: visible ? 1 : 0,
                    transition: 'opacity 0.3s ease',
                    pointerEvents: visible ? 'auto' : 'none',
                } }), _jsxs("div", { role: "dialog", "aria-label": title, "aria-modal": "true", className: `${PANEL_SIZE[position]} flex flex-col overflow-hidden bg-white shadow-2xl ${isFloating ? '' : 'border-l border-slate-200/70'}`, style: {
                    zIndex: 9999,
                    transform: panelTransform,
                    opacity: visible ? 1 : 0,
                    transition: 'transform 0.34s cubic-bezier(0.22,1,0.36,1), opacity 0.28s ease',
                }, children: [_jsx(PanelHeader, { title: title, subtitle: subtitle, logoUrl: logoUrl, accentColor: accentColor, screenLabel: screenLabel, isFloating: isFloating, messageCount: messages.length, onClear: handleClear, onClose: handleClose }), _jsx("div", { ref: scrollRef, className: "flex-1 overflow-y-auto overscroll-contain scroll-smooth", style: { background: '#f8f9fc' }, children: messages.length === 0 ? (_jsx(EmptyState, { title: title, logoUrl: logoUrl, accentColor: accentColor, screenLabel: screenLabel, suggestions: suggestions, onSuggestion: handleSuggestion })) : (_jsxs("div", { className: "px-4 py-5 space-y-4", children: [messages.map((msg, idx) => (_jsx(MessageBubble, { message: msg, accentColor: accentColor, feedbackGiven: feedback[msg.id], onFeedback: handleFeedback, isLast: idx === messages.length - 1 }, msg.id))), isLoading && !messages.some(m => m.loading) && (_jsx(TypingIndicator, {}))] })) }), _jsx(InputBar, { ref: inputRef, value: input, isLoading: isLoading, accentColor: accentColor, screenLabel: screenLabel, onChange: setInput, onSend: () => handleSend(), onCancel: cancelRequest })] })] }));
}
// ── PanelHeader ───────────────────────────────────────────────────────────────
function PanelHeader({ title, subtitle, logoUrl, accentColor, screenLabel, isFloating, messageCount, onClear, onClose, }) {
    return (_jsxs("header", { className: `shrink-0 flex items-center justify-between px-4 py-3 border-b border-black/[0.06] ${isFloating ? 'rounded-t-2xl' : ''}`, style: { background: `linear-gradient(135deg, ${accentColor}f2 0%, ${accentColor}d0 100%)` }, children: [_jsxs("div", { className: "flex items-center gap-3 min-w-0", children: [logoUrl ? (_jsx("img", { src: logoUrl, alt: title, className: "w-9 h-9 rounded-xl object-contain bg-white/20 p-1 shrink-0" })) : (_jsx("div", { className: "w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0 backdrop-blur-sm", children: _jsx(Bot, { size: 18, className: "text-white", strokeWidth: 2 }) })), _jsxs("div", { className: "min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("h3", { className: "font-semibold text-white text-sm leading-tight truncate", children: title }), _jsxs("span", { className: "relative flex h-2 w-2 shrink-0", children: [_jsx("span", { className: "animate-ping absolute inline-flex h-full w-full rounded-full bg-green-300 opacity-75" }), _jsx("span", { className: "relative inline-flex h-2 w-2 rounded-full bg-green-400" })] })] }), (subtitle || screenLabel) && (_jsx("p", { className: "text-[11px] text-white/70 leading-tight truncate mt-0.5", children: subtitle ?? `Context: ${screenLabel}` }))] })] }), _jsxs("div", { className: "flex items-center gap-0.5 shrink-0", children: [messageCount > 0 && (_jsx("button", { onClick: onClear, title: "Clear conversation", className: "p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-colors", children: _jsx(Trash2, { size: 15, strokeWidth: 1.75 }) })), _jsx("button", { onClick: onClose, title: "Close", className: "p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-colors", children: _jsx(X, { size: 17, strokeWidth: 2 }) })] })] }));
}
// ── EmptyState ────────────────────────────────────────────────────────────────
function EmptyState({ title, logoUrl, accentColor, screenLabel, suggestions, onSuggestion, }) {
    return (_jsxs("div", { className: "h-full min-h-[400px] flex flex-col items-center justify-center px-6 pb-6 pt-8 text-center", children: [_jsx("div", { className: "w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-md", style: { background: `linear-gradient(135deg, ${accentColor}22 0%, ${accentColor}44 100%)` }, children: logoUrl ? (_jsx("img", { src: logoUrl, alt: title, className: "w-10 h-10 object-contain" })) : (_jsx(Sparkles, { size: 28, strokeWidth: 1.5, style: { color: accentColor } })) }), _jsx("h4", { className: "text-[15px] font-semibold text-slate-800", children: "How can I help you?" }), _jsx("p", { className: "text-sm text-slate-400 mt-1.5 max-w-[280px] leading-relaxed", children: screenLabel
                    ? `Ask anything about your ${screenLabel} data — I'll pull live numbers.`
                    : "Ask about your data, metrics, or trends and I’ll find the answers." }), suggestions.length > 0 && (_jsxs("div", { className: "w-full mt-6 space-y-2", children: [_jsxs("p", { className: "text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center justify-center gap-1.5", children: [_jsx(Zap, { size: 10, className: "text-slate-300" }), "Suggested questions"] }), suggestions.map((s, i) => (_jsxs("button", { onClick: () => onSuggestion(s, i), className: "w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-sm\n                         text-slate-600 bg-white border border-slate-200/80 rounded-xl\n                         hover:border-opacity-80 hover:shadow-sm active:scale-[0.99]\n                         group transition-all duration-150", style: {
                            // @ts-ignore
                            '--hover-border': accentColor,
                        }, onMouseEnter: e => (e.currentTarget.style.borderColor = accentColor + '60'), onMouseLeave: e => (e.currentTarget.style.borderColor = ''), children: [_jsx("span", { className: "leading-snug", children: s }), _jsx(ChevronRight, { size: 14, className: "shrink-0 text-slate-300 group-hover:text-slate-500 transition-colors", style: { color: '' } })] }, i)))] }))] }));
}
// ── InputBar ──────────────────────────────────────────────────────────────────
const InputBar = React.forwardRef(({ value, isLoading, accentColor, screenLabel, onChange, onSend, onCancel }, ref) => {
    const canSend = !!value.trim() && !isLoading;
    return (_jsxs("div", { className: "shrink-0 bg-white border-t border-slate-100 px-3 pt-2.5 pb-3", children: [_jsxs("div", { className: "flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2\n                   focus-within:border-opacity-60 focus-within:shadow-sm transition-all", style: { '--focus-color': accentColor }, onFocusCapture: e => (e.currentTarget.style.borderColor = accentColor + '80'), onBlurCapture: e => (e.currentTarget.style.borderColor = ''), children: [_jsx("textarea", { ref: ref, rows: 1, value: value, onChange: e => onChange(e.target.value), onKeyDown: e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                onSend();
                            }
                        }, placeholder: "Ask me anything\u2026", disabled: isLoading, className: "flex-1 resize-none bg-transparent text-sm text-slate-800 placeholder:text-slate-400\n                     focus:outline-none disabled:opacity-50 leading-relaxed py-0.5", style: { maxHeight: 120 } }), isLoading ? (_jsx("button", { onClick: onCancel, title: "Stop generating", className: "w-8 h-8 flex items-center justify-center rounded-xl shrink-0 mb-0.5\n                       text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors", children: _jsx(Loader2, { size: 16, className: "animate-spin" }) })) : (_jsx("button", { onClick: onSend, disabled: !canSend, title: "Send (Enter)", className: "w-8 h-8 flex items-center justify-center rounded-xl shrink-0 mb-0.5\n                       text-white shadow-sm active:scale-90\n                       disabled:opacity-35 disabled:cursor-not-allowed transition-all", style: { background: canSend ? accentColor : '#94a3b8' }, children: _jsx(Send, { size: 14, strokeWidth: 2.5 }) }))] }), _jsxs("p", { className: "text-[10px] text-slate-300 text-center mt-1.5", children: [screenLabel && _jsxs(_Fragment, { children: [_jsx("span", { className: "text-slate-400 font-medium capitalize", children: screenLabel }), " \u00B7 "] }), "Enter \u21B5 to send \u00B7 Shift+Enter for new line"] })] }));
});
InputBar.displayName = 'InputBar';
// ── TypingIndicator ───────────────────────────────────────────────────────────
function TypingIndicator() {
    return (_jsxs("div", { className: "flex items-end gap-2.5", children: [_jsx(AgentAvatar, {}), _jsx("div", { className: "bg-white border border-slate-100 shadow-sm rounded-2xl rounded-bl-sm px-4 py-3.5 flex gap-1.5 items-center", children: [0, 1, 2].map(i => (_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce", style: { animationDelay: `${i * 0.16}s`, animationDuration: '1s' } }, i))) })] }));
}
// ── MessageBubble ─────────────────────────────────────────────────────────────
const INSIGHT_META = {
    warning: { icon: AlertTriangle, bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', ic: 'text-amber-500' },
    positive: { icon: TrendingUp, bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', ic: 'text-emerald-500' },
    neutral: { icon: Info, bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', ic: 'text-slate-400' },
};
function MessageBubble({ message, accentColor, feedbackGiven, onFeedback, isLast, }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = useCallback(() => {
        const text = message.response?.narrative ?? message.content ?? '';
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [message]);
    const timeLabel = useMemo(() => new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), [message.timestamp]);
    // ── User message ───────────────────────────────────────────────────────────
    if (message.role === 'user') {
        return (_jsxs("div", { className: "flex justify-end items-end gap-2", children: [_jsx("div", { className: "max-w-[78%] text-sm text-white rounded-2xl rounded-br-sm px-4 py-2.5\n                     leading-relaxed shadow-sm", style: { background: accentColor }, children: _jsx("p", { className: "whitespace-pre-wrap break-words", children: message.content }) }), _jsx("div", { className: "w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0 text-slate-500 text-[11px] font-bold", children: "U" })] }));
    }
    // ── Loading bubble ─────────────────────────────────────────────────────────
    if (message.loading) {
        return _jsx(TypingIndicator, {});
    }
    // ── Error bubble ───────────────────────────────────────────────────────────
    if (message.error) {
        return (_jsxs("div", { className: "flex items-start gap-2.5", children: [_jsx(AgentAvatar, { error: true }), _jsxs("div", { className: "bg-red-50 border border-red-200 text-red-600 text-sm rounded-2xl rounded-tl-sm\n                        px-4 py-3 leading-relaxed max-w-[82%]", children: [_jsx("p", { className: "font-medium text-xs text-red-400 mb-1", children: "Something went wrong" }), _jsx("p", { children: message.error })] })] }));
    }
    const res = message.response;
    const narrative = res?.narrative ?? message.content ?? '';
    // ── Assistant message ──────────────────────────────────────────────────────
    return (_jsxs("div", { className: "flex items-start gap-2.5 group", children: [_jsx(AgentAvatar, { accentColor: accentColor }), _jsxs("div", { className: "flex-1 min-w-0 max-w-[85%] space-y-2", children: [_jsx("div", { className: "bg-white border border-slate-100 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3\n                        text-sm text-slate-800 leading-relaxed", children: _jsx(FormattedText, { text: narrative }) }), res?.insights?.map((ins, i) => {
                        const meta = INSIGHT_META[ins.type] ?? INSIGHT_META.neutral;
                        return (_jsxs("div", { className: `flex gap-2.5 rounded-xl px-3 py-2.5 text-xs border
                          ${meta.bg} ${meta.border}`, children: [_jsx(meta.icon, { size: 13, className: `${meta.ic} shrink-0 mt-0.5`, strokeWidth: 2 }), _jsxs("div", { className: meta.text, children: [_jsx("p", { className: "font-semibold", children: ins.title }), _jsx("p", { className: "opacity-70 mt-0.5", children: ins.detail })] })] }, i));
                    }), _jsxs("div", { className: "flex items-center justify-between pl-0.5 pr-0.5", children: [_jsxs("div", { className: "flex items-center gap-2 text-[10px] text-slate-400 min-w-0", children: [res && (_jsxs(_Fragment, { children: [_jsx(ConfidenceBadge, { level: res.confidence }), res.apisCalled?.length > 0 && (_jsxs("span", { className: "truncate text-slate-400", title: res.apisCalled.join(', '), children: ["via ", res.apisCalled[0], res.apisCalled.length > 1 ? ` +${res.apisCalled.length - 1}` : ''] }))] })), _jsx("span", { className: "text-slate-300 shrink-0", children: timeLabel })] }), _jsxs("div", { className: "flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity", children: [_jsx("button", { onClick: handleCopy, title: "Copy response", className: "p-1.5 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors", children: copied ? _jsx(Check, { size: 11, strokeWidth: 2.5, className: "text-emerald-500" }) : _jsx(Copy, { size: 11, strokeWidth: 2 }) }), ['positive', 'negative'].map(type => (_jsx("button", { onClick: () => onFeedback(message, type), disabled: !!feedbackGiven, title: type === 'positive' ? 'Good response' : 'Bad response', className: `p-1.5 rounded-lg transition-all ${feedbackGiven === type
                                            ? type === 'positive' ? 'text-emerald-500 bg-emerald-50' : 'text-red-500 bg-red-50'
                                            : feedbackGiven
                                                ? 'text-slate-200 cursor-default'
                                                : type === 'positive'
                                                    ? 'text-slate-300 hover:text-emerald-500 hover:bg-emerald-50'
                                                    : 'text-slate-300 hover:text-red-500 hover:bg-red-50'}`, children: type === 'positive'
                                            ? _jsx(ThumbsUp, { size: 11, strokeWidth: 2 })
                                            : _jsx(ThumbsDown, { size: 11, strokeWidth: 2 }) }, type))), feedbackGiven && (_jsx("span", { className: "text-[10px] text-slate-300 ml-0.5", children: "Thanks!" }))] })] })] })] }));
}
// ── Sub-components ────────────────────────────────────────────────────────────
function AgentAvatar({ error, accentColor }) {
    return (_jsx("div", { className: `w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${error ? 'bg-red-100' : ''}`, style: !error ? { background: `${accentColor ?? ACCENT_DEFAULT}22` } : undefined, children: _jsx(Sparkles, { size: 13, strokeWidth: 2, style: { color: error ? '#ef4444' : (accentColor ?? ACCENT_DEFAULT) } }) }));
}
function ConfidenceBadge({ level }) {
    if (!level)
        return null;
    const styles = {
        high: 'bg-emerald-100 text-emerald-700',
        medium: 'bg-amber-100 text-amber-700',
        low: 'bg-slate-100 text-slate-500',
    };
    return (_jsx("span", { className: `px-1.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${styles[level] ?? styles.low}`, children: level }));
}
/** Minimal inline-text formatter: **bold**, bullet lines starting with - or • */
function FormattedText({ text }) {
    const lines = text.split('\n');
    return (_jsx("div", { className: "space-y-1", children: lines.map((line, i) => {
            const isBullet = /^[\-•]\s/.test(line.trimStart());
            const trimmed = isBullet ? line.trimStart().slice(2).trim() : line;
            const parts = trimmed.split(/(\*\*[^*]+\*\*)/g);
            const rendered = parts.map((p, j) => p.startsWith('**') && p.endsWith('**')
                ? _jsx("strong", { className: "font-semibold text-slate-900", children: p.slice(2, -2) }, j)
                : _jsx("span", { children: p }, j));
            if (isBullet) {
                return (_jsxs("div", { className: "flex items-start gap-1.5", children: [_jsx("span", { className: "mt-1.5 w-1 h-1 rounded-full bg-slate-400 shrink-0" }), _jsx("span", { children: rendered })] }, i));
            }
            return _jsx("p", { className: line.trim() === '' ? 'h-2' : '', children: rendered }, i);
        }) }));
}
//# sourceMappingURL=panel.js.map