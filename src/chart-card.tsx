/**
 * ChartCard — lazy-loaded Chart.js renderer for agent-generated chart specs.
 *
 * This file is intentionally isolated so it forms its own bundle chunk.
 * AgentPanel imports it via React.lazy() — Chart.js (and react-chartjs-2)
 * are only downloaded by the browser when the agent first returns a chart.
 * Consumers who never trigger chart responses pay zero bundle cost.
 *
 * Supported types: bar, line, pie, doughnut
 * Adapter: ChartSpec (SDK type) → react-chartjs-2 data + options objects
 */

import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
} from 'chart.js';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';
import type { ChartSpec } from './types';

// ── Register only what we use — keeps tree-shaking effective ──────────────────
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

// ── Colour palette ────────────────────────────────────────────────────────────
const PALETTE = [
  '#6366f1', '#22c55e', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#84cc16',
];

// ── Adapter: ChartSpec → Chart.js dataset objects ─────────────────────────────
function buildDatasets(spec: ChartSpec) {
  const isPie = spec.type === 'pie' || spec.type === 'doughnut';

  return spec.datasets.map((ds, i) => {
    const color = PALETTE[i % PALETTE.length];

    // Pie/doughnut: each segment gets its own colour from the palette
    const bgColor = isPie
      ? ds.data.map((_, j) => PALETTE[j % PALETTE.length] + 'cc')
      : spec.type === 'line'
        ? color + '28'   // translucent fill under the line
        : color + 'cc';  // solid bars

    return {
      label:           ds.label,
      data:            ds.data,
      backgroundColor: bgColor,
      borderColor:     isPie ? ds.data.map((_, j) => PALETTE[j % PALETTE.length]) : color,
      borderWidth:     spec.type === 'line' ? 2 : 1,
      fill:            spec.type === 'line',
      tension:         0.35,
      borderRadius:    spec.type === 'bar' ? 4 : undefined,
      pointRadius:     spec.type === 'line' ? 3 : undefined,
      pointHoverRadius: spec.type === 'line' ? 5 : undefined,
    };
  });
}

// ── Adapter: ChartSpec → Chart.js options ─────────────────────────────────────
function buildOptions(spec: ChartSpec): ChartOptions<any> {
  const isPie = spec.type === 'pie' || spec.type === 'doughnut';

  const base: ChartOptions<any> = {
    responsive:          true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display:  true,
        position: 'bottom',
        labels: {
          font:     { size: 11 },
          color:    '#64748b',
          boxWidth: 12,
          padding:  12,
        },
      },
      tooltip: {
        backgroundColor: '#1e293b',
        titleFont:       { size: 11 },
        bodyFont:        { size: 12, weight: '600' },
        padding:         10,
        cornerRadius:    8,
        callbacks: {
          label: (ctx: any) => {
            const raw = ctx.parsed.y ?? ctx.parsed;
            if (spec.currency) {
              return ' ' + new Intl.NumberFormat('en', {
                style: 'currency', currency: spec.currency, notation: 'compact',
              }).format(raw);
            }
            if (spec.unit) return ` ${raw}${spec.unit}`;
            return ` ${raw}`;
          },
        },
      },
    },
  };

  if (!isPie) {
    (base as any).scales = {
      x: {
        stacked: spec.stacked,
        grid:    { display: false },
        ticks:   { font: { size: 10 }, color: '#94a3b8', maxRotation: 45 },
      },
      y: {
        stacked: spec.stacked,
        grid:    { color: '#f1f5f9' },
        ticks: {
          font:  { size: 10 },
          color: '#94a3b8',
          callback: (value: number) => {
            if (spec.currency) {
              return new Intl.NumberFormat('en', {
                style: 'currency', currency: spec.currency, notation: 'compact',
              }).format(value);
            }
            if (spec.unit) return `${value}${spec.unit}`;
            return value;
          },
        },
      },
    };
  }

  return base;
}

// ── Component map ─────────────────────────────────────────────────────────────
const CHART_MAP = { bar: Bar, line: Line, pie: Pie, doughnut: Doughnut } as const;

// ── ChartCard ─────────────────────────────────────────────────────────────────

export default function ChartCard({ spec }: { spec: ChartSpec }) {
  const ChartComponent = CHART_MAP[spec.type] ?? Bar;

  const data = {
    labels:   spec.labels,
    datasets: buildDatasets(spec),
  };

  const options = buildOptions(spec);

  return (
    <div style={{
      background:   '#fff',
      borderRadius: 12,
      border:       '1px solid #e8eaf0',
      padding:      '14px 16px 12px',
      boxShadow:    '0 1px 6px rgba(0,0,0,0.06)',
    }}>
      {/* Title */}
      <p style={{
        fontSize:   12,
        fontWeight: 600,
        color:      '#374151',
        margin:     '0 0 12px',
        lineHeight: 1.3,
      }}>
        {spec.title}
      </p>

      {/* Chart canvas */}
      <div style={{ height: 220, position: 'relative' }}>
        <ChartComponent data={data} options={options} />
      </div>
    </div>
  );
}
