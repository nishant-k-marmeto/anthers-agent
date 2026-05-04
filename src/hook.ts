/**
 * createUseAgent — React hook factory with localStorage thread persistence.
 *
 * ── Setup (once, outside any component) ──────────────────────────────────────
 *
 *   import { AgentClient, createUseAgent } from 'anthers-agent';
 *
 *   const client = new AgentClient({ agentUrl, username, password });
 *   client.login().catch(console.error);
 *
 *   export const useAgent = createUseAgent(client, {
 *     storageKey:     'nexus_agent_threads',   // localStorage key (default: 'agent_threads')
 *     maxThreads:     20,                       // prune oldest beyond this (default: 20)
 *     getPageContext: () => ({
 *       screen:  { type: 'product' },
 *       filters: { dateFrom: null, dateTo: null },
 *     }),
 *     getAuthToken: () => localStorage.getItem('authToken') ?? '',
 *   });
 *
 * ── Inside any component ──────────────────────────────────────────────────────
 *
 *   const {
 *     messages, isLoading, sendMessage, clearMessages, cancelRequest,
 *     threads, currentThreadId,
 *     newThread, switchThread, deleteThread,
 *   } = useAgent();
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { AgentClient }    from './client';
import type { AgentMessage, AgentResponse, Thread } from './types';

// ── Storage helpers ───────────────────────────────────────────────────────────

function loadThreads(key: string): Thread[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Thread[];
    // Revive Date objects inside messages
    return parsed.map(t => ({
      ...t,
      messages: t.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) })),
    }));
  } catch {
    return [];
  }
}

function saveThreads(key: string, threads: Thread[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(threads));
  } catch {
    // localStorage quota exceeded — silently ignore
  }
}

function makeThreadTitle(firstMessage: string): string {
  const clean = firstMessage.trim().replace(/\s+/g, ' ');
  return clean.length > 40 ? clean.slice(0, 37) + '…' : clean;
}

function createThread(screenType: string): Thread {
  const now = new Date().toISOString();
  return {
    id:         crypto.randomUUID(),
    title:      'New conversation',
    screenType,
    messages:   [],
    createdAt:  now,
    updatedAt:  now,
  };
}

// ── Hook options ──────────────────────────────────────────────────────────────

export interface UseAgentOptions {
  /** localStorage key — change per product to avoid collisions. Default: 'agent_threads' */
  storageKey?:     string;
  /** Max threads to keep — oldest pruned when exceeded. Default: 20 */
  maxThreads?:     number;
  /** Called on every sendMessage — returns live page context. */
  getPageContext?: () => Record<string, unknown>;
  /** Returns your product user's auth token forwarded to backend APIs. */
  getAuthToken?:   () => string;
}

// ── Return type ───────────────────────────────────────────────────────────────

export interface UseAgentResult {
  // Chat
  messages:      AgentMessage[];
  isLoading:     boolean;
  sendMessage:   (msg: string) => void;
  clearMessages: () => void;
  cancelRequest: () => void;

