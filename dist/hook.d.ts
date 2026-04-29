/**
 * createUseAgent — React hook factory.  Works with any product.
 *
 * ── Setup (once, outside any component) ─────────────────────────────────────
 *
 *   import { AgentClient, createUseAgent } from '@your-org/agent-sdk';
 *
 *   const client = new AgentClient({ agentUrl, username, password });
 *   await client.login();   // in your app bootstrap or auth flow
 *
 *   export const useAgent = createUseAgent(client, {
 *     getPageContext: () => ({
 *       screen:  { type: window.__MY_APP_CTX__?.screenType ?? 'business' },
 *       filters: { dateFrom: window.__MY_APP_CTX__?.dateFrom ?? null,
 *                  dateTo:   window.__MY_APP_CTX__?.dateTo   ?? null },
 *     }),
 *     getAuthToken: () => localStorage.getItem('user_token') ?? '',
 *   });
 *
 * ── Inside any component ──────────────────────────────────────────────────────
 *
 *   const { messages, isLoading, sendMessage, clearMessages, cancelRequest } = useAgent();
 */
import { AgentClient } from './client';
import type { AgentMessage } from './types';
export interface UseAgentOptions {
    /**
     * Called on every sendMessage — returns the page context at that moment.
     * Always reflects live state (e.g. current date filter, current screen).
     */
    getPageContext?: () => Record<string, unknown>;
    /**
     * Returns your product user's auth token — forwarded to your backend
     * via the tool executor so APIs can identify who is asking.
     */
    getAuthToken?: () => string;
}
export declare function createUseAgent(client: AgentClient, opts?: UseAgentOptions): () => {
    messages: AgentMessage[];
    isLoading: boolean;
    sendMessage: (userMessage: string) => Promise<void>;
    clearMessages: () => void;
    cancelRequest: () => void;
};
//# sourceMappingURL=hook.d.ts.map