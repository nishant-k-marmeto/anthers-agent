import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Trash2, Send, Loader2, ThumbsUp, ThumbsDown, TrendingUp, AlertTriangle, Info, Sparkles, MessageSquare, ChevronRight, Bot, User, } from 'lucide-react';
// ── Animation helpers ─────────────────────────────────────────────────────────
// Map position → initial hidden transform so the panel slides in from the right direction
const HIDDEN_TRANSFORM = {
    'right': 'translateX(100%)',
    'left': 'translateX(-100%)',
    'bottom-right': 'translateY(100%)',
    'bottom-left': 'translateY(100%)',
};
const PANEL_BASE = {
    'right': 'fixed right-0 top-0 h-full w-[450px] border-l',
    'left': 'fixed left-0 top-0 h-full w-[450px] border-r',
    'bottom-right': 'fixed bottom-6 right-6 h-[600px] w-[400px] rounded-2xl border',
    'bottom-left': 'fixed bottom-6 left-6  h-[600px] w-[400px] rounded-2xl border',
};
const DEFAULT_SUGGESTIONS = [
    'What are my top metrics this month?',
    'Where are costs growing fastest?',
    'Explain any unusual patterns',
];
// ── Component ─────────────────────────────────────────────────────────────────
export function AgentPanel({ isOpen, onClose, agent, position = 'right', title = 'AI Assistant', logoUrl, screenLabel, suggestions = DEFAULT_SUGGESTIONS, onFeedback, onTrack, }) {
    const { messages, isLoading, sendMessage, clearMessages, cancelRequest } = agent;
    const [input, setInput] = useState('');
    const [feedback, setFeedback] = useState({});
    const [mounted, setMounted] = useState(false);
    const [visible, setVisible] = useState(false);
    const scrollRef = useRef(null);
    const inputRef = useRef(null);
    // Mount → trigger animation → unmount on close
    useEffect(() => {
        if (isOpen) {
            setMounted(true);
            // double rAF so the element is in the DOM before we set visible = true
            requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
        }
        else {
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
        if (visible)
            setTimeout(() => inputRef.current?.focus(), 50);
    }, [visible]);
    const handleSend = useCallback((text, isSuggestion = false) => {
        const query = (text ?? input).trim();
        if (!query || isLoading)
            return;
        onTrack?.('query_sent', { query, screen: screenLabel ?? null, is_suggestion: isSuggestion });
        sendMessage(query);
        setInput('');
    }, [input, isLoading, screenLabel, sendMessage, onTrack]);
    const handleSuggestion = useCallback((s, i) => {
        onTrack?.('suggestion_clicked', { suggestion_text: s, suggestion_index: i, screen: screenLabel ?? null });
        handleSend(s, true);
    }, [screenLabel, onTrack, handleSend]);
    const handleClear = useCallback(() => {
        if (!window.confirm('Clear conversation?'))
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
    if (!mounted)
        return null;
    const transform = visible ? 'translateX(0) translateY(0)' : HIDDEN_TRANSFORM[position];
    return (_jsxs(_Fragment, { children: [_jsx("div", { onClick: handleClose, style: {
                    position: 'fixed',
                    inset: 0,
                    zIndex: 9998,
                    background: 'rgba(15,23,42,0.25)',
                    backdropFilter: 'blur(2px)',
                    opacity: visible ? 1 : 0,
                    transition: 'opacity 0.3s ease',
                    pointerEvents: visible ? 'auto' : 'none',
                } }), _jsxs("div", { className: `${PANEL_BASE[position]} bg-white shadow-2xl border-slate-200 flex flex-col overflow-hidden`, style: {
                    zIndex: 9999,
                    transform,
                    opacity: visible ? 1 : 0,
                    transition: 'transform 0.32s cubic-bezier(0.32,0.72,0,1), opacity 0.32s ease',
                }, children: [_jsxs("header", { className: "flex items-center justify-between px-4 py-3.5 border-b border-slate-100 bg-white shrink-0", children: [_jsxs("div", { className: "flex items-center gap-3", children: [logoUrl ? (_jsx("img", { src: logoUrl, alt: title, className: "w-8 h-8 rounded-lg shadow-sm object-contain" })) : (_jsx("div", { className: "w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm", children: _jsx(Bot, { size: 18, strokeWidth: 2 }) })), _jsxs("div", { children: [_jsx("h3", { className: "font-semibold text-slate-800 text-sm leading-tight", children: title }), screenLabel && (_jsxs("span", { className: "text-[10px] font-bold uppercase tracking-wider text-slate-400", children: ["Context: ", screenLabel] }))] }), _jsxs("span", { className: "relative flex h-2 w-2 ml-1", children: [_jsx("span", { className: "animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" }), _jsx("span", { className: "relative inline-flex rounded-full h-2 w-2 bg-green-500" })] })] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("button", { onClick: handleClear, title: "Clear conversation", className: "p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors", children: _jsx(Trash2, { size: 15, strokeWidth: 1.75 }) }), _jsx("button", { onClick: handleClose, title: "Close", className: "p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors", children: _jsx(X, { size: 16, strokeWidth: 1.75 }) })] })] }), _jsxs("div", { ref: scrollRef, className: "flex-1 overflow-y-auto px-4 py-5 space-y-6 bg-white", children: [messages.length === 0 && (_jsxs("div", { className: "h-full flex flex-col items-center justify-center text-center space-y-4 px-6 opacity-90", children: [_jsx("div", { className: "w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500 shadow-sm", children: _jsx(MessageSquare, { size: 30, strokeWidth: 1.5 }) }), _jsxs("div", { children: [_jsx("h4", { className: "text-base font-semibold text-slate-700", children: "How can I help you today?" }), _jsx("p", { className: "text-sm text-slate-400 mt-1", children: screenLabel
                                                    ? `Ask me anything about your ${screenLabel} data.`
                                                    : 'Ask me about your data, metrics, or insights.' })] }), suggestions.length > 0 && (_jsxs("div", { className: "w-full pt-2 space-y-2", children: [_jsx("p", { className: "text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1", children: "Try asking" }), suggestions.map((s, i) => (_jsxs("button", { onClick: () => handleSuggestion(s, i), className: "w-full p-3 text-left text-sm text-slate-600 bg-slate-50\n                                 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200\n                                 border border-slate-200 rounded-xl transition-all group\n                                 flex items-center justify-between", children: [_jsx("span", { children: s }), _jsx(ChevronRight, { size: 14, className: "opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" })] }, i)))] }))] })), messages.map(msg => (_jsx(MessageBubble, { message: msg, feedbackGiven: feedback[msg.id], onFeedback: handleFeedback }, msg.id)))] }), _jsxs("div", { className: "px-4 pt-3 pb-4 border-t border-slate-100 bg-slate-50/60 shrink-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { ref: inputRef, type: "text", value: input, onChange: e => setInput(e.target.value), onKeyDown: e => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSend();
                                            }
                                        }, placeholder: "Type a message...", disabled: isLoading, className: "flex-1 text-sm bg-white border border-slate-200 rounded-xl px-4 py-2.5\n                         focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400\n                         disabled:opacity-50 placeholder:text-slate-400 transition-all" }), _jsx("button", { onClick: () => handleSend(), disabled: isLoading || !input.trim(), className: "w-10 h-10 flex items-center justify-center shrink-0 bg-indigo-600 text-white\n                         rounded-xl hover:bg-indigo-700 active:scale-95 shadow-sm\n                         disabled:opacity-40 disabled:cursor-not-allowed transition-all", children: isLoading
                                            ? _jsx(Loader2, { size: 16, className: "animate-spin" })
                                            : _jsx(Send, { size: 16, strokeWidth: 2 }) })] }), _jsxs("p", { className: "text-[10px] text-slate-400 mt-2 text-center", children: [screenLabel ? _jsxs(_Fragment, { children: [_jsx("span", { className: "capitalize font-medium", children: screenLabel }), " \u00B7 "] }) : null, "Enter \u21B5 to send"] })] })] })] }));
}
// ── Message bubble ────────────────────────────────────────────────────────────
const INSIGHT_STYLES = {
    warning: { icon: AlertTriangle, cls: 'bg-amber-50 border-amber-200', text: 'text-amber-800', ic: 'text-amber-500' },
    positive: { icon: TrendingUp, cls: 'bg-green-50 border-green-200', text: 'text-green-800', ic: 'text-green-500' },
    neutral: { icon: Info, cls: 'bg-slate-50 border-slate-200', text: 'text-slate-700', ic: 'text-slate-400' },
};
function MessageBubble({ message, feedbackGiven, onFeedback, }) {
    // User message
    if (message.role === 'user') {
        return (_jsx("div", { className: "flex justify-end", children: _jsxs("div", { className: "flex gap-2.5 flex-row-reverse items-end max-w-[82%]", children: [_jsx("div", { className: "w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0", children: _jsx(User, { size: 14, className: "text-slate-500" }) }), _jsx("div", { className: "bg-indigo-600 text-white text-sm rounded-2xl rounded-tr-sm px-4 py-2.5 leading-relaxed shadow-sm", children: message.content })] }) }));
    }
    // Loading bubble
    if (message.loading) {
        return (_jsxs("div", { className: "flex gap-2.5 items-end", children: [_jsx(AgentAvatar, {}), _jsx("div", { className: "bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3.5", children: _jsx("div", { className: "flex gap-1.5 items-center", children: [0, 1, 2].map(i => (_jsx("div", { className: "w-2 h-2 bg-slate-400 rounded-full animate-bounce", style: { animationDelay: `${i * 0.15}s` } }, i))) }) })] }));
    }
    // Error bubble
    if (message.error) {
        return (_jsxs("div", { className: "flex gap-2.5 items-end", children: [_jsx(AgentAvatar, { error: true }), _jsx("div", { className: "bg-red-50 border border-red-200 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-red-600 leading-relaxed max-w-[82%]", children: message.error })] }));
    }
    const res = message.response;
    return (_jsxs("div", { className: "flex gap-2.5 items-start", children: [_jsx(AgentAvatar, {}), _jsxs("div", { className: "flex-1 min-w-0 space-y-2.5 max-w-[85%]", children: [_jsx("div", { className: "bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-800 leading-relaxed", children: res?.narrative ?? message.content }), res?.insights?.map((insight, i) => {
                        const s = INSIGHT_STYLES[insight.type] ?? INSIGHT_STYLES.neutral;
                        return (_jsxs("div", { className: `flex gap-2.5 rounded-xl px-3 py-2.5 text-xs border ${s.cls}`, children: [_jsx(s.icon, { size: 13, className: `${s.ic} shrink-0 mt-0.5`, strokeWidth: 2 }), _jsxs("div", { className: s.text, children: [_jsx("p", { className: "font-semibold", children: insight.title }), _jsx("p", { className: "opacity-75 mt-0.5", children: insight.detail })] })] }, i));
                    }), res && (_jsxs("div", { className: "flex items-center justify-between pt-0.5 px-0.5", children: [_jsxs("div", { className: "flex items-center gap-2 text-[10px] text-slate-400 min-w-0", children: [_jsx("span", { className: `px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${res.confidence === 'high' ? 'bg-green-100 text-green-700' :
                                            res.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-slate-100 text-slate-500'}`, children: res.confidence }), res.apisCalled?.length > 0 && (_jsxs("span", { className: "truncate", title: res.apisCalled.join(', '), children: ["via ", res.apisCalled[0], res.apisCalled.length > 1 ? ` +${res.apisCalled.length - 1}` : ''] })), _jsx("span", { className: "shrink-0 text-slate-300", children: new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })] }), _jsxs("div", { className: "flex items-center gap-1 shrink-0", children: [['positive', 'negative'].map(type => (_jsx("button", { onClick: () => onFeedback(message, type), disabled: !!feedbackGiven, title: type === 'positive' ? 'Good response' : 'Bad response', className: `p-1.5 rounded-lg transition-all ${feedbackGiven === type
                                            ? type === 'positive' ? 'text-green-600 bg-green-100' : 'text-red-500 bg-red-100'
                                            : feedbackGiven
                                                ? 'text-slate-300 cursor-default'
                                                : type === 'positive'
                                                    ? 'text-slate-400 hover:text-green-600 hover:bg-green-50'
                                                    : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`, children: type === 'positive'
                                            ? _jsx(ThumbsUp, { size: 12, strokeWidth: 2 })
                                            : _jsx(ThumbsDown, { size: 12, strokeWidth: 2 }) }, type))), feedbackGiven && (_jsx("span", { className: "text-[10px] text-slate-400 ml-0.5", children: "Thanks!" }))] })] }))] })] }));
}
function AgentAvatar({ error }) {
    return (_jsx("div", { className: `w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${error ? 'bg-red-100' : 'bg-indigo-100'}`, children: _jsx(Sparkles, { size: 13, strokeWidth: 2, className: error ? 'text-red-500' : 'text-indigo-600' }) }));
}
//# sourceMappingURL=panel.js.map