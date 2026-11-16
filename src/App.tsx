import { useCallback, useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type {
  AccountDetailResponse,
  AccountHealthResponse,
  AttributionResponse,
  ExecutiveResponse,
  GlobalFilterState,
  WarehouseMetadata,
} from './types';
import { formatCurrency, formatNumber } from './utils/format';
import { ExecutiveSummaryView } from './components/ExecutiveSummaryView';
import { AttributionView } from './components/AttributionView';
import { AccountHealthView } from './components/AccountHealthView';
import { AccountDetailDrawer } from './components/AccountDetailDrawer';
import { WarehouseQaView } from './components/WarehouseQaView';
import { ArchitectureReadmeView } from './components/ArchitectureReadmeView';

type ActiveView = 'executive' | 'attribution' | 'health' | 'qa';

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>('executive');
  const [readmeOpen, setReadmeOpen] = useState(false);

  const [metadata, setMetadata] = useState<WarehouseMetadata | null>(null);
  const [filters, setFilters] = useState<GlobalFilterState>({
    quarter: 'All',
    accountType: 'All',
    territory: 'All',
  });

  // Executive view state
  const [execData, setExecData] = useState<ExecutiveResponse | null>(null);
  const [execLoading, setExecLoading] = useState(true);
  const [execError, setExecError] = useState<string | null>(null);

  // Attribution view state
  const [attrData, setAttrData] = useState<AttributionResponse | null>(null);
  const [attrLoading, setAttrLoading] = useState(true);
  const [attrError, setAttrError] = useState<string | null>(null);

  // Account Health view state
  const [healthStatusFilter, setHealthStatusFilter] = useState<string>('Flagged');
  const [healthSearch, setHealthSearch] = useState<string>('');
  const [healthData, setHealthData] = useState<AccountHealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  // Account Drawer state
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [accountDetail, setAccountDetail] = useState<AccountDetailResponse | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);

  useEffect(() => {
    fetch('/api/metadata')
      .then((r) => r.json())
      .then((data) => setMetadata(data as WarehouseMetadata))
      .catch(() => {});
  }, []);

  const buildFilterParams = useCallback((f: GlobalFilterState) => {
    const sp = new URLSearchParams();
    if (f.quarter !== 'All') sp.set('quarter', f.quarter);
    if (f.accountType !== 'All') sp.set('accountType', f.accountType);
    if (f.territory !== 'All') sp.set('territory', f.territory);
    return sp.toString();
  }, []);

  useEffect(() => {
    setExecLoading(true);
    setExecError(null);
    const qs = buildFilterParams(filters);
    fetch(`/api/executive${qs ? `?${qs}` : ''}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Failed to load executive summary');
        setExecData(d as ExecutiveResponse);
      })
      .catch((err) => setExecError((err as Error).message))
      .finally(() => setExecLoading(false));
  }, [filters, buildFilterParams]);

  useEffect(() => {
    setAttrLoading(true);
    setAttrError(null);
    const qs = buildFilterParams(filters);
    fetch(`/api/attribution${qs ? `?${qs}` : ''}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Failed to load attribution data');
        setAttrData(d as AttributionResponse);
      })
      .catch((err) => setAttrError((err as Error).message))
      .finally(() => setAttrLoading(false));
  }, [filters, buildFilterParams]);

  useEffect(() => {
    setHealthLoading(true);
    setHealthError(null);
    const sp = new URLSearchParams();
    if (healthStatusFilter !== 'All' && healthStatusFilter !== 'Flagged') {
      sp.set('status', healthStatusFilter);
    }
    if (filters.accountType !== 'All') sp.set('accountType', filters.accountType);
    if (filters.territory !== 'All') sp.set('territory', filters.territory);
    if (healthSearch.trim()) sp.set('search', healthSearch.trim());

    fetch(`/api/health?${sp.toString()}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Failed to load account health');
        setHealthData(d as AccountHealthResponse);
      })
      .catch((err) => setHealthError((err as Error).message))
      .finally(() => setHealthLoading(false));
  }, [healthStatusFilter, filters.accountType, filters.territory, healthSearch]);

  function openAccountDrawer(accountId: string) {
    setSelectedAccountId(accountId);
    setAccountDetail(null);
    setAccountLoading(true);
    fetch(`/api/accounts/${encodeURIComponent(accountId)}`)
      .then((r) => r.json())
      .then((d) => setAccountDetail(d as AccountDetailResponse))
      .finally(() => setAccountLoading(false));
  }

  const hasActiveFilters =
    filters.quarter !== 'All' ||
    filters.accountType !== 'All' ||
    filters.territory !== 'All';

  const navItems: { id: ActiveView; label: string }[] = [
    { id: 'executive', label: 'Executive Summary' },
    { id: 'attribution', label: 'Attribution' },
    { id: 'health', label: 'Account Health' },
    { id: 'qa', label: 'Warehouse Q&A' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-8">
          {/* Zone 1: Single text wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveView('executive');
            }}
            className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 font-display"
          >
            contextpaas.ai
          </a>

          {/* Zone 2: 4 single-line view navigation links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-medium">
            {navItems.map((item) => {
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  className={`py-4 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-teal-700 text-slate-900 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single primary action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setReadmeOpen(true)}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              Architecture &amp; README
            </button>
          </div>
        </div>

        {/* Mobile view selector bar (keeps 3-zone header clean on desktop) */}
        <div className="md:hidden border-t border-slate-100 px-4 py-2 flex items-center gap-2 overflow-x-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap shrink-0 ${
                activeView === item.id
                  ? 'bg-teal-700 text-white'
                  : 'text-slate-600 bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {/* Case Study 05 Portfolio Hero Strip */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-7 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-500">
              <span>Case Study 05</span>
              <span aria-hidden="true">·</span>
              <span>Life Sciences Commercial Intelligence</span>
              <span aria-hidden="true">·</span>
              <span>
                {metadata
                  ? `${formatNumber(metadata.counts.total_orders)} Orders`
                  : '3,000+ Orders'}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {metadata
                  ? `${formatNumber(metadata.counts.total_accounts)} Accounts`
                  : '400 Accounts'}
              </span>
              <span aria-hidden="true">·</span>
              <span>24 Months</span>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
              Commercial Systems Architect
            </h1>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              End-to-end commercial warehouse unifying ERP orders and CRM marketing touches across 6 biotech product lines—surfacing silent account attrition, first- vs. last-touch ROAS distortion, and live text-to-SQL answers.
            </p>
          </div>

          {/* Right-aligned quantitative summary strip */}
          <div className="grid grid-cols-3 divide-x divide-slate-200 border border-slate-200 rounded-lg bg-slate-50/60 shrink-0">
            <div className="px-4 py-3">
              <div className="text-[11px] text-slate-500">24M Warehouse Rev</div>
              <div className="mt-0.5 text-base font-mono font-semibold tabular-nums text-slate-900">
                {metadata ? formatCurrency(metadata.counts.total_revenue, true) : '—'}
              </div>
            </div>
            <div className="px-4 py-3">
              <div className="text-[11px] text-slate-500">Quiet Accounts</div>
              <div className="mt-0.5 text-base font-mono font-semibold tabular-nums text-rose-700">
                {metadata ? formatNumber(metadata.counts.quiet_accounts) : '—'}
              </div>
            </div>
            <div className="px-4 py-3">
              <div className="text-[11px] text-slate-500">Under-Buying</div>
              <div className="mt-0.5 text-base font-mono font-semibold tabular-nums text-amber-700">
                {metadata ? formatNumber(metadata.counts.under_buying_accounts) : '—'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 space-y-6">
        {/* Global Warehouse Slice Toolbar (for analytical views) */}
        {activeView !== 'qa' && (
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {activeView !== 'health' && (
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="font-medium">Quarter</span>
                  <select
                    value={filters.quarter}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, quarter: e.target.value }))
                    }
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-mono text-slate-900 focus:outline-none focus:border-teal-600"
                  >
                    <option value="All">All 8 Quarters</option>
                    {metadata?.filters.quarters.map((q) => (
                      <option key={q} value={q}>
                        {q}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="flex items-center gap-2 text-xs text-slate-600">
                <span className="font-medium">Segment</span>
                <select
                  value={filters.accountType}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, accountType: e.target.value }))
                  }
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:border-teal-600"
                >
                  <option value="All">All Segments (6)</option>
                  {metadata?.filters.accountTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-600">
                <span className="font-medium">Territory</span>
                <select
                  value={filters.territory}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, territory: e.target.value }))
                  }
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-mono text-slate-900 focus:outline-none focus:border-teal-600"
                >
                  <option value="All">All Territories (5)</option>
                  {metadata?.filters.territories.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() =>
                    setFilters({ quarter: 'All', accountType: 'All', territory: 'All' })
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-teal-700 hover:text-teal-900 whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset Filters
                </button>
              )}
            </div>

            <div className="text-xs font-mono text-slate-500">
              Snapshot Date: {metadata?.snapshotDate ?? '2026-10-01'}
            </div>
          </div>
        )}

        {activeView === 'executive' && (
          <ExecutiveSummaryView
            data={execData}
            loading={execLoading}
            error={execError}
            selectedQuarter={filters.quarter}
          />
        )}

        {activeView === 'attribution' && (
          <AttributionView
            data={attrData}
            loading={attrLoading}
            error={attrError}
          />
        )}

        {activeView === 'health' && (
          <AccountHealthView
            data={healthData}
            loading={healthLoading}
            error={healthError}
            statusFilter={healthStatusFilter}
            onStatusFilterChange={setHealthStatusFilter}
            searchQuery={healthSearch}
            onSearchQueryChange={setHealthSearch}
            onSelectAccount={openAccountDrawer}
            onSelectSegmentFilter={(seg) =>
              setFilters((prev) => ({ ...prev, accountType: seg }))
            }
            activeSegmentFilter={filters.accountType}
          />
        )}

        {activeView === 'qa' && <WarehouseQaView />}
      </main>

      {/* Clean Minimal Footer */}
      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            contextpaas.ai · Case Study 05 · Commercial Systems Architect
          </div>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setActiveView('health')}
              className="hover:text-slate-900 transition-colors"
            >
              Account Health Triage
            </button>
            <button
              type="button"
              onClick={() => setActiveView('qa')}
              className="hover:text-slate-900 transition-colors"
            >
              Text-to-SQL Warehouse
            </button>
            <button
              type="button"
              onClick={() => setReadmeOpen(true)}
              className="hover:text-slate-900 transition-colors font-medium text-slate-700"
            >
              NetSuite + HubSpot Migration README
            </button>
          </div>
        </div>
      </footer>

      {/* Slide-Over Account Order Timeline Drawer */}
      <AccountDetailDrawer
        accountId={selectedAccountId}
        detail={accountDetail}
        loading={accountLoading}
        onClose={() => setSelectedAccountId(null)}
      />

      {/* Architecture & Migration README Modal */}
      <ArchitectureReadmeView
        open={readmeOpen}
        onClose={() => setReadmeOpen(false)}
      />
    </div>
  );
}