  // Threads
  threads:         Thread[];
  currentThreadId: string;
  newThread:       () => void;
  switchThread:    (id: string) => void;
  deleteThread:    (id: string) => void;
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createUseAgent(client: AgentClient, opts: UseAgentOptions = {}) {
  const STORAGE_KEY = opts.storageKey ?? 'agent_threads';
  const MAX_THREADS = opts.maxThreads ?? 20;

  return function useAgent(): UseAgentResult {
    const getScreenType = () =>
      (opts.getPageContext?.() as any)?.screen?.type ?? 'general';

    // ── Initialise from localStorage ─────────────────────────────────────────
    const [threads, setThreads] = useState<Thread[]>(() => {
      const stored = loadThreads(STORAGE_KEY);
      if (stored.length > 0) return stored;
      return [createThread(getScreenType())];
    });

    const [currentThreadId, setCurrentThreadId] = useState<string>(
      () => {
        const stored = loadThreads(STORAGE_KEY);
        return stored[0]?.id ?? threads[0]?.id;
      },
    );

    const [isLoading, setIsLoading] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    // ── Persist to localStorage whenever threads change ───────────────────────
    useEffect(() => {
      saveThreads(STORAGE_KEY, threads);
    }, [threads]);

    // ── Current thread messages (derived) ────────────────────────────────────
    const currentThread = threads.find(t => t.id === currentThreadId) ?? threads[0];
    const messages = currentThread?.messages ?? [];

    // ── Update a single thread in the list ───────────────────────────────────
    const updateThread = useCallback((id: string, updater: (t: Thread) => Thread) => {
      setThreads(prev => prev.map(t => t.id === id ? updater(t) : t));
    }, []);

    // ── sendMessage ───────────────────────────────────────────────────────────
    const sendMessage = useCallback(async (userMessage: string) => {
      if (!userMessage.trim() || isLoading) return;

      const pageContext = opts.getPageContext?.() ?? { screen: { type: 'general' }, filters: {} };
      const authToken  = opts.getAuthToken?.() ?? '';
      const threadId   = currentThreadId;

      const userMsg: AgentMessage = {
        id:        crypto.randomUUID(),
        role:      'user',
        content:   userMessage,
        timestamp: new Date(),
      };
      const loadingId = crypto.randomUUID();
      const loadingMsg: AgentMessage = {
        id:        loadingId,
        role:      'agent',
        content:   '',
        timestamp: new Date(),
        loading:   true,
      };

      // Optimistic update — add bubbles + auto-title on first message
      updateThread(threadId, t => ({
        ...t,
        title:     t.messages.filter(m => m.role === 'user').length === 0
                     ? makeThreadTitle(userMessage)
                     : t.title,
        messages:  [...t.messages, userMsg, loadingMsg],
        updatedAt: new Date().toISOString(),
      }));

      setIsLoading(true);
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      try {
        const data: AgentResponse = await client.analyse({
          userMessage,
          pageContext,
          authToken,
          signal: abortRef.current.signal,
        });

        updateThread(threadId, t => ({
          ...t,
          messages: t.messages.map(m =>
            m.id === loadingId
              ? { ...m, content: data.narrative, response: data, loading: false }
              : m,
          ),
          updatedAt: new Date().toISOString(),
        }));
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        updateThread(threadId, t => ({
          ...t,
          messages: t.messages.map(m =>
            m.id === loadingId
              ? { ...m, loading: false, error: err.message ?? 'Something went wrong.' }
              : m,
          ),
          updatedAt: new Date().toISOString(),
        }));
      } finally {
        setIsLoading(false);
      }
    }, [isLoading, currentThreadId, updateThread]);

    // ── clearMessages — wipe messages in current thread only ──────────────────
    const clearMessages = useCallback(() => {
      updateThread(currentThreadId, t => ({
        ...t,
        title:     'New conversation',
        messages:  [],
        updatedAt: new Date().toISOString(),
      }));
    }, [currentThreadId, updateThread]);

    // ── cancelRequest ─────────────────────────────────────────────────────────
    const cancelRequest = useCallback(() => {
      abortRef.current?.abort();
      setIsLoading(false);
      // Remove the dangling loading bubble
      updateThread(currentThreadId, t => ({
        ...t,
        messages: t.messages.filter(m => !m.loading),
      }));
    }, [currentThreadId, updateThread]);

    // ── newThread ─────────────────────────────────────────────────────────────
    const newThread = useCallback(() => {
      const thread = createThread(getScreenType());
      setThreads(prev => {
        const updated = [thread, ...prev];
        return updated.length > MAX_THREADS ? updated.slice(0, MAX_THREADS) : updated;
      });
      setCurrentThreadId(thread.id);
    }, []);

    // ── switchThread ──────────────────────────────────────────────────────────
    const switchThread = useCallback((id: string) => {
      abortRef.current?.abort();
      setIsLoading(false);
      setCurrentThreadId(id);
    }, []);

    // ── deleteThread ──────────────────────────────────────────────────────────
    const deleteThread = useCallback((id: string) => {
      setThreads(prev => {
        const remaining = prev.filter(t => t.id !== id);
        if (id === currentThreadId) {
          if (remaining.length > 0) {
            setCurrentThreadId(remaining[0].id);
          } else {
            const fresh = createThread(getScreenType());
            setCurrentThreadId(fresh.id);
            return [fresh];
          }
        }
        return remaining;
      });
    }, [currentThreadId]);

    return {
      messages,
      isLoading,
      sendMessage,
      clearMessages,
      cancelRequest,
      threads,
      currentThreadId,
      newThread,
      switchThread,
      deleteThread,
    };
  };
}
