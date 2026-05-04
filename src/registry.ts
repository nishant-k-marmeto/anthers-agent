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

// ── Common parameter presets — reuse across definitions ───────────────────────

/** Standard date range params — included in most analytics endpoints */
export const dateParams: ApiParameter[] = [
  { name: 'startDate', type: 'string', required: false, description: 'Start date YYYY-MM-DD' },
  { name: 'endDate',   type: 'string', required: false, description: 'End date YYYY-MM-DD'   },
];

/** Common pagination params */
export const pageParams: ApiParameter[] = [
  { name: 'page',  type: 'number', required: false, description: 'Page number, starting from 1' },
  { name: 'limit', type: 'number', required: false, description: 'Number of results per page'   },
];

// ── Screen definition map ─────────────────────────────────────────────────────

type ScreenName = string;

/**
 * Each screen maps to an array of endpoint definitions.
 * Endpoints use relative paths — the registry prepends the baseUrl.
 */
type ScreenDefinition = Omit<ApiDefinition, 'endpoint'> & { endpoint: string };
type ScreenMap        = Record<ScreenName, ScreenDefinition[]>;

// ── Registry instance ─────────────────────────────────────────────────────────

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
export function createRegistry(baseUrl: string, screens: ScreenMap): Registry {
  function resolveEndpoint(path: string): string {
    // If path is already a full URL, use it as-is
    if (/^https?:\/\//.test(path)) return path;
    return `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  function forScreen(screenName: string): ApiDefinition[] {
    const defs = screens[screenName] ?? screens[Object.keys(screens)[0]] ?? [];
    return defs.map(d => ({ ...d, endpoint: resolveEndpoint(d.endpoint) }));
  }

  return {
    forScreen,
    screens: Object.keys(screens),
    extend(screenName: string, definitions: ScreenDefinition[]): Registry {
      return createRegistry(baseUrl, { ...screens, [screenName]: definitions });
    },
  };
}

// ── Vision built-in registry ──────────────────────────────────────────────────
// Pre-built for Vision's analytics screens.
// Other products should call createRegistry() with their own baseUrl + screens.

/**
 * buildVisionRegistry — returns Vision's pre-built registry for a given baseUrl.
 *
 *   import { buildVisionRegistry } from '@your-org/agent-sdk';
 *   const registry = buildVisionRegistry('https://vision-backend.com/api');
 *   const tools    = registry.forScreen('business');
 */
export function buildVisionRegistry(baseUrl: string): Registry {
  return createRegistry(baseUrl, {

    business: [
      {
        name: 'get_business_kpis',
        description: 'Fetches business KPIs: gross sales, net profit, profit margin, orders fulfilled. Use first for any business performance question.',
        endpoint:    '/analytics/business/kpis',
        method:      'GET',
        parameters:  dateParams,
      },
      {
        name: 'get_business_funnel',
        description: 'Fetches revenue funnel showing how gross sales reduce to net sales after discounts and refunds.',
        endpoint:    '/analytics/business/funnel',
        method:      'GET',
        parameters:  dateParams,
      },
      {
        name: 'get_business_grouped_column_chart',
        description: 'Fetches gross sales vs net sales vs net profit comparison data.',
        endpoint:    '/analytics/business/grouped-column-chart',
        method:      'GET',
        parameters:  dateParams,
      },
      {
        name: 'get_business_horizontal_bar_chart',
        description: 'Fetches sales velocity by product category.',
        endpoint:    '/analytics/business/horizontal-bar-chart',
        method:      'GET',
        parameters:  dateParams,
      },
      {
        name: 'get_business_dual_axis_line',
        description: 'Fetches AOV vs order volume. Use when asked about order frequency or spend per order.',
        endpoint:    '/analytics/business/dual-axis-line',
        method:      'GET',
        parameters:  dateParams,
      },
      {
        name: 'get_business_grouped_bar_chart',
        description: 'Fetches net profit vs expenses breakdown.',
        endpoint:    '/analytics/business/grouped-bar-chart',
        method:      'GET',
        parameters:  dateParams,
      },
    ],

    finance: [
      {
        name: 'get_finance_kpis',
        description: 'Fetches finance KPIs: revenue growth, AOV, customer lifetime value.',
        endpoint:    '/analytics/finance/kpis',
        method:      'GET',
        parameters:  dateParams,
      },
      {
        name: 'get_revenue_growth_chart',
        description: 'Fetches revenue growth rate over time. Use for growth trend questions.',
        endpoint:    '/analytics/finance/revenue-growth',
        method:      'GET',
        parameters:  dateParams,
      },
      {
        name: 'get_aov_chart',
        description: 'Fetches average order value trend over time.',
        endpoint:    '/analytics/finance/aov',
        method:      'GET',
        parameters:  dateParams,
      },
      {
        name: 'get_ltv_chart',
        description: 'Fetches customer lifetime value trend.',
        endpoint:    '/analytics/finance/ltv',
        method:      'GET',
        parameters:  dateParams,
      },
    ],

    operations: [
      {
        name: 'get_operations_kpis',
        description: 'Fetches operations KPIs: cancellation rate, fulfilment rate, refund rate, stock turnover.',
        endpoint:    '/analytics/operations/kpis',
        method:      'GET',
        parameters:  dateParams,
      },
      {
        name: 'get_cancellation_chart',
        description: 'Fetches cancellation rate across products.',
        endpoint:    '/analytics/operations/cancellations',
        method:      'GET',
        parameters:  dateParams,
      },
      {
        name: 'get_fulfilment_chart',
        description: 'Fetches on-time vs late fulfilment comparison.',
        endpoint:    '/analytics/operations/fulfilment',
        method:      'GET',
        parameters:  dateParams,
      },
      {
        name: 'get_refund_rate_chart',
        description: 'Fetches order refund rate over time.',
        endpoint:    '/analytics/operations/refunds',
        method:      'GET',
        parameters:  dateParams,
      },
      {
        name: 'get_stock_turnover_chart',
        description: 'Fetches stock turnover rate over time.',
        endpoint:    '/analytics/operations/stock-turnover',
        method:      'GET',
        parameters:  dateParams,
      },
    ],

  });
}
