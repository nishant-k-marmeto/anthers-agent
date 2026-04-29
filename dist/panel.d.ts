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
import type { AgentMessage } from './types';
export type PanelPosition = 'right' | 'left' | 'bottom-right' | 'bottom-left';
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
    logoUrl?: string;
    screenLabel?: string;
    suggestions?: readonly string[];
    onFeedback?: (messageId: string, type: 'positive' | 'negative') => void;
    /**
     * Analytics hook — all user interactions fire through here.
     * Events:
     *   'query_sent'           — user sends a message     props: { query, screen, is_suggestion }
     *   'suggestion_clicked'   — user clicks a suggestion props: { suggestion_text, suggestion_index, screen }
     *   'conversation_cleared' — user clears the chat     props: { screen, messages_count }
     */
    onTrack?: (event: 'query_sent' | 'suggestion_clicked' | 'conversation_cleared', props: Record<string, unknown>) => void;
}
export declare function AgentPanel({ isOpen, onClose, agent, position, title, logoUrl, screenLabel, suggestions, onFeedback, onTrack, }: AgentPanelProps): import("react/jsx-runtime").JSX.Element | null;
//# sourceMappingURL=panel.d.ts.map