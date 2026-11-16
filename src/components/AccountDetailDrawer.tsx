import { X } from 'lucide-react';
import type { AccountDetailResponse } from '../types';
import { formatCurrency, formatNumber, formatPct } from '../utils/format';
import { StatusIndicator } from './AccountHealthView';

interface AccountDetailDrawerProps {
  accountId: string | null;
  detail: AccountDetailResponse | null;
  loading: boolean;
  onClose: () => void;
}

export function AccountDetailDrawer({
  accountId,
  detail,
  loading,
  onClose,
}: AccountDetailDrawerProps) {
  if (!accountId) return null;

  const account = detail?.account;
  const maxTrendRev = Math.max(
    ...(detail?.quarterlyTrend.map((t) => t.revenue) ?? [1]),
    1
  );

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/25 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <aside
        className="w-full max-w-2xl bg-white h-full border-l border-slate-200 shadow-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            {loading && !account ? (
              <div className="h-6 w-56 bg-slate-100 rounded animate-pulse" />
            ) : (
              <>
                <div className="flex items-center gap-3 text-xs font-mono text-slate-500">
                  <span>{account?.account_id}</span>
                  <span aria-hidden="true">·</span>
                  <span>{account?.account_type}</span>
                  <span aria-hidden="true">·</span>
                  <span>{account?.org_territory}</span>
                </div>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">
                  {account?.account_name}
                </h2>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close account detail drawer"
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && !detail ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-24 bg-slate-100 rounded-lg" />
              <div className="h-44 bg-slate-100 rounded-lg" />
              <div className="h-64 bg-slate-100 rounded-lg" />
            </div>
          ) : detail && account ? (
            <>
              {/* Diagnostic Callout */}
              <div
                className={`border rounded-lg p-4 ${
                  account.health_status === 'Quiet'
                    ? 'bg-rose-50/60 border-rose-200'
                    : account.health_status === 'Under-Buying'
                    ? 'bg-amber-50/60 border-amber-200'
                    : 'bg-teal-50/50 border-teal-200'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <StatusIndicator status={account.health_status} />
                  <span className="text-xs font-mono tabular-nums text-slate-700">
                    Originating Touch: {account.first_touch_source}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-700 leading-relaxed">
                  {account.health_status === 'Quiet'
                    ? `No purchase recorded for ${account.days_since_last_order} days (exceeds ${account.account_type} segment cadence threshold of ${account.segment_quiet_threshold_days} days). Recommended play: ${account.recommended_action}.`
                    : account.health_status === 'Under-Buying'
                    ? `Trailing quarterly spend (${formatCurrency(account.trailing_quarterly_avg)}) is ${formatPct((1 - account.benchmark_ratio) * 100)} below the ${account.account_type} peer benchmark (${formatCurrency(account.segment_benchmark_quarterly_rev)}). Recommended play: ${account.recommended_action}.`
                    : `Ordering within expected ${account.account_type} cadence (${account.days_since_last_order} days since last order vs ${account.segment_quiet_threshold_days}-day threshold).`}
                </p>
              </div>

              {/* Benchmark Comparison Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="border border-slate-200 rounded-md p-3">
                  <div className="text-[11px] text-slate-500">Lifetime Revenue</div>
                  <div className="mt-1 text-base font-mono font-semibold tabular-nums text-slate-900">
                    {formatCurrency(account.lifetime_revenue, true)}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    {account.total_orders} orders
                  </div>
                </div>
                <div className="border border-slate-200 rounded-md p-3">
                  <div className="text-[11px] text-slate-500">Trailing Qtr Avg</div>
                  <div className="mt-1 text-base font-mono font-semibold tabular-nums text-slate-900">
                    {formatCurrency(account.trailing_quarterly_avg, true)}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    vs {formatCurrency(account.segment_benchmark_quarterly_rev, true)} peer
                  </div>
                </div>
                <div className="border border-slate-200 rounded-md p-3">
                  <div className="text-[11px] text-slate-500">Prior 180d Spend</div>
                  <div className="mt-1 text-base font-mono font-semibold tabular-nums text-slate-900">
                    {formatCurrency(account.prior_180d_revenue, true)}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    vs {formatCurrency(account.trailing_180d_revenue, true)} recent
                  </div>
                </div>
                <div className="border border-slate-200 rounded-md p-3">
                  <div className="text-[11px] text-slate-500">At-Risk ARR Gap</div>
                  <div className="mt-1 text-base font-mono font-semibold tabular-nums text-slate-900">
                    {account.annualized_gap_value > 0
                      ? formatCurrency(account.annualized_gap_value, true)
                      : '$0'}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    {account.days_since_last_order}d silent
                  </div>
                </div>
              </div>

              {/* 8-Quarter Spend Timeline */}
              <div className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-slate-900">
                    Quarterly Purchase Trajectory vs. Segment Benchmark
                  </h3>
                  <span className="text-[11px] font-mono text-slate-500">
                    Peer benchmark: {formatCurrency(account.segment_benchmark_quarterly_rev, true)}/qtr
                  </span>
                </div>
                <div className="grid grid-cols-8 gap-2 items-end h-28 pt-3 border-b border-slate-100 pb-1">
                  {detail.quarterlyTrend.map((q) => {
                    const heightPct = Math.max(6, (q.revenue / maxTrendRev) * 100);
                    return (
                      <div key={q.fiscal_quarter} className="flex flex-col items-center h-full justify-end">
                        <div className="text-[10px] font-mono tabular-nums text-slate-500 mb-1">
                          {formatCurrency(q.revenue, true)}
                        </div>
                        <div
                          style={{ height: `${heightPct}%` }}
                          className="w-full max-w-[34px] bg-teal-600 rounded-t-xs"
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-8 gap-2 mt-1.5 text-center">
                  {detail.quarterlyTrend.map((q) => (
                    <div key={q.fiscal_quarter} className="text-[10px] font-mono text-slate-500">
                      {q.fiscal_quarter.slice(2)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Product Mix Summary */}
              <div>
                <h3 className="text-xs font-semibold text-slate-900 mb-2">
                  Product Line & SKU Category Footprint
                </h3>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-600">
                        <th className="py-2 px-3">Product Line</th>
                        <th className="py-2 px-3">Category</th>
                        <th className="py-2 px-3 text-right font-mono">Orders</th>
                        <th className="py-2 px-3 text-right font-mono">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detail.productMix.map((pm, idx) => (
                        <tr key={`${pm.product_line}-${pm.order_category}-${idx}`}>
                          <td className="py-2 px-3 font-medium text-slate-900">{pm.product_line}</td>
                          <td className="py-2 px-3 font-mono text-slate-600">{pm.order_category}</td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                            {formatNumber(pm.orders)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums font-medium text-slate-900">
                            {formatCurrency(pm.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Chronological Order & Touchpoint Timeline */}
              <div>
                <h3 className="text-xs font-semibold text-slate-900 mb-2">
                  Order & Attribution Timeline ({detail.orders.length} orders)
                </h3>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-600">
                        <th className="py-2 px-3">Date · Order</th>
                        <th className="py-2 px-3">SKU · Product</th>
                        <th className="py-2 px-3">Touch & Channel</th>
                        <th className="py-2 px-3 text-right font-mono">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detail.orders.map((ord) => (
                        <tr key={ord.order_id} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3 align-top">
                            <div className="font-mono text-slate-900">{ord.order_date}</div>
                            <div className="font-mono text-[11px] text-slate-400">
                              {ord.order_id} · {ord.buyer_type}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 align-top">
                            <div className="font-mono font-medium text-slate-900">{ord.sku}</div>
                            <div className="text-[11px] text-slate-500">
                              {ord.product_line} · {ord.order_category} ({ord.units}u)
                            </div>
                          </td>
                          <td className="py-2.5 px-3 align-top">
                            <div className="text-slate-800">{ord.channel}</div>
                            <div className="text-[11px] text-slate-500">
                              {ord.is_marketing_influenced
                                ? `${ord.last_touch_source} (${ord.touch_to_order_days}d prior)`
                                : 'Direct / uninfluenced reorder'}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 align-top">
                            {formatCurrency(ord.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
