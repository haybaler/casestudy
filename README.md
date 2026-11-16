# Commercial Systems Architect — Life Sciences Commercial Intelligence Layer

> **Portfolio Case Study 05 · contextpaas.ai**  
> An end-to-end commercial intelligence warehouse, SQL transformation layer, executive analytics console, and Gemini text-to-SQL interface built for a diagnostics and biotech tools company (~3,000 orders, 400 accounts, 6 product lines, 24 months).

---

## 1. Architectural Decisions & Tradeoffs

### 1.1 Layered SQL Warehouse (`raw` → `staging` → `dim` → `marts`)
- **Decision:** Materialize transformations as explicit, sequential SQL scripts (`01_staging.sql`, `02_dim_account.sql`, `03_marts.sql`) inside an embedded SQLite warehouse rather than computing metrics in TypeScript arrays.
- **Why:** Commercial logic (fiscal quarter boundaries, 90-day marketing influence windows, new-vs-repeat cohorting, and segment reorder benchmarks) belongs in auditable, version-controlled SQL so both the UI endpoints and the plain-English text-to-SQL engine query the exact same source of truth.
- **Tradeoff:** SQLite in-process storage gives zero-ops portability and sub-millisecond analytical reads at 3k–500k rows, at the cost of lacking native dbt incremental materialization, row-level security, and columnar compression (which Snowflake/BigQuery/Postgres provide in production).

### 1.2 Dual Attribution Model (First-Touch vs. Last-Touch)
- **Decision:** Maintain `first_touch_source` / `first_touch_date` on `dim_account` (originating demand-creation touch) and `last_touch_source` / `last_touch_date` on `stg_orders` (most recent pre-order conversion touch within a 90-day window).
- **Why:** Life sciences capital equipment and custom assay sales cycles run 60–180 days. Pure last-touch attribution systematically starves upper-funnel technical investments (trade conferences like AACR/SLAS, application whitepapers) while over-crediting bottom-of-funnel email nurtures and branded paid search.
- **Tradeoff:** We omitted multi-touch W-shaped or Markov fractional credit to keep dollar reconciliation intuitive (`SUM(first_touch_revenue) = SUM(last_touch_revenue) = Marketing-Influenced Revenue`). Adding fractional touch weights is a straightforward extension once multi-contact engagement tables exist.

### 1.3 Account Health Scoring (Quiet Cadence + Segment Benchmark)
- **Decision:** Flag accounts along two orthogonal failure modes rather than a single opaque "health score":
  1. **Quiet (`days_since_last_order > segment_quiet_threshold_days`):** Detects silent churn before renewal/budget cycle loss.
  2. **Under-Buying (`trailing_quarterly_avg < 0.62 * segment_benchmark_quarterly_rev` or `>35%` half-over-half drop):** Detects share-of-wallet erosion where an account still orders low-margin catalog tips/reagents while defecting to a competitor for high-margin custom assays or chromatography resins.
- **Why:** Commercial VPs recognize "ordered catalog tips last month, stopped buying resins" immediately—whereas a composite `74/100` score hides what action a rep should take.
- **Tradeoff:** Using segment-level averages (`Biopharma`, `CDMO`, `CRO`, `Academic`, `Clinical Lab`, `OEM`) assumes relatively uniform purchasing potential within a segment. In production, benchmarks should stratify by account tier (e.g., clinical-stage vs. commercial-stage biopharma, headcount, or lab site count).

### 1.4 Guarded Server-Side Text-to-SQL (`@google/genai`)
- **Decision:** Translate plain-English questions via `gemini-4-hydrogen` with structured JSON output grounded in the exact mart/dimension DDL, enforce read-only SQL validation (`SELECT` / `WITH` only, blocking multi-statement `;` and all DDL/DML keywords), execute live against SQLite, and synthesize a brief numerical answer from the returned rows.
- **Why:** Exposes the generated SQL transparently to the user (and allows editing/re-running SQL directly) so an analyst or hiring manager can verify every number.

---

## 2. What Was Simplified in the Synthetic Data

To keep this demo self-contained and deterministic (`seed = 20261116`), several real-world commercial complexities were intentionally simplified:

1. **Order Grain vs. Invoice / Line-Item Grain:** Each synthetic row represents a single-SKU order (`order_id`), whereas real ERP orders contain multi-line headers, partial shipments, backorders, freight/tax lines, and credit memos/RMAs.
2. **Single Currency (USD):** All `revenue` and `program_spend` values are generated in USD, avoiding multi-currency (`EUR`, `GBP`, `JPY`, `CHF`) FX spot vs. budget rate conversions across `EU-North`, `EU-DACH`, and `APAC`.
3. **Clean Account Hierarchy:** Every order maps 1:1 to a single canonical `account_id` (`ACC-001`..`ACC-400`). Real biotech CRM/ERP data has parent-child lab hierarchies (e.g., *Pfizer Cambridge* vs. *Pfizer Groton* vs. *Pfizer Global Procurement*), distributor pass-through blind spots, and duplicate account records.
4. **Simplified Touch Lineage:** Each order stores a scalar `first_touch_date` and `last_touch_date` rather than a full many-to-many campaign touch log across multiple buying-committee contacts (PI, Lab Manager, Procurement).
5. **Fiscal Calendar Alignment:** All 24 months are modeled as 8 completed calendar quarters (`2024-Q4` through `2026-Q3`) with snapshot date `2026-10-01`, avoiding mid-quarter partial-period distortion in QoQ charts.

---

## 3. Running This Against Real NetSuite + HubSpot

To deploy this architecture on live **NetSuite (ERP)** and **HubSpot (CRM / Marketing Automation)** data for a commercial life-sciences organization, here is the exact migration plan:

### 3.1 Ingestion & Raw Layer
- **NetSuite:** Extract via Fivetran / Airbyte / Stitch (SuiteAnalytics Connect) on 1–4 hour incremental CDC syncs:
  - `netsuite.transaction` (`SalesOrd`, `CustInvc`, `CustCred` — filter out voided/memorized transactions and include credit memos as negative revenue).
  - `netsuite.transactionline` (line-level `item`, `quantity`, `netamount`, `department`/`class` for product line).
  - `netsuite.customer` (billing entity, parent company, `custentity_segment`, sales rep / territory).
  - `netsuite.item` (SKU master, `Catalog` vs `Custom/Configured` item flag, product family, standard cost for gross margin).
- **HubSpot:** Extract `contacts`, `companies`, `deals`, `engagements` (emails, calls, meetings), and `marketing_events` / campaign UTM touches, plus ad-platform spend (`Google Ads`, `LinkedIn`, event spreadsheets) into `raw_marketing_spend`.

### 3.2 Identity Resolution & Entity Stitching
- **The Hardest Problem in Biotech GTM:** NetSuite customers are *billing entities* (often `Accounts Payable` or a parent holding entity), while HubSpot contacts are *bench scientists and lab directors* at specific R&D sites.
- **Solution:** Introduce an intermediate `int_account_entity_bridge` model that maps `hubspot_company_id` ↔ `netsuite_customer_id` using:
  1. Explicit `netsuite_customer_id` custom property synced on HubSpot Companies.
  2. Fallback deterministic matching on normalized email domain + shipping address / DUNS / ZoomInfo parent ID, rolling site-level touches up to the purchasing parent account.

### 3.3 SQL Model Upgrades (dbt Core / Snowflake or BigQuery)
- Replace `01_staging.sql`..`03_marts.sql` with **dbt models** (`stg_*` views, `int_*` ephemeral/incremental models, `dim_*` & `fct_*` materialized tables) plus `dbt test` contracts (`unique`, `not_null`, `accepted_values`, and revenue reconciliation assertions against NetSuite GL).
- **Multi-Touch Attribution:** Build `int_touch_to_order_window` joining `fct_orders` to all HubSpot campaign touches across contacts linked to the buying account within a 180-day pre-order window, supporting First-Touch, Last-Touch, and Time-Decay comparisons side by side.
- **Margin-Aware Health:** Replace top-line revenue benchmarks with **Gross Margin Dollars** (`revenue - standard_cost`) so Custom vs. Catalog mix shifts are weighted by real contribution margin.
- **Operational Activation (Reverse ETL):** Push `mart_account_health` flags (`Quiet`, `Under-Buying`, `annualized_gap_value`, `recommended_action`) back into HubSpot Company properties and Slack territory alerts via Census / Hightouch every Monday at 07:00 local territory time.

---

## Local Development

```bash
npm install
npm run dev
```

Set `GEMINI_API_KEY` in your environment to enable live text-to-SQL translation on the **Warehouse Q&A** view.
