import { useState } from 'react';
import type { AttributionResponse } from '../types';
import { formatCurrency, formatNumber, formatPct } from '../utils/format';

interface AttributionViewProps {
  data: AttributionResponse | null;
  loading: boolean;
  error: string | null;
}

export function AttributionView({ data, loading, error }: AttributionViewProps) {
  const [sortModel, setSortModel] = useState<'first' | 'last' | 'spend'>('first');

  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-lg" />
          ))}
        </div>
        <div className="h-80 bg-white border border-slate-200 rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-rose-200 rounded-lg p-6 text-sm text-rose-700">
        Unable to load Attribution analytics: {error}
      </div>
    );
  }

  if (!data) return null;

  const { overview, byLeadSource, bySalesChannel, quarterlyAttributionTrend } = data;

  const sortedSources = [...byLeadSource].sort((a, b) => {
    if (sortModel === 'first') return b.first_touch_revenue - a.first_touch_revenue;
    if (sortModel === 'last') return b.last_touch_revenue - a.last_touch_revenue;
    return b.program_spend - a.program_spend;
  });

  const maxRoas = Math.max(
    ...byLeadSource.flatMap((r) => [r.first_touch_roas, r.last_touch_roas]),
    1
  );

  return (
    <div className="space-y-6">
      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">Marketing-Influenced Revenue</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
              {formatCurrency(overview.influenced_revenue, true)}
            </span>
            <span className="text-xs font-mono text-slate-400">90D WINDOW</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 font-mono tabular-nums">
            {formatPct(overview.influenced_share_pct)} of total · {formatNumber(overview.influenced_orders)} orders
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">Total Program Spend</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
              {formatCurrency(overview.total_program_spend, true)}
            </span>
            <span className="text-xs font-mono text-slate-400">BUDGET</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 font-mono tabular-nums">
            8 active demand & capture channels
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">Return per $1 Program Spend</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-teal-700 font-mono tabular-nums">
              ${overview.blended_roas.toFixed(2)}
            </span>
            <span className="text-xs font-mono text-slate-400">BLENDED ROAS</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 font-mono tabular-nums">
            Influenced Rev / Program Spend
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">Sales Cycle Touch Latency</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
              {overview.avg_touch_to_order_days}
            </span>
            <span className="text-xs font-mono text-slate-400">DAYS LAST-TOUCH</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 font-mono tabular-nums">
            Full journey {overview.avg_journey_days} days from 1st touch
          </div>
        </div>
      </div>

      {/* First-Touch vs Last-Touch ROAS Comparison */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              First-Touch vs. Last-Touch ROAS Distortion by Lead Source
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Compares return per dollar of program spend when crediting the account&apos;s originating acquisition touch vs. the final pre-order touch.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-slate-700">
              <span className="w-2.5 h-2.5 bg-teal-600 inline-block rounded-xs" />
              First-Touch ROAS
            </span>
            <span className="flex items-center gap-1.5 text-slate-700">
              <span className="w-2.5 h-2.5 bg-sky-600 inline-block rounded-xs" />
              Last-Touch ROAS
            </span>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {sortedSources.map((row) => {
            const ftWidth = Math.max(2, (row.first_touch_roas / maxRoas) * 100);
            const ltWidth = Math.max(2, (row.last_touch_roas / maxRoas) * 100);
            const deltaPositive = row.attribution_delta_rev >= 0;

            return (
              <div
                key={row.lead_source}
                className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center py-2 border-b border-slate-100 last:border-b-0"
              >
                <div className="lg:col-span-3">
                  <div className="text-xs font-semibold text-slate-900">{row.lead_source}</div>
                  <div className="text-[11px] text-slate-500 truncate">{row.campaign_notes}</div>
                </div>
                <div className="lg:col-span-6 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2.5 bg-slate-100 rounded-xs overflow-hidden">
                      <div
                        style={{ width: `${ftWidth}%` }}
                        className="h-full bg-teal-600 transition-all duration-200"
                      />
                    </div>
                    <span className="w-16 text-right text-xs font-mono tabular-nums text-teal-800 font-medium">
                      ${row.first_touch_roas.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2.5 bg-slate-100 rounded-xs overflow-hidden">
                      <div
                        style={{ width: `${ltWidth}%` }}
                        className="h-full bg-sky-600 transition-all duration-200"
                      />
                    </div>
                    <span className="w-16 text-right text-xs font-mono tabular-nums text-sky-800 font-medium">
                      ${row.last_touch_roas.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="lg:col-span-3 flex lg:justify-end items-center gap-4 text-xs font-mono tabular-nums">
                  <div className="text-right">
                    <div className="text-slate-500 text-[11px]">Spend</div>
                    <div className="text-slate-900">{formatCurrency(row.program_spend, true)}</div>
                  </div>
                  <div className="text-right min-w-[92px]">
                    <div className="text-slate-500 text-[11px]">FT - LT Shift</div>
                    <div
                      className={`font-medium ${
                        deltaPositive ? 'text-teal-700' : 'text-amber-700'
                      }`}
                    >
                      {deltaPositive ? '+' : ''}
                      {formatCurrency(row.attribution_delta_rev, true)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Attribution Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Channel & Program Spend Attribution Ledger
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Direct reconciliation from <span className="font-mono">mart_attribution_comparison</span>.
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md self-start">
            <button
              type="button"
              onClick={() => setSortModel('first')}
              className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap shrink-0 ${
                sortModel === 'first'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sort: First-Touch
            </button>
            <button
              type="button"
              onClick={() => setSortModel('last')}
              className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap shrink-0 ${
                sortModel === 'last'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sort: Last-Touch
            </button>
            <button
              type="button"
              onClick={() => setSortModel('spend')}
              className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap shrink-0 ${
                sortModel === 'spend'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sort: Spend
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <th className="py-2.5 px-4">Lead Source</th>
                <th className="py-2.5 px-3 text-right font-mono">Program Spend</th>
                <th className="py-2.5 px-3 text-right font-mono">FT Orders</th>
                <th className="py-2.5 px-3 text-right font-mono">FT Revenue</th>
                <th className="py-2.5 px-3 text-right font-mono">FT ROAS</th>
                <th className="py-2.5 px-3 text-right font-mono">LT Orders</th>
                <th className="py-2.5 px-3 text-right font-mono">LT Revenue</th>
                <th className="py-2.5 px-3 text-right font-mono">LT ROAS</th>
                <th className="py-2.5 px-4 text-right font-mono">FT vs LT Delta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {sortedSources.map((row) => (
                <tr key={row.lead_source} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                    {row.lead_source}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                    {formatCurrency(row.program_spend)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600">
                    {formatNumber(row.first_touch_orders)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums font-medium text-slate-900">
                    {formatCurrency(row.first_touch_revenue)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-teal-700">
                    ${row.first_touch_roas.toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600">
                    {formatNumber(row.last_touch_orders)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums font-medium text-slate-900">
                    {formatCurrency(row.last_touch_revenue)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-sky-700">
                    ${row.last_touch_roas.toFixed(2)}
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-mono tabular-nums font-medium ${
                      row.attribution_delta_rev >= 0 ? 'text-teal-700' : 'text-amber-700'
                    }`}
                  >
                    {row.attribution_delta_rev >= 0 ? '+' : ''}
                    {formatCurrency(row.attribution_delta_rev)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sales Channel & Quarterly Blended ROAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">
              Marketing Influence by Commercial Sales Channel
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Sales Channel</th>
                  <th className="py-2.5 px-3 text-right font-mono">Total Rev</th>
                  <th className="py-2.5 px-3 text-right font-mono">Influenced</th>
                  <th className="py-2.5 px-4 text-right font-mono">Influence %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {bySalesChannel.map((ch) => (
                  <tr key={ch.channel} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-medium text-slate-900">{ch.channel}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                      {formatCurrency(ch.revenue, true)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900 font-medium">
                      {formatCurrency(ch.influenced_revenue, true)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-teal-700">
                      {formatPct(ch.influenced_share_pct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">
              Quarterly Program Spend & Blended ROAS
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-2.5 px-4 font-mono">Quarter</th>
                  <th className="py-2.5 px-3 text-right font-mono">Spend</th>
                  <th className="py-2.5 px-3 text-right font-mono">Influenced Rev</th>
                  <th className="py-2.5 px-4 text-right font-mono">Return / $1</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {quarterlyAttributionTrend.map((q) => (
                  <tr key={q.fiscal_quarter} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-mono font-medium text-slate-900">
                      {q.fiscal_quarter}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                      {formatCurrency(q.program_spend, true)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900">
                      {formatCurrency(q.influenced_revenue, true)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-teal-700">
                      ${q.blended_roas.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
