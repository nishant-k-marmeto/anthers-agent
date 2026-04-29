/**
 * Registry system — define which API endpoints the AI can call, per screen.
 *
 * ── Concept ───────────────────────────────────────────────────────────────────
 *
 * A "registry" maps screen names → lists of API definitions.
 * The AI reads the definitions to know what to call and when.
 *
 * ── How to define your own (boilerplate) ─────────────────────────────────────
 *
 *   import { createRegistry, dateParams } from '@your-org/agent-sdk';
 *
 *   export const myRegistry = createRegistry('https://api.my-product.com', {
 *
 *     dashboard: [
 *       {
 *         name:        'get_orders',
 *         description: 'Fetches order list. Use when user asks about orders, purchases or transactions.',
 *         endpoint:    '/orders',           // ← relative path, baseUrl is prepended
 *         method:      'GET',
 *         parameters:  [
 *           ...dateParams,                  // ← reuse common date params
 *           { name: 'status', type: 'string', required: false, description: 'Filter by order status' },
 *         ],
 *       },
 *       {
 *         name:        'get_revenue',
 *         description: 'Fetches revenue summary. Use for revenue, income or sales questions.',
 *         endpoint:    '/analytics/revenue',
 *         method:      'GET',
 *         parameters:  dateParams,
 *       },
 *     ],
 *
 *     support: [
 *       {
 *         name:        'get_tickets',
 *         description: 'Fetches open support tickets.',
 *         endpoint:    '/support/tickets',
 *         method:      'GET',
 *         parameters:  [],
 *       },
 *     ],
 *
 *   });
 *
 * ── Usage in your hook ────────────────────────────────────────────────────────
 *
 *   export const useAgent = createUseAgent(client, {
 *     getPageContext: () => ({
 *       screen:      { type: currentScreenName },
 *       apiRegistry: myRegistry.forScreen(currentScreenName),
 *     }),
 *   });
 *
 * ── Extending an existing registry ───────────────────────────────────────────
 *
 *   import { visionRegistry } from '@your-org/agent-sdk';
 *
 *   const extended = visionRegistry.extend('custom-screen', [
 *     { name: 'get_custom', description: '...', endpoint: '/custom', method: 'GET', parameters: [] },
 *   ]);
 */
import type { ApiDefinition, ApiParameter } from './types';
/** Standard date range params — included in most analytics endpoints */
export declare const dateParams: ApiParameter[];
/** Common pagination params */
export declare const pageParams: ApiParameter[];
type ScreenName = string;
/**
 * Each screen maps to an array of endpoint definitions.
 * Endpoints use relative paths — the registry prepends the baseUrl.
 */
type ScreenDefinition = Omit<ApiDefinition, 'endpoint'> & {
    endpoint: string;
};
type ScreenMap = Record<ScreenName, ScreenDefinition[]>;
export interface Registry {
    /** Return API definitions for the given screen, with baseUrl baked in */
    forScreen(screenName: string): ApiDefinition[];
    /** List of registered screen names */
    screens: string[];
    /** Create a new registry that inherits all screens + adds/overrides one more */
    extend(screenName: string, definitions: ScreenDefinition[]): Registry;
}
/**
 * createRegistry — define all your product's API endpoints in one call.
 *
 * @param baseUrl  - Your backend base URL e.g. 'https://api.my-product.com'
 * @param screens  - Map of screen name → endpoint definitions
 */
export declare function createRegistry(baseUrl: string, screens: ScreenMap): Registry;
/**
 * buildVisionRegistry — returns Vision's pre-built registry for a given baseUrl.
 *
 *   import { buildVisionRegistry } from '@your-org/agent-sdk';
 *   const registry = buildVisionRegistry('https://vision-backend.com/api');
 *   const tools    = registry.forScreen('business');
 */
export declare function buildVisionRegistry(baseUrl: string): Registry;
export {};
//# sourceMappingURL=registry.d.ts.map