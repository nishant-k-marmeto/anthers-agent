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
export class AgentClient {
    constructor(cfg) {
        this.cfg = cfg;
        this.token = null;
        this.loginPromise = null; // dedupe concurrent login calls
    }
    // ── Auth ──────────────────────────────────────────────────────────────────
    async login() {
        // If a login is already in-flight (e.g. two components mount simultaneously),
        // return the same promise instead of firing two requests.
        if (this.loginPromise)
            return this.loginPromise;
        this.loginPromise = (async () => {
            const res = await fetch(`${this.cfg.agentUrl}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: this.cfg.username, password: this.cfg.password }),
            });
            if (res.status === 401)
                throw new Error('Invalid credentials — check username/password');
            if (!res.ok)
                throw new Error(`Login failed: ${res.status}`);
            const data = await res.json();
            this.token = data.token;
            return data;
        })().finally(() => {
            this.loginPromise = null; // allow future re-login (e.g. after token expiry)
        });
        return this.loginPromise;
    }
    getToken() { return this.token; }
    setToken(t) { this.token = t; } // use when your app handles auth externally
    logout() { this.token = null; }
    // ── Core ──────────────────────────────────────────────────────────────────
    async analyse(opts) {
        // Auto-login on first call — no manual login() required in setup code
        if (!this.token)
            await this.login();
        const res = await fetch(`${this.cfg.agentUrl}/analyse`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`,
            },
            signal: opts.signal,
            body: JSON.stringify({
                userMessage: opts.userMessage,
                pageContext: opts.pageContext ?? { screen: { type: 'business' }, filters: {} },
                authToken: opts.authToken ?? '',
                apiRegistry: [],
            }),
        });
        // Token expired mid-session — re-login once and retry transparently
        if (res.status === 401) {
            this.token = null;
            await this.login();
            return this.analyse(opts);
        }
        if (res.status === 429)
            throw new Error('AI quota exceeded. Try again shortly.');
        if (!res.ok)
            throw new Error(`Analyse failed: ${res.status}`);
        return res.json();
    }
}
//# sourceMappingURL=client.js.map