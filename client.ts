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

import type { AgentClientConfig, AgentResponse, Thread } from './types';

export interface AnalyseOptions {
  /** The user's question */
  userMessage:  string;
  /**
   * Current page context.  At minimum: { screen: { type: string }, filters: {} }
   * Anything extra is forwarded to the agent as-is.
   */
  pageContext?: Record<string, unknown>;
  /**
   * Your product's auth token for the logged-in user.
   * Forwarded to MCP tools and DB tools so they can fetch per-user data.
   */
  authToken?:  string;
  /** Cancel an in-flight request */
  signal?:     AbortSignal;
}

export interface LoginResult {
  token:      string;
  role:       string;
  clientName: string;
}

export class AgentClient {
  private token:        string | null  = null;
  private loginPromise: Promise<LoginResult> | null = null; // dedupe concurrent login calls

  constructor(private readonly cfg: AgentClientConfig) {}

  // ── Auth ──────────────────────────────────────────────────────────────────

  async login(): Promise<LoginResult> {
    // If a login is already in-flight (e.g. two components mount simultaneously),
    // return the same promise instead of firing two requests.
    if (this.loginPromise) return this.loginPromise;

    this.loginPromise = (async () => {
      const res = await fetch(`${this.cfg.agentUrl}/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username: this.cfg.username, password: this.cfg.password }),
      });
      if (res.status === 401) throw new Error('Invalid credentials — check username/password');
      if (!res.ok)            throw new Error(`Login failed: ${res.status}`);

      const data: LoginResult = await res.json();
      this.token = data.token;
      return data;
    })().finally(() => {
      this.loginPromise = null; // allow future re-login (e.g. after token expiry)
    });

    return this.loginPromise;
  }

  getToken(): string | null { return this.token; }
  setToken(t: string)       { this.token = t; }  // use when your app handles auth externally
  logout()                  { this.token = null; }

  // ── Core ──────────────────────────────────────────────────────────────────

  async analyse(opts: AnalyseOptions): Promise<AgentResponse> {
    // Auto-login on first call — no manual login() required in setup code
    if (!this.token) await this.login();

    const res = await fetch(`${this.cfg.agentUrl}/analyse`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      signal: opts.signal,
      body: JSON.stringify({
        userMessage: opts.userMessage,
        pageContext: opts.pageContext ?? { screen: { type: 'business' }, filters: {} },
        authToken:   opts.authToken  ?? '',
        apiRegistry: [],
      }),
    });

    // Token expired mid-session — re-login once and retry transparently
    if (res.status === 401) {
      this.token = null;
      await this.login();
      return this.analyse(opts);
    }

    if (res.status === 429) throw new Error('AI quota exceeded. Try again shortly.');
    if (!res.ok)            throw new Error(`Analyse failed: ${res.status}`);

    return res.json() as Promise<AgentResponse>;
  }

  // ── Conversation persistence API ──────────────────────────────────────────

  /** Upsert a thread by its client-side external_id. Safe to call multiple times. */
  async upsertThread(thread: Pick<Thread, 'id' | 'title' | 'screenType'>): Promise<{ id: string }> {
    if (!this.token) await this.login();
    const res = await fetch(`${this.cfg.agentUrl}/threads`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
      body: JSON.stringify({
        external_id: thread.id,
        title:       thread.title,
        screen_type: thread.screenType,
      }),
    });
    if (!res.ok) throw new Error(`upsertThread failed: ${res.status}`);
    return res.json();
  }

  /** Push a batch of messages to a thread (identified by its DB id returned from upsertThread). */
  async syncMessages(dbThreadId: string, messages: Array<{
    external_id: string;
    role:        'user' | 'agent';
    content:     string;
    metadata?:   Record<string, unknown>;
    created_at?: string;
  }>): Promise<void> {
    if (!this.token) await this.login();
    const res = await fetch(`${this.cfg.agentUrl}/threads/${dbThreadId}/messages/bulk`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
      body: JSON.stringify({ messages }),
    });
    if (!res.ok) throw new Error(`syncMessages failed: ${res.status}`);
  }

  /** List all threads from DB for this client. */
  async listThreads(): Promise<Array<Thread & { message_count: number }>> {
    if (!this.token) await this.login();
    const res = await fetch(`${this.cfg.agentUrl}/threads`, {
      headers: { 'Authorization': `Bearer ${this.token}` },
    });
    if (!res.ok) throw new Error(`listThreads failed: ${res.status}`);
    const rows = await res.json() as any[];
    // Normalise snake_case from DB → camelCase for SDK
    return rows.map(r => ({
      id:           r.external_id ?? r.id,   // SDK always works with external_id
      _dbId:        r.id,                    // keep DB id for message sync
      title:        r.title,
      screenType:   r.screen_type ?? 'general',
      messages:     [],                       // messages loaded lazily
      createdAt:    r.created_at,
      updatedAt:    r.updated_at,
      message_count: r.message_count ?? 0,
    }));
  }

  /** Update a thread's title in DB. */
  async renameThread(dbThreadId: string, title: string): Promise<void> {
    if (!this.token) await this.login();
    await fetch(`${this.cfg.agentUrl}/threads/${dbThreadId}/title`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
      body: JSON.stringify({ title }),
    });
  }

  /** Delete a thread and all its messages from DB. */
  async deleteThreadFromDb(dbThreadId: string): Promise<void> {
    if (!this.token) await this.login();
    await fetch(`${this.cfg.agentUrl}/threads/${dbThreadId}`, {
      method:  'DELETE',
      headers: { 'Authorization': `Bearer ${this.token}` },
    });
  }
}
