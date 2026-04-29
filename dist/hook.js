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
import { useState, useCallback, useRef } from 'react';
export function createUseAgent(client, opts = {}) {
    return function useAgent() {
        const [messages, setMessages] = useState([]);
        const [isLoading, setIsLoading] = useState(false);
        const abortRef = useRef(null);
        const sendMessage = useCallback(async (userMessage) => {
            if (!userMessage.trim() || isLoading)
                return;
            const pageContext = opts.getPageContext?.() ?? {
                screen: { type: 'business' }, filters: {},
            };
            const authToken = opts.getAuthToken?.() ?? '';
            // Optimistic UI — add both bubbles immediately
            const userMsg = { id: crypto.randomUUID(), role: 'user', content: userMessage, timestamp: new Date() };
            const loadingId = crypto.randomUUID();
            const loadingMsg = { id: loadingId, role: 'agent', content: '', timestamp: new Date(), loading: true };
            setMessages(prev => [...prev, userMsg, loadingMsg]);
            setIsLoading(true);
            abortRef.current?.abort();
            abortRef.current = new AbortController();
            try {
                const data = await client.analyse({
                    userMessage, pageContext, authToken,
                    signal: abortRef.current.signal,
                });
                setMessages(prev => prev.map(m => m.id === loadingId
                    ? { ...m, content: data.narrative, response: data, loading: false }
                    : m));
            }
            catch (err) {
                if (err.name === 'AbortError')
                    return;
                setMessages(prev => prev.map(m => m.id === loadingId
                    ? { ...m, loading: false, error: err.message ?? 'Something went wrong.' }
                    : m));
            }
            finally {
                setIsLoading(false);
            }
        }, [isLoading]);
        const clearMessages = useCallback(() => setMessages([]), []);
        const cancelRequest = useCallback(() => { abortRef.current?.abort(); setIsLoading(false); }, []);
        return { messages, isLoading, sendMessage, clearMessages, cancelRequest };
    };
}
//# sourceMappingURL=hook.js.map