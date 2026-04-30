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
import type { AgentMessage } from './types';
export type PanelPosition = 'right' | 'left' | 'bottom-right' | 'bottom-left';
export type TrackEvent = 'query_sent' | 'suggestion_clicked' | 'conversation_cleared' | 'panel_opened';
export interface AgentHookResult {
    messages: AgentMessage[];
    isLoading: boolean;
    sendMessage: (msg: string) => void;
    clearMessages: () => void;
    cancelRequest?: () => void;
}
export interface AgentPanelProps {
    isOpen: boolean;
    onClose: () => void;
    /** Pass the result of your useAgent() hook directly */
    agent: AgentHookResult;
    position?: PanelPosition;
    title?: string;
    subtitle?: string;
    logoUrl?: string;
    accentColor?: string;
    screenLabel?: string;
    suggestions?: readonly string[];
    /** Called when user thumbs-up/down an assistant message */
    onFeedback?: (messageId: string, type: 'positive' | 'negative') => void;
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
export declare function AgentPanel({ isOpen, onClose, agent, position, title, subtitle, logoUrl, accentColor, screenLabel, suggestions, onFeedback, onTrack, }: AgentPanelProps): import("react/jsx-runtime").JSX.Element | null;
//# sourceMappingURL=panel.d.ts.map