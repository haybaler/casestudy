import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { SqlModelArtifact } from '../types';

interface ArchitectureReadmeViewProps {
  open: boolean;
  onClose: () => void;
}

type ReadmeTab = 'decisions' | 'simplifications' | 'migration' | 'sql';

export function ArchitectureReadmeView({ open, onClose }: ArchitectureReadmeViewProps) {
  const [activeTab, setActiveTab] = useState<ReadmeTab>('decisions');
  const [models, setModels] = useState<SqlModelArtifact[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('01_staging.sql');
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    if (!open || models.length > 0) return;
    setLoadingModels(true);
    fetch('/api/models')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.models)) {
          setModels(data.models);
          if (data.models[0]) setSelectedModel(data.models[0].name);
        }
      })
      .finally(() => setLoadingModels(false));
  }, [open, models.length]);

  if (!open) return null;

  const activeSql = models.find((m) => m.name === selectedModel);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center items-start bg-slate-900/35 backdrop-blur-[1px] p-4 sm:p-8 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-mono text-slate-500">
              contextpaas.ai · Case Study 05 · Architecture &amp; Migration README
            </div>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">
              Commercial Systems Architect — Design Decisions &amp; Production Blueprint
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Architecture README"
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-Navigation */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-1">
          {[
            { id: 'decisions', label: '01. Decisions & Tradeoffs' },
            { id: 'simplifications', label: '02. Synthetic Data Simplifications' },
            { id: 'migration', label: '03. Real NetSuite + HubSpot Plan' },
            { id: 'sql', label: '04. Inspect Live SQL Models' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as ReadmeTab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? 'bg-white text-slate-900 border border-slate-200 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto text-sm text-slate-700 leading-relaxed space-y-6">
          {activeTab === 'decisions' && (
            <div className="space-y-6">
              <section>
                <h3 className="text-sm font-semibold text-slate-900">
                  1. Real Layered SQL Warehouse vs. Pre-Aggregated Frontend JSON
                </h3>
                <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                  Every dashboard chart and metric is computed inside an embedded SQLite warehouse initialized from explicit staging, dimension, and mart SQL scripts (<span className="font-mono">01_staging.sql</span> → <span className="font-mono">02_dim_account.sql</span> → <span className="font-mono">03_marts.sql</span>). Putting business logic in SQL rather than JavaScript ensures the UI endpoints and the plain-English text-to-SQL engine share one canonical definition of fiscal quarters, 90-day attribution windows, and new-vs-repeat cohorts.
                </p>
                <p className="mt-1.5 text-xs text-slate-500">
                  <strong>Tradeoff:</strong> SQLite provides zero-ops portability and sub-millisecond reads up to ~500k orders, while omitting Snowflake/BigQuery incremental dbt materializations and column-level RBAC.
                </p>
              </section>

              <section className="pt-4 border-t border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900">
                  2. First-Touch vs. Last-Touch Reconciliation (Zero Dollar Inflation)
                </h3>
                <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                  Biotech instrument and custom assay sales cycles run 60–180 days. Pure last-touch attribution systematically starves technical conferences (AACR, SLAS) and application whitepapers while over-crediting email nurtures and branded search. Keeping <span className="font-mono">first_touch_source</span> on <span className="font-mono">dim_account</span> and <span className="font-mono">last_touch_source</span> on <span className="font-mono">stg_orders</span> surfaces the ROAS distortion while preserving strict conservation of influenced revenue across both models.
                </p>
              </section>

              <section className="pt-4 border-t border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900">
                  3. Two-Axis Account Health (Silent Churn vs. Share-of-Wallet Erosion)
                </h3>
                <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                  Instead of an opaque 0–100 health score, <span className="font-mono">mart_account_health</span> separates two distinct commercial failure modes: <strong>Quiet</strong> accounts (days since last order exceeding segment cadence threshold) and <strong>Under-Buying</strong> accounts (still ordering small catalog consumables, but trailing quarterly spend fell below 62% of peer segment benchmark). Commercial leaders recognize this immediately—reps know whether to run a supply-continuity check or a custom-assay expansion QBR.
                </p>
              </section>

              <section className="pt-4 border-t border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900">
                  4. Guarded Read-Only Text-to-SQL
                </h3>
                <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                  Plain-English prompts are translated server-side by Gemini (<span className="font-mono">gemini-4-hydrogen</span>) with exact mart DDL context, validated to allow strictly single-statement <span className="font-mono">SELECT</span> or <span className="font-mono">WITH</span> queries, executed against SQLite, and summarized from returned rows. The generated SQL is always exposed and editable so hiring managers and analysts can audit the logic.
                </p>
              </section>
            </div>
          )}

          {activeTab === 'simplifications' && (
            <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
              <div className="border border-slate-200 rounded-md p-4">
                <div className="font-semibold text-slate-900">Order Grain vs. Invoice / Line-Item Grain</div>
                <p className="mt-1">
                  Each synthetic row represents a single-SKU order (<span className="font-mono">~3,000</span> rows across <span className="font-mono">400</span> accounts). Real biotech ERPs split orders into multi-line headers, partial lot shipments, backorders, freight/cold-chain surcharges, and credit memos.
                </p>
              </div>
              <div className="border border-slate-200 rounded-md p-4">
                <div className="font-semibold text-slate-900">Single Currency &amp; Clean Calendar Quarters</div>
                <p className="mt-1">
                  All transactions are denominated in USD across 8 completed calendar quarters (<span className="font-mono">2024-Q4</span> to <span className="font-mono">2026-Q3</span>) with snapshot date <span className="font-mono">2026-10-01</span>, avoiding EUR/GBP/JPY FX translation and mid-quarter partial-period comparison distortion.
                </p>
              </div>
              <div className="border border-slate-200 rounded-md p-4">
                <div className="font-semibold text-slate-900">1:1 Canonical Account Mapping</div>
                <p className="mt-1">
                  Every order maps cleanly to one <span className="font-mono">account_id</span>. Real life-sciences data contains multi-site R&amp;D campuses, centralized AP billing entities, distributor pass-through blind spots (e.g., Fisher/VWR sell-through reporting lag), and duplicate CRM accounts.
                </p>
              </div>
              <div className="border border-slate-200 rounded-md p-4">
                <div className="font-semibold text-slate-900">Scalar Touch Dates vs. Multi-Contact Committee Logs</div>
                <p className="mt-1">
                  Synthetic orders carry <span className="font-mono">first_touch_date</span> and <span className="font-mono">last_touch_date</span> directly rather than joining a many-to-many campaign engagement log across Principal Investigators, Lab Managers, and Procurement leads.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'migration' && (
            <div className="space-y-5 text-xs text-slate-600 leading-relaxed">
              <section>
                <h3 className="text-sm font-semibold text-slate-900">
                  1. NetSuite ERP Extraction (Orders, Invoices, Credit Memos &amp; Margin)
                </h3>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li>Extract <span className="font-mono">transaction</span> (<span className="font-mono">SalesOrd</span>, <span className="font-mono">CustInvc</span>, <span className="font-mono">CustCred</span>) and <span className="font-mono">transactionline</span> via Fivetran or SuiteAnalytics Connect on 2-hour incremental CDC syncs.</li>
                  <li>Exclude voided/memorized entries, net out credit memos/RMAs, and convert foreign currencies against daily <span className="font-mono">currencyrate</span> tables into corporate reporting USD.</li>
                  <li>Join <span className="font-mono">netsuite.item</span> for SKU standard cost so <span className="font-mono">mart_account_health</span> tracks Gross Margin Dollars rather than top-line revenue alone.</li>
                </ul>
              </section>

              <section className="pt-4 border-t border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900">
                  2. HubSpot CRM + Entity Stitching (The Hardest Biotech GTM Problem)
                </h3>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li>Extract HubSpot <span className="font-mono">contacts</span>, <span className="font-mono">companies</span>, <span className="font-mono">deals</span>, and <span className="font-mono">marketing_events</span> alongside Google Ads / LinkedIn / trade-show spend logs.</li>
                  <li>Build an <span className="font-mono">int_account_entity_bridge</span> model reconciling HubSpot lab-site Companies (where scientists engage) to NetSuite billing Customers (where POs book) via synced <span className="font-mono">netsuite_customer_id</span>, domain + shipping-site matching, and parent-child hierarchy rollups.</li>
                </ul>
              </section>

              <section className="pt-4 border-t border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900">
                  3. dbt Orchestration, Tests &amp; Reverse ETL Activation
                </h3>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li>Move SQL models into <strong>dbt Core</strong> on Snowflake or BigQuery with automated <span className="font-mono">dbt test</span> revenue reconciliation against NetSuite GL trial balances.</li>
                  <li>Push <span className="font-mono">mart_account_health</span> flags (<span className="font-mono">Quiet</span>, <span className="font-mono">Under-Buying</span>, <span className="font-mono">annualized_gap_value</span>) back to HubSpot Company records and weekly territory Slack digests via Census / Hightouch.</li>
                </ul>
              </section>
            </div>
          )}

          {activeTab === 'sql' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {models.map((m) => (
                  <button
                    key={m.name}
                    type="button"
                    onClick={() => setSelectedModel(m.name)}
                    className={`px-3 py-1.5 text-xs font-mono rounded border transition-colors whitespace-nowrap shrink-0 ${
                      selectedModel === m.name
                        ? 'bg-teal-700 text-white border-teal-700'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {m.name} ({m.layer})
                  </button>
                ))}
              </div>
              {loadingModels ? (
                <div className="h-64 bg-slate-100 rounded animate-pulse" />
              ) : activeSql ? (
                <pre className="p-4 bg-slate-900 text-slate-100 rounded-lg font-mono text-xs overflow-x-auto leading-relaxed">
                  {activeSql.sql}
                </pre>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
