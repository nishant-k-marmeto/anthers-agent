/**
 * AgentClient — the single entry point for any product to talk to the
 * agent microservice.
 *
 * ── Setup (do once, outside any component) ───────────────────────────────────
 *
 *   import { AgentClient } from '@your-org/agent-sdk';
 *
 *   export const agentClient = new AgentClient({
 *     agentUrl: 'https://agent-ms.your-domain.com',
 *     username: 'product2',
 *     password: 'product2123',
 *   });
 *
 *   // Call once in your app bootstrap / auth flow:
 *   await agentClient.login();
 *
 * ── Usage ─────────────────────────────────────────────────────────────────────
 *
 *   const result = await agentClient.analyse({
 *     userMessage: 'What were our top expenses last month?',
 *   });
 *   console.log(result.narrative);
 */
import type { AgentClientConfig, AgentResponse } from './types';
export interface AnalyseOptions {
    /** The user's question */
    userMessage: string;
    /**
     * Current page context.  At minimum: { screen: { type: string }, filters: {} }
     * Anything extra is forwarded to the agent as-is.
     */
    pageContext?: Record<string, unknown>;
    /**
     * Your product's auth token for the logged-in user.
     * Forwarded to MCP tools and DB tools so they can fetch per-user data.
     */
    authToken?: string;
    /** Cancel an in-flight request */
    signal?: AbortSignal;
}
export interface LoginResult {
    token: string;
    role: string;
    clientName: string;
}
export declare class AgentClient {
    private readonly cfg;
    private token;
    private loginPromise;
    constructor(cfg: AgentClientConfig);
    login(): Promise<LoginResult>;
    getToken(): string | null;
    setToken(t: string): void;
    logout(): void;
    analyse(opts: AnalyseOptions): Promise<AgentResponse>;
}
//# sourceMappingURL=client.d.ts.map