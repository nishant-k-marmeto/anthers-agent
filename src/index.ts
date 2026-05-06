// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  AgentClientConfig,
  AgentResponse,
  AgentMessage,
  AgentInsight,
  AgentFile,
  Thread,
  ApiDefinition,
  ApiParameter,
} from './types';

// ── Client ────────────────────────────────────────────────────────────────────
export { AgentClient }       from './client';
export type { AnalyseOptions, LoginResult } from './client';

// ── React hook ────────────────────────────────────────────────────────────────
export { createUseAgent }    from './hook';
export type { UseAgentOptions, UseAgentResult } from './hook';

// ── UI panel ─────────────────────────────────────────────────────────────────
export { AgentPanel }        from './panel';
export type { AgentPanelProps, AgentHookResult, PanelPosition } from './panel';

// ── Registry ─────────────────────────────────────────────────────────────────
export { createRegistry, buildVisionRegistry, dateParams, pageParams } from './registry';
export type { Registry } from './registry';
