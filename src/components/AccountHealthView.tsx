import { Search, ChevronRight } from 'lucide-react';
import type { AccountHealthResponse, HealthStatus } from '../types';
import { formatCurrency, formatNumber, formatPct } from '../utils/format';

interface AccountHealthViewProps {
  data: AccountHealthResponse | null;
  loading: boolean;
  error: string | null;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onSelectAccount: (accountId: string) => void;
  onSelectSegmentFilter: (accountType: string) => void;
  activeSegmentFilter: string;
}

export function StatusIndicator({ status }: { status: HealthStatus }) {
  if (status === 'Quiet') {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-rose-700 whitespace-nowrap">
        <span aria-hidden="true">▲</span> Quiet
      </span>
    );
  }
  if (status === 'Under-Buying') {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-amber-700 whitespace-nowrap">
        <span aria-hidden="true">◆</span> Under-Buying
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-teal-700 whitespace-nowrap">
      <span aria-hidden="true">●</span> Healthy
    </span>
  );
}

export function AccountHealthView({
  data,
  loading,
  error,
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchQueryChange,
  onSelectAccount,
  onSelectSegmentFilter,
  activeSegmentFilter,
}: AccountHealthViewProps) {
  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-lg" />
          ))}
        </div>
        <div className="h-64 bg-white border border-slate-200 rounded-lg" />
        <div className="h-96 bg-white border border-slate-200 rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-rose-200 rounded-lg p-6 text-sm text-rose-700">
        Unable to load Account Health marts: {error}
      </div>
    );
  }

  if (!data) return null;

  const { kpis, segmentBenchmarks, accounts } = data;

  const visibleAccounts =
    statusFilter === 'Flagged'
      ? accounts.filter((a) => a.health_status !== 'Healthy')
      : accounts;

  return (
    <div className="space-y-6">
      {/* 4-Column Health KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">Quiet / Silent Accounts</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-rose-700 font-mono tabular-nums">
              {formatNumber(kpis.quiet_count)}
            </span>
            <span className="text-xs font-mono text-slate-400">
              / {formatNumber(kpis.total_accounts)}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Days since last order exceeds segment cadence
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">Under-Buying vs. Benchmark</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-amber-700 font-mono tabular-nums">
              {formatNumber(kpis.under_buying_count)}
            </span>
            <span className="text-xs font-mono text-slate-400">ACCTS</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Ordering &lt;62% of peer quarterly spend or -35% drop
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">Nominal / Healthy Accounts</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-teal-700 font-mono tabular-nums">
              {formatNumber(kpis.healthy_count)}
            </span>
            <span className="text-xs font-mono text-slate-400">
              {formatPct((kpis.healthy_count / Math.max(1, kpis.total_accounts)) * 100)}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 font-mono tabular-nums">
            Portfolio avg recency: {kpis.avg_days_since_order} days
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">Annualized Revenue Gap at Risk</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
              {formatCurrency(kpis.annualized_revenue_at_risk, true)}
            </span>
            <span className="text-xs font-mono text-slate-400">ARR GAP</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Recoverable run-rate across flagged cohorts
          </div>
        </div>
      </div>

      {/* Segment Benchmark Comparison Matrix */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Segment Reorder Cadence & Quarterly Spend Benchmarks
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Click any segment row to filter the account triage queue below against its peer baseline.
            </p>
          </div>
          {activeSegmentFilter !== 'All' && (
            <button
              type="button"
              onClick={() => onSelectSegmentFilter('All')}
              className="text-xs font-medium text-teal-700 hover:text-teal-900 underline underline-offset-2 self-start sm:self-auto whitespace-nowrap shrink-0"
            >
              Clear segment filter ({activeSegmentFilter})
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <th className="py-2.5 px-4">Segment</th>
                <th className="py-2.5 px-3 text-right font-mono">Accounts</th>
                <th className="py-2.5 px-3 text-right font-mono">Quiet Threshold</th>
                <th className="py-2.5 px-3 text-right font-mono">Peer Benchmark / Qtr</th>
                <th className="py-2.5 px-3 text-right font-mono">Actual Trailing Avg</th>
                <th className="py-2.5 px-3 text-right font-mono">Quiet</th>
                <th className="py-2.5 px-3 text-right font-mono">Under-Buying</th>
                <th className="py-2.5 px-4 text-right font-mono">Segment Gap ARR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {segmentBenchmarks.map((seg) => {
                const isActive = activeSegmentFilter === seg.account_type;
                return (
                  <tr
                    key={seg.account_type}
                    onClick={() =>
                      onSelectSegmentFilter(isActive ? 'All' : seg.account_type)
                    }
                    className={`cursor-pointer transition-colors ${
                      isActive ? 'bg-teal-50/70' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {seg.account_type}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                      {formatNumber(seg.total_accounts)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600">
                      &gt;{seg.quiet_threshold_days}d
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900">
                      {formatCurrency(seg.segment_benchmark_quarterly_rev)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                      {formatCurrency(seg.actual_avg_quarterly_rev)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-medium text-rose-700">
                      {seg.quiet_count}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-medium text-amber-700">
                      {seg.under_buying_count}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatCurrency(seg.segment_at_risk_arr, true)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Account Triage Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-md self-start">
            {[
              { id: 'Flagged', label: 'All Flagged' },
              { id: 'Quiet', label: 'Quiet' },
              { id: 'Under-Buying', label: 'Under-Buying' },
              { id: 'Healthy', label: 'Healthy' },
              { id: 'All', label: 'All Accounts' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onStatusFilterChange(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Filter account name or ID..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:bg-white"
            />
          </div>
        </div>

        {visibleAccounts.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No accounts match the active health filter and search query.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Account</th>
                  <th className="py-2.5 px-3">Segment · Territory</th>
                  <th className="py-2.5 px-3">Health Status</th>
                  <th className="py-2.5 px-3 text-right font-mono">Days Silent</th>
                  <th className="py-2.5 px-3 text-right font-mono">Trailing Qtr Avg</th>
                  <th className="py-2.5 px-3 text-right font-mono">Peer Benchmark</th>
                  <th className="py-2.5 px-3 text-right font-mono">Gap ARR</th>
                  <th className="py-2.5 px-4">Recommended Play</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {visibleAccounts.map((acc) => {
                  const ratioPct = Math.min(100, Math.max(0, acc.benchmark_ratio * 100));
                  return (
                    <tr
                      key={acc.account_id}
                      onClick={() => onSelectAccount(acc.account_id)}
                      className="hover:bg-teal-50/40 cursor-pointer transition-colors group"
                    >
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-900 group-hover:text-teal-800 flex items-center gap-1">
                          <span>{acc.account_name}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-teal-600" />
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {acc.account_id} · Last order {acc.last_order_date}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                        <span>{acc.account_type}</span>
                        <span className="mx-1.5 text-slate-300">·</span>
                        <span className="font-mono text-[11px]">{acc.org_territory}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusIndicator status={acc.health_status} />
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        <span
                          className={
                            acc.days_since_last_order > acc.segment_quiet_threshold_days
                              ? 'text-rose-700 font-semibold'
                              : 'text-slate-700'
                          }
                        >
                          {acc.days_since_last_order}d
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          {' '}
                          / {acc.segment_quiet_threshold_days}d
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        <div className="text-slate-900 font-medium">
                          {formatCurrency(acc.trailing_quarterly_avg, true)}
                        </div>
                        <div className="w-20 ml-auto h-1.5 bg-slate-100 rounded-xs overflow-hidden mt-1">
                          <div
                            style={{ width: `${ratioPct}%` }}
                            className={`h-full ${
                              acc.health_status === 'Quiet'
                                ? 'bg-rose-500'
                                : acc.health_status === 'Under-Buying'
                                ? 'bg-amber-500'
                                : 'bg-teal-600'
                            }`}
                          />
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                        {formatCurrency(acc.segment_benchmark_quarterly_rev, true)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {acc.annualized_gap_value > 0
                          ? formatCurrency(acc.annualized_gap_value, true)
                          : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 max-w-[220px] truncate">
                        {acc.recommended_action}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
