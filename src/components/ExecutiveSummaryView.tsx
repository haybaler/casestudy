import { useMemo, useState } from 'react';
import type { ExecutiveResponse } from '../types';
import { formatCurrency, formatNumber, formatPct } from '../utils/format';

interface ExecutiveSummaryViewProps {
  data: ExecutiveResponse | null;
  loading: boolean;
  error: string | null;
  selectedQuarter: string;
}

export function ExecutiveSummaryView({
  data,
  loading,
  error,
  selectedQuarter,
}: ExecutiveSummaryViewProps) {
  const [chartMode, setChartMode] = useState<'category' | 'buyer'>('category');
  const [hoveredQuarter, setHoveredQuarter] = useState<string | null>(null);

  const quarters = useMemo(
    () => data?.quarterly.map((q) => q.fiscal_quarter) ?? [],
    [data]
  );

  const matrixLookup = useMemo(() => {
    const map = new Map<string, { revenue: number; catalog: number; custom: number; orders: number }>();
    if (!data) return map;
    for (const row of data.productQuarterMatrix) {
      map.set(`${row.product_line}__${row.fiscal_quarter}`, {
        revenue: row.revenue,
        catalog: row.catalog_revenue,
        custom: row.custom_revenue,
        orders: row.orders,
      });
    }
    return map;
  }, [data]);

  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-lg" />
          ))}
        </div>
        <div className="h-80 bg-white border border-slate-200 rounded-lg" />
        <div className="h-72 bg-white border border-slate-200 rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-rose-200 rounded-lg p-6 text-sm text-rose-700">
        Unable to load Executive Summary: {error}
      </div>
    );
  }

  if (!data) return null;

  const { summary, quarterly, productTotals, segmentTotals } = data;
  const maxQuarterlyRev = Math.max(...quarterly.map((q) => q.revenue), 1);
  const customSharePct =
    summary.total_revenue > 0
      ? (summary.custom_revenue / summary.total_revenue) * 100
      : 0;
  const repeatSharePct =
    summary.total_revenue > 0
      ? (summary.repeat_account_revenue / summary.total_revenue) * 100
      : 0;

  const activeHoverRow =
    quarterly.find((q) => q.fiscal_quarter === hoveredQuarter) ??
    quarterly[quarterly.length - 1];

  const visibleMatrixQuarters =
    selectedQuarter !== 'All' ? [selectedQuarter] : quarters;

  return (
    <div className="space-y-6">
      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">
            Recognized Revenue {selectedQuarter !== 'All' ? `(${selectedQuarter})` : '(24M Window)'}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
              {formatCurrency(summary.total_revenue, true)}
            </span>
            <span className="text-xs font-mono text-slate-400">USD</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 font-mono tabular-nums">
            {formatNumber(summary.total_orders)} orders · Avg {formatCurrency(summary.avg_order_value)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">Active Buying Accounts</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
              {formatNumber(summary.buying_accounts)}
            </span>
            <span className="text-xs font-mono text-slate-400">ACCTS</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 font-mono tabular-nums">
            Repeat {formatPct(repeatSharePct)} · New {formatPct(100 - repeatSharePct)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">YoY Growth (Q3 vs Prior Q3)</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl font-semibold font-mono tabular-nums ${
                (summary.yoy_growth_pct ?? 0) >= 0 ? 'text-teal-700' : 'text-rose-700'
              }`}
            >
              {formatPct(summary.yoy_growth_pct, true)}
            </span>
            <span className="text-xs font-mono text-slate-400">2026-Q3</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 font-mono tabular-nums">
            Latest QoQ {formatPct(quarterly[quarterly.length - 1]?.qoq_growth_pct, true)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">Catalog vs. Custom SKU Mix</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
              {formatPct(100 - customSharePct)}
            </span>
            <span className="text-xs font-mono text-slate-400">CATALOG</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 font-mono tabular-nums">
            Catalog {formatCurrency(summary.catalog_revenue, true)} · Custom {formatCurrency(summary.custom_revenue, true)}
          </div>
        </div>
      </div>

      {/* Quarterly Revenue & Growth Chart */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Quarterly Revenue Trajectory & Cohort Composition
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Hover any quarter bar to inspect Catalog vs. Custom or New vs. Repeat revenue and QoQ growth rate.
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md self-start">
            <button
              type="button"
              onClick={() => setChartMode('category')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                chartMode === 'category'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Catalog vs. Custom
            </button>
            <button
              type="button"
              onClick={() => setChartMode('buyer')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                chartMode === 'buyer'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              New vs. Repeat
            </button>
          </div>
        </div>

        {/* Active Hover Telemetry Bar */}
        {activeHoverRow && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-md text-xs">
            <div className="flex items-center gap-3">
              <span className="font-mono font-semibold text-slate-900">
                {activeHoverRow.fiscal_quarter}
              </span>
              <span className="text-slate-400">·</span>
              <span className="font-mono tabular-nums text-slate-700">
                Total {formatCurrency(activeHoverRow.revenue)}
              </span>
              <span className="text-slate-400">·</span>
              <span className="font-mono tabular-nums text-slate-600">
                {formatNumber(activeHoverRow.buying_accounts)} buying accounts
              </span>
              <span className="text-slate-400">·</span>
              <span
                className={`font-mono tabular-nums font-medium ${
                  (activeHoverRow.qoq_growth_pct ?? 0) >= 0
                    ? 'text-teal-700'
                    : 'text-amber-700'
                }`}
              >
                QoQ {formatPct(activeHoverRow.qoq_growth_pct, true)}
              </span>
            </div>
            <div className="flex items-center gap-4 font-mono tabular-nums text-slate-600">
              {chartMode === 'category' ? (
                <>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-teal-600 inline-block rounded-xs" />
                    Catalog {formatCurrency(activeHoverRow.catalog_revenue, true)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-slate-700 inline-block rounded-xs" />
                    Custom {formatCurrency(activeHoverRow.custom_revenue, true)}
                  </span>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-teal-600 inline-block rounded-xs" />
                    Repeat {formatCurrency(activeHoverRow.repeat_account_revenue, true)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-sky-600 inline-block rounded-xs" />
                    New {formatCurrency(activeHoverRow.new_account_revenue, true)}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Crisp Stacked Bar Visualization */}
        <div className="mt-6 grid grid-cols-8 gap-3 items-end h-56 pt-6 border-b border-slate-200 pb-2">
          {quarterly.map((q) => {
            const totalPct = Math.max(8, (q.revenue / maxQuarterlyRev) * 100);
            const primaryPart =
              chartMode === 'category' ? q.catalog_revenue : q.repeat_account_revenue;
            const secondaryPart =
              chartMode === 'category' ? q.custom_revenue : q.new_account_revenue;
            const primaryShare = q.revenue > 0 ? (primaryPart / q.revenue) * 100 : 0;
            const secondaryShare = q.revenue > 0 ? (secondaryPart / q.revenue) * 100 : 0;
            const isSelected =
              selectedQuarter === 'All' || selectedQuarter === q.fiscal_quarter;

            return (
              <div
                key={q.fiscal_quarter}
                onMouseEnter={() => setHoveredQuarter(q.fiscal_quarter)}
                className={`flex flex-col items-center h-full justify-end group cursor-pointer transition-opacity ${
                  isSelected ? 'opacity-100' : 'opacity-40'
                }`}
              >
                <div className="text-[11px] font-mono tabular-nums text-slate-600 mb-1.5">
                  {formatCurrency(q.revenue, true)}
                </div>
                <div
                  style={{ height: `${totalPct}%` }}
                  className="w-full max-w-[54px] flex flex-col justify-end rounded-t-sm overflow-hidden border border-slate-200/70 transition-transform duration-150 group-hover:-translate-y-0.5"
                >
                  <div
                    style={{ height: `${secondaryShare}%` }}
                    className={
                      chartMode === 'category' ? 'bg-slate-700 w-full' : 'bg-sky-600 w-full'
                    }
                  />
                  <div
                    style={{ height: `${primaryShare}%` }}
                    className="bg-teal-600 w-full"
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-8 gap-3 mt-2 text-center">
          {quarterly.map((q) => (
            <div key={q.fiscal_quarter} className="space-y-0.5">
              <div className="text-xs font-mono font-medium text-slate-700">
                {q.fiscal_quarter}
              </div>
              <div
                className={`text-[11px] font-mono tabular-nums ${
                  q.qoq_growth_pct === null
                    ? 'text-slate-400'
                    : q.qoq_growth_pct >= 0
                    ? 'text-teal-700'
                    : 'text-amber-700'
                }`}
              >
                {q.qoq_growth_pct === null ? 'Base' : formatPct(q.qoq_growth_pct, true)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Product Line by Quarter Matrix */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Revenue per Product Line per Quarter
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Aggregated from <span className="font-mono">mart_quarterly_product_revenue</span> across Catalog & Custom SKUs.
            </p>
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-500">
            6 Product Lines · {visibleMatrixQuarters.length} Quarter{visibleMatrixQuarters.length > 1 ? 's' : ''}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <th className="py-2.5 px-4">Product Line</th>
                {visibleMatrixQuarters.map((q) => (
                  <th key={q} className="py-2.5 px-3 text-right font-mono">
                    {q}
                  </th>
                ))}
                <th className="py-2.5 px-4 text-right font-mono">Period Total</th>
                <th className="py-2.5 px-4 text-right font-mono">Custom %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {productTotals.map((prod) => {
                const customPct =
                  prod.revenue > 0 ? (prod.custom_revenue / prod.revenue) * 100 : 0;
                return (
                  <tr key={prod.product_line} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                      {prod.product_line}
                    </td>
                    {visibleMatrixQuarters.map((q) => {
                      const cell = matrixLookup.get(`${prod.product_line}__${q}`);
                      return (
                        <td
                          key={q}
                          className="py-3 px-3 text-right font-mono tabular-nums text-slate-700"
                        >
                          {cell ? formatCurrency(cell.revenue, true) : '—'}
                        </td>
                      );
                    })}
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatCurrency(prod.revenue, true)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                      {formatPct(customPct)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Segment Performance */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">
            Account Segment Mix & Custom Engineering Penetration
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Biopharma and CDMO drive custom assay and resin volume; Academic and CRO index toward rapid catalog e-commerce reorders.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <th className="py-2.5 px-4">Account Segment</th>
                <th className="py-2.5 px-4 text-right font-mono">Buying Accounts</th>
                <th className="py-2.5 px-4 text-right font-mono">Orders</th>
                <th className="py-2.5 px-4 text-right font-mono">Total Revenue</th>
                <th className="py-2.5 px-4 text-right font-mono">Custom Share</th>
                <th className="py-2.5 px-4 w-48">Share of Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {segmentTotals.map((seg) => {
                const revShare =
                  summary.total_revenue > 0
                    ? (seg.revenue / summary.total_revenue) * 100
                    : 0;
                return (
                  <tr key={seg.account_type} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900">{seg.account_type}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                      {formatNumber(seg.buying_accounts)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                      {formatNumber(seg.orders)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatCurrency(seg.revenue)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                      {formatPct(seg.custom_share_pct)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-100 rounded-xs overflow-hidden">
                          <div
                            style={{ width: `${Math.min(100, revShare)}%` }}
                            className="h-full bg-teal-600"
                          />
                        </div>
                        <span className="font-mono tabular-nums text-slate-600 w-11 text-right">
                          {formatPct(revShare)}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
