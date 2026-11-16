import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateCommercialDataset } from './seedData.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface WarehouseFilters {
  quarter?: string;
  accountType?: string;
  territory?: string;
}

export interface SqlModelArtifact {
  name: string;
  layer: 'Staging' | 'Dimension' | 'Marts';
  sql: string;
}

class CommercialWarehouse {
  private db: Database.Database;
  private sqlModels: SqlModelArtifact[] = [];

  constructor() {
    this.db = new Database(':memory:');
    this.initialize();
  }

  private initialize() {
    const { accounts, orders, marketingSpend } = generateCommercialDataset();

    this.db.exec(`
      CREATE TABLE raw_accounts (
        account_id TEXT PRIMARY KEY,
        account_name TEXT NOT NULL,
        account_type TEXT NOT NULL,
        org_territory TEXT NOT NULL,
        first_touch_date TEXT NOT NULL,
        first_touch_source TEXT NOT NULL,
        cohort_behavior TEXT NOT NULL
      );

      CREATE TABLE raw_orders (
        order_id TEXT PRIMARY KEY,
        order_date TEXT NOT NULL,
        account_id TEXT NOT NULL,
        account_name TEXT NOT NULL,
        account_type TEXT NOT NULL,
        product_line TEXT NOT NULL,
        sku TEXT NOT NULL,
        order_category TEXT NOT NULL,
        units INTEGER NOT NULL,
        revenue REAL NOT NULL,
        channel TEXT NOT NULL,
        lead_source TEXT NOT NULL,
        first_touch_date TEXT NOT NULL,
        last_touch_date TEXT,
        org_territory TEXT NOT NULL
      );

      CREATE TABLE raw_marketing_spend (
        fiscal_quarter TEXT NOT NULL,
        lead_source TEXT NOT NULL,
        program_spend REAL NOT NULL,
        campaign_notes TEXT NOT NULL,
        PRIMARY KEY (fiscal_quarter, lead_source)
      );

      CREATE INDEX idx_raw_orders_date ON raw_orders(order_date);
      CREATE INDEX idx_raw_orders_account ON raw_orders(account_id);
      CREATE INDEX idx_raw_orders_type ON raw_orders(account_type);
    `);

    const insertAccount = this.db.prepare(`
      INSERT INTO raw_accounts (
        account_id, account_name, account_type, org_territory,
        first_touch_date, first_touch_source, cohort_behavior
      ) VALUES (
        @account_id, @account_name, @account_type, @org_territory,
        @first_touch_date, @first_touch_source, @cohort_behavior
      )
    `);

    const insertOrder = this.db.prepare(`
      INSERT INTO raw_orders (
        order_id, order_date, account_id, account_name, account_type,
        product_line, sku, order_category, units, revenue,
        channel, lead_source, first_touch_date, last_touch_date, org_territory
      ) VALUES (
        @order_id, @order_date, @account_id, @account_name, @account_type,
        @product_line, @sku, @order_category, @units, @revenue,
        @channel, @lead_source, @first_touch_date, @last_touch_date, @org_territory
      )
    `);

    const insertSpend = this.db.prepare(`
      INSERT INTO raw_marketing_spend (
        fiscal_quarter, lead_source, program_spend, campaign_notes
      ) VALUES (
        @fiscal_quarter, @lead_source, @program_spend, @campaign_notes
      )
    `);

    const seedTx = this.db.transaction(() => {
      for (const acc of accounts) insertAccount.run(acc);
      for (const ord of orders) insertOrder.run(ord);
      for (const sp of marketingSpend) insertSpend.run(sp);
    });
    seedTx();

    const sqlFiles: { file: string; layer: SqlModelArtifact['layer'] }[] = [
      { file: '01_staging.sql', layer: 'Staging' },
      { file: '02_dim_account.sql', layer: 'Dimension' },
      { file: '03_marts.sql', layer: 'Marts' },
    ];

    for (const item of sqlFiles) {
      const sqlPath = path.join(__dirname, 'sql', item.file);
      const sqlText = fs.readFileSync(sqlPath, 'utf-8');
      this.db.exec(sqlText);
      this.sqlModels.push({
        name: item.file,
        layer: item.layer,
        sql: sqlText,
      });
    }

    // Add analytical indexes on materialized mart tables for fast interactive slicing
    this.db.exec(`
      CREATE INDEX idx_mart_attr_qtr ON mart_order_attribution(fiscal_quarter);
      CREATE INDEX idx_mart_attr_acct ON mart_order_attribution(account_id);
      CREATE INDEX idx_mart_health_status ON mart_account_health(health_status);
    `);
  }

  private buildWhereClause(filters: WarehouseFilters, alias = ''): {
    whereSql: string;
    params: Record<string, string>;
  } {
    const prefix = alias ? `${alias}.` : '';
    const clauses: string[] = [];
    const params: Record<string, string> = {};

    if (filters.quarter && filters.quarter !== 'All') {
      clauses.push(`${prefix}fiscal_quarter = @quarter`);
      params.quarter = filters.quarter;
    }
    if (filters.accountType && filters.accountType !== 'All') {
      clauses.push(`${prefix}account_type = @accountType`);
      params.accountType = filters.accountType;
    }
    if (filters.territory && filters.territory !== 'All') {
      clauses.push(`${prefix}org_territory = @territory`);
      params.territory = filters.territory;
    }

    return {
      whereSql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
      params,
    };
  }

  public getMetadata() {
    const counts = this.db
      .prepare(`
        SELECT
          (SELECT COUNT(*) FROM raw_orders) AS total_orders,
          (SELECT COUNT(*) FROM dim_account) AS total_accounts,
          (SELECT COUNT(DISTINCT product_line) FROM raw_orders) AS product_lines,
          (SELECT COUNT(DISTINCT fiscal_quarter) FROM stg_orders) AS total_quarters,
          (SELECT ROUND(SUM(revenue), 0) FROM stg_orders) AS total_revenue,
          (SELECT COUNT(*) FROM mart_account_health WHERE health_status = 'Quiet') AS quiet_accounts,
          (SELECT COUNT(*) FROM mart_account_health WHERE health_status = 'Under-Buying') AS under_buying_accounts
      `)
      .get() as Record<string, number>;

    const quarters = this.db
      .prepare(`SELECT DISTINCT fiscal_quarter FROM stg_orders ORDER BY fiscal_quarter`)
      .all()
      .map((r: unknown) => (r as { fiscal_quarter: string }).fiscal_quarter);

    const accountTypes = this.db
      .prepare(`SELECT DISTINCT account_type FROM dim_account ORDER BY account_type`)
      .all()
      .map((r: unknown) => (r as { account_type: string }).account_type);

    const territories = this.db
      .prepare(`SELECT DISTINCT org_territory FROM dim_account ORDER BY org_territory`)
      .all()
      .map((r: unknown) => (r as { org_territory: string }).org_territory);

    return {
      counts,
      filters: { quarters, accountTypes, territories },
      snapshotDate: '2026-10-01',
    };
  }

  public getExecutiveSummary(filters: WarehouseFilters) {
    // Quarterly series ignores quarter filter so the 8-quarter trendline remains readable, while respecting accountType & territory
    const trendFilter = this.buildWhereClause({
      accountType: filters.accountType,
      territory: filters.territory,
    });
    const fullFilter = this.buildWhereClause(filters);

    const quarterly = this.db
      .prepare(`
        SELECT
          fiscal_quarter,
          ROUND(SUM(revenue), 0) AS revenue,
          COUNT(*) AS orders,
          COUNT(DISTINCT account_id) AS buying_accounts,
          ROUND(SUM(CASE WHEN buyer_type = 'New' THEN revenue ELSE 0 END), 0) AS new_account_revenue,
          ROUND(SUM(CASE WHEN buyer_type = 'Repeat' THEN revenue ELSE 0 END), 0) AS repeat_account_revenue,
          ROUND(SUM(CASE WHEN order_category = 'Catalog' THEN revenue ELSE 0 END), 0) AS catalog_revenue,
          ROUND(SUM(CASE WHEN order_category = 'Custom' THEN revenue ELSE 0 END), 0) AS custom_revenue
        FROM mart_order_attribution
        ${trendFilter.whereSql}
        GROUP BY fiscal_quarter
        ORDER BY fiscal_quarter
      `)
      .all(trendFilter.params) as Array<{
        fiscal_quarter: string;
        revenue: number;
        orders: number;
        buying_accounts: number;
        new_account_revenue: number;
        repeat_account_revenue: number;
        catalog_revenue: number;
        custom_revenue: number;
      }>;

    const quarterlyWithGrowth = quarterly.map((row, idx) => {
      const prev = idx > 0 ? quarterly[idx - 1].revenue : null;
      const qoqGrowthPct =
        prev && prev > 0 ? Number((((row.revenue - prev) / prev) * 100).toFixed(1)) : null;
      return { ...row, qoq_growth_pct: qoqGrowthPct };
    });

    const summary = this.db
      .prepare(`
        SELECT
          ROUND(COALESCE(SUM(revenue), 0), 0) AS total_revenue,
          COUNT(*) AS total_orders,
          COUNT(DISTINCT account_id) AS buying_accounts,
          ROUND(COALESCE(AVG(revenue), 0), 0) AS avg_order_value,
          ROUND(COALESCE(SUM(CASE WHEN buyer_type = 'New' THEN revenue ELSE 0 END), 0), 0) AS new_account_revenue,
          ROUND(COALESCE(SUM(CASE WHEN buyer_type = 'Repeat' THEN revenue ELSE 0 END), 0), 0) AS repeat_account_revenue,
          ROUND(COALESCE(SUM(CASE WHEN order_category = 'Catalog' THEN revenue ELSE 0 END), 0), 0) AS catalog_revenue,
          ROUND(COALESCE(SUM(CASE WHEN order_category = 'Custom' THEN revenue ELSE 0 END), 0), 0) AS custom_revenue
        FROM mart_order_attribution
        ${fullFilter.whereSql}
      `)
      .get(fullFilter.params) as Record<string, number>;

    const productQuarterMatrix = this.db
      .prepare(`
        SELECT
          fiscal_quarter,
          product_line,
          ROUND(SUM(revenue), 0) AS revenue,
          ROUND(SUM(CASE WHEN order_category = 'Catalog' THEN revenue ELSE 0 END), 0) AS catalog_revenue,
          ROUND(SUM(CASE WHEN order_category = 'Custom' THEN revenue ELSE 0 END), 0) AS custom_revenue,
          SUM(units) AS units,
          COUNT(*) AS orders
        FROM mart_order_attribution
        ${fullFilter.whereSql}
        GROUP BY fiscal_quarter, product_line
        ORDER BY fiscal_quarter, revenue DESC
      `)
      .all(fullFilter.params);

    const productTotals = this.db
      .prepare(`
        SELECT
          product_line,
          ROUND(SUM(revenue), 0) AS revenue,
          ROUND(SUM(CASE WHEN order_category = 'Catalog' THEN revenue ELSE 0 END), 0) AS catalog_revenue,
          ROUND(SUM(CASE WHEN order_category = 'Custom' THEN revenue ELSE 0 END), 0) AS custom_revenue,
          COUNT(*) AS orders,
          COUNT(DISTINCT account_id) AS buying_accounts
        FROM mart_order_attribution
        ${fullFilter.whereSql}
        GROUP BY product_line
        ORDER BY revenue DESC
      `)
      .all(fullFilter.params);

    const segmentTotals = this.db
      .prepare(`
        SELECT
          account_type,
          ROUND(SUM(revenue), 0) AS revenue,
          COUNT(DISTINCT account_id) AS buying_accounts,
          COUNT(*) AS orders,
          ROUND(SUM(CASE WHEN order_category = 'Custom' THEN revenue ELSE 0 END) * 100.0 / NULLIF(SUM(revenue), 0), 1) AS custom_share_pct
        FROM mart_order_attribution
        ${fullFilter.whereSql}
        GROUP BY account_type
        ORDER BY revenue DESC
      `)
      .all(fullFilter.params);

    // Compute YoY latest-quarter growth (2026-Q3 vs 2025-Q3) on filtered trend
    const q2026Q3 = quarterlyWithGrowth.find((q) => q.fiscal_quarter === '2026-Q3');
    const q2025Q3 = quarterlyWithGrowth.find((q) => q.fiscal_quarter === '2025-Q3');
    const yoyGrowthPct =
      q2026Q3 && q2025Q3 && q2025Q3.revenue > 0
        ? Number((((q2026Q3.revenue - q2025Q3.revenue) / q2025Q3.revenue) * 100).toFixed(1))
        : null;

    return {
      summary: { ...summary, yoy_growth_pct: yoyGrowthPct },
      quarterly: quarterlyWithGrowth,
      productQuarterMatrix,
      productTotals,
      segmentTotals,
    };
  }

  public getAttributionData(filters: WarehouseFilters) {
    const orderFilter = this.buildWhereClause(filters);
    const spendClause =
      filters.quarter && filters.quarter !== 'All' ? 'WHERE fiscal_quarter = @quarter' : '';
    const spendParams =
      filters.quarter && filters.quarter !== 'All' ? { quarter: filters.quarter } : {};

    const overview = this.db
      .prepare(`
        SELECT
          ROUND(COALESCE(SUM(revenue), 0), 0) AS total_revenue,
          ROUND(COALESCE(SUM(CASE WHEN is_marketing_influenced = 1 THEN revenue ELSE 0 END), 0), 0) AS influenced_revenue,
          COUNT(*) AS total_orders,
          SUM(CASE WHEN is_marketing_influenced = 1 THEN 1 ELSE 0 END) AS influenced_orders,
          ROUND(AVG(CASE WHEN is_marketing_influenced = 1 THEN touch_to_order_days END), 1) AS avg_touch_to_order_days,
          ROUND(AVG(journey_length_days), 1) AS avg_journey_days
        FROM mart_order_attribution
        ${orderFilter.whereSql}
      `)
      .get(orderFilter.params) as Record<string, number>;

    const totalSpendRow = this.db
      .prepare(`SELECT ROUND(COALESCE(SUM(program_spend), 0), 0) AS total_program_spend FROM stg_marketing_spend ${spendClause}`)
      .get(spendParams) as { total_program_spend: number };

    const totalProgramSpend = totalSpendRow.total_program_spend || 0;
    const blendedRoas =
      totalProgramSpend > 0
        ? Number((overview.influenced_revenue / totalProgramSpend).toFixed(2))
        : 0;

    // Channel/lead-source comparison respecting accountType/territory filters too
    const influencedClause = orderFilter.whereSql
      ? `${orderFilter.whereSql} AND is_marketing_influenced = 1`
      : 'WHERE is_marketing_influenced = 1';

    const byLeadSource = this.db
      .prepare(`
        WITH spend AS (
          SELECT
            lead_source,
            SUM(program_spend) AS program_spend,
            MAX(campaign_notes) AS campaign_notes
          FROM stg_marketing_spend
          ${spendClause}
          GROUP BY lead_source
        ),
        ft AS (
          SELECT
            first_touch_source AS lead_source,
            COUNT(*) AS first_touch_orders,
            ROUND(SUM(revenue), 0) AS first_touch_revenue
          FROM mart_order_attribution
          ${influencedClause}
          GROUP BY first_touch_source
        ),
        lt AS (
          SELECT
            last_touch_source AS lead_source,
            COUNT(*) AS last_touch_orders,
            ROUND(SUM(revenue), 0) AS last_touch_revenue
          FROM mart_order_attribution
          ${influencedClause}
          GROUP BY last_touch_source
        )
        SELECT
          sp.lead_source,
          sp.program_spend,
          sp.campaign_notes,
          COALESCE(ft.first_touch_orders, 0) AS first_touch_orders,
          COALESCE(ft.first_touch_revenue, 0) AS first_touch_revenue,
          ROUND(COALESCE(ft.first_touch_revenue, 0) * 1.0 / NULLIF(sp.program_spend, 0), 2) AS first_touch_roas,
          COALESCE(lt.last_touch_orders, 0) AS last_touch_orders,
          COALESCE(lt.last_touch_revenue, 0) AS last_touch_revenue,
          ROUND(COALESCE(lt.last_touch_revenue, 0) * 1.0 / NULLIF(sp.program_spend, 0), 2) AS last_touch_roas,
          COALESCE(ft.first_touch_revenue, 0) - COALESCE(lt.last_touch_revenue, 0) AS attribution_delta_rev
        FROM spend sp
        LEFT JOIN ft ON sp.lead_source = ft.lead_source
        LEFT JOIN lt ON sp.lead_source = lt.lead_source
        ORDER BY first_touch_revenue DESC
      `)
      .all({ ...orderFilter.params, ...spendParams });

    const bySalesChannel = this.db
      .prepare(`
        SELECT
          channel,
          COUNT(*) AS orders,
          ROUND(SUM(revenue), 0) AS revenue,
          ROUND(SUM(CASE WHEN is_marketing_influenced = 1 THEN revenue ELSE 0 END), 0) AS influenced_revenue,
          ROUND(SUM(CASE WHEN is_marketing_influenced = 1 THEN revenue ELSE 0 END) * 100.0 / NULLIF(SUM(revenue), 0), 1) AS influenced_share_pct
        FROM mart_order_attribution
        ${orderFilter.whereSql}
        GROUP BY channel
        ORDER BY revenue DESC
      `)
      .all(orderFilter.params);

    const quarterlyAttributionTrend = this.db
      .prepare(`
        SELECT
          sp.fiscal_quarter,
          ROUND(SUM(sp.program_spend), 0) AS program_spend,
          ROUND(COALESCE(ord.influenced_revenue, 0), 0) AS influenced_revenue,
          ROUND(COALESCE(ord.total_revenue, 0), 0) AS total_revenue,
          ROUND(COALESCE(ord.influenced_revenue, 0) * 1.0 / NULLIF(SUM(sp.program_spend), 0), 2) AS blended_roas
        FROM stg_marketing_spend sp
        LEFT JOIN (
          SELECT
            fiscal_quarter,
            SUM(revenue) AS total_revenue,
            SUM(CASE WHEN is_marketing_influenced = 1 THEN revenue ELSE 0 END) AS influenced_revenue
          FROM mart_order_attribution
          ${this.buildWhereClause({ accountType: filters.accountType, territory: filters.territory }).whereSql}
          GROUP BY fiscal_quarter
        ) ord ON sp.fiscal_quarter = ord.fiscal_quarter
        GROUP BY sp.fiscal_quarter
        ORDER BY sp.fiscal_quarter
      `)
      .all(
        this.buildWhereClause({ accountType: filters.accountType, territory: filters.territory }).params
      );

    return {
      overview: {
        ...overview,
        total_program_spend: totalProgramSpend,
        blended_roas: blendedRoas,
        influenced_share_pct:
          overview.total_revenue > 0
            ? Number(((overview.influenced_revenue / overview.total_revenue) * 100).toFixed(1))
            : 0,
      },
      byLeadSource,
      bySalesChannel,
      quarterlyAttributionTrend,
    };
  }

  public getAccountHealthData(params: {
    status?: string;
    accountType?: string;
    territory?: string;
    search?: string;
  }) {
    const clauses: string[] = [];
    const bind: Record<string, string> = {};

    if (params.status && params.status !== 'All') {
      clauses.push('health_status = @status');
      bind.status = params.status;
    }
    if (params.accountType && params.accountType !== 'All') {
      clauses.push('account_type = @accountType');
      bind.accountType = params.accountType;
    }
    if (params.territory && params.territory !== 'All') {
      clauses.push('org_territory = @territory');
      bind.territory = params.territory;
    }
    if (params.search && params.search.trim()) {
      clauses.push('(LOWER(account_name) LIKE @search OR LOWER(account_id) LIKE @search)');
      bind.search = `%${params.search.trim().toLowerCase()}%`;
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

    // Summary KPIs respect accountType and territory filters (ignoring status filter so all 3 status buckets remain visible)
    const baseClauses: string[] = [];
    const baseBind: Record<string, string> = {};
    if (params.accountType && params.accountType !== 'All') {
      baseClauses.push('account_type = @accountType');
      baseBind.accountType = params.accountType;
    }
    if (params.territory && params.territory !== 'All') {
      baseClauses.push('org_territory = @territory');
      baseBind.territory = params.territory;
    }
    const baseWhere = baseClauses.length > 0 ? `WHERE ${baseClauses.join(' AND ')}` : '';

    const kpis = this.db
      .prepare(`
        SELECT
          COUNT(*) AS total_accounts,
          SUM(CASE WHEN health_status = 'Quiet' THEN 1 ELSE 0 END) AS quiet_count,
          SUM(CASE WHEN health_status = 'Under-Buying' THEN 1 ELSE 0 END) AS under_buying_count,
          SUM(CASE WHEN health_status = 'Healthy' THEN 1 ELSE 0 END) AS healthy_count,
          ROUND(SUM(CASE WHEN health_status IN ('Quiet', 'Under-Buying') THEN annualized_gap_value ELSE 0 END), 0) AS annualized_revenue_at_risk,
          ROUND(AVG(days_since_last_order), 0) AS avg_days_since_order
        FROM mart_account_health
        ${baseWhere}
      `)
      .get(baseBind);

    const segmentBenchmarks = this.db
      .prepare(`
        SELECT
          account_type,
          COUNT(*) AS total_accounts,
          SUM(CASE WHEN health_status = 'Quiet' THEN 1 ELSE 0 END) AS quiet_count,
          SUM(CASE WHEN health_status = 'Under-Buying' THEN 1 ELSE 0 END) AS under_buying_count,
          SUM(CASE WHEN health_status = 'Healthy' THEN 1 ELSE 0 END) AS healthy_count,
          ROUND(MAX(segment_benchmark_quarterly_rev), 0) AS segment_benchmark_quarterly_rev,
          MAX(segment_quiet_threshold_days) AS quiet_threshold_days,
          ROUND(AVG(trailing_quarterly_avg), 0) AS actual_avg_quarterly_rev,
          ROUND(SUM(annualized_gap_value), 0) AS segment_at_risk_arr
        FROM mart_account_health
        ${baseWhere}
        GROUP BY account_type
        ORDER BY segment_at_risk_arr DESC
      `)
      .all(baseBind);

    const accounts = this.db
      .prepare(`
        SELECT
          account_id,
          account_name,
          account_type,
          org_territory,
          health_status,
          days_since_last_order,
          segment_quiet_threshold_days,
          last_order_date,
          total_orders,
          ROUND(lifetime_revenue, 0) AS lifetime_revenue,
          ROUND(trailing_quarterly_avg, 0) AS trailing_quarterly_avg,
          ROUND(segment_benchmark_quarterly_rev, 0) AS segment_benchmark_quarterly_rev,
          benchmark_ratio,
          ROUND(trailing_180d_revenue, 0) AS trailing_180d_revenue,
          ROUND(prior_180d_revenue, 0) AS prior_180d_revenue,
          ROUND(annualized_gap_value, 0) AS annualized_gap_value,
          recommended_action,
          first_touch_source
        FROM mart_account_health
        ${whereSql}
        ORDER BY
          CASE health_status WHEN 'Quiet' THEN 1 WHEN 'Under-Buying' THEN 2 ELSE 3 END,
          annualized_gap_value DESC,
          lifetime_revenue DESC
        LIMIT 200
      `)
      .all(bind);

    return { kpis, segmentBenchmarks, accounts };
  }

  public getAccountDetail(accountId: string) {
    const account = this.db
      .prepare(`SELECT * FROM mart_account_health WHERE account_id = ?`)
      .get(accountId);

    if (!account) return null;

    const orders = this.db
      .prepare(`
        SELECT
          order_id,
          order_date,
          fiscal_quarter,
          product_line,
          sku,
          order_category,
          units,
          ROUND(revenue, 0) AS revenue,
          channel,
          last_touch_source,
          last_touch_date,
          touch_to_order_days,
          buyer_type,
          is_marketing_influenced
        FROM mart_order_attribution
        WHERE account_id = ?
        ORDER BY order_date DESC
      `)
      .all(accountId);

    const quarterlyTrend = this.db
      .prepare(`
        SELECT
          fiscal_quarter,
          ROUND(SUM(revenue), 0) AS revenue,
          COUNT(*) AS orders
        FROM mart_order_attribution
        WHERE account_id = ?
        GROUP BY fiscal_quarter
        ORDER BY fiscal_quarter
      `)
      .all(accountId);

    const productMix = this.db
      .prepare(`
        SELECT
          product_line,
          order_category,
          COUNT(*) AS orders,
          ROUND(SUM(revenue), 0) AS revenue
        FROM mart_order_attribution
        WHERE account_id = ?
        GROUP BY product_line, order_category
        ORDER BY revenue DESC
      `)
      .all(accountId);

    return { account, orders, quarterlyTrend, productMix };
  }

  public getSqlModels(): SqlModelArtifact[] {
    return this.sqlModels;
  }

  public getWarehouseSchemaPrompt(): string {
    return `
SQLite Warehouse Schema (24 months: 2024-10-01 to 2026-09-30, snapshot_date = '2026-10-01'):

1. Table: mart_order_attribution (3,000+ rows, one row per order)
   Columns:
   - order_id (TEXT)
   - order_date (TEXT YYYY-MM-DD)
   - fiscal_quarter (TEXT, values: '2024-Q4', '2025-Q1', '2025-Q2', '2025-Q3', '2025-Q4', '2026-Q1', '2026-Q2', '2026-Q3')
   - fiscal_year (INTEGER: 2024, 2025, 2026)
   - account_id (TEXT)
   - account_name (TEXT)
   - account_type (TEXT, exact values: 'Biopharma', 'CDMO', 'CRO', 'Academic', 'Clinical Lab', 'OEM')
   - org_territory (TEXT, exact values: 'NA-East', 'NA-West', 'EU-North', 'EU-DACH', 'APAC')
   - product_line (TEXT, exact values: 'qPCR & dPCR Reagents', 'NGS Library Prep', 'Cell Culture Media', 'Chromatography Resins', 'Automated Liquid Handling', 'Diagnostic Assay Kits')
   - sku (TEXT)
   - order_category (TEXT, exact values: 'Catalog', 'Custom')
   - units (INTEGER)
   - revenue (REAL, USD)
   - channel (TEXT, exact values: 'Field Sales', 'Inside Sales', 'E-Commerce Portal', 'Distributor Partner', 'OEM Direct')
   - account_order_seq (INTEGER)
   - buyer_type (TEXT, exact values: 'New', 'Repeat')
   - first_touch_date (TEXT YYYY-MM-DD)
   - first_touch_source (TEXT: 'Trade Conference', 'Technical Whitepaper', 'Scientific Webinar', 'Organic Search', 'Paid Search', 'Email Nurture', 'Partner Referral', 'Outbound SDR')
   - last_touch_date (TEXT YYYY-MM-DD or NULL)
   - last_touch_source (TEXT, same values as first_touch_source)
   - touch_to_order_days (INTEGER or NULL)
   - journey_length_days (INTEGER)
   - is_marketing_influenced (INTEGER: 1 if last_touch_date within 90 days of order, else 0)

2. Table: dim_account (400 rows, one row per account)
   Columns: account_id, account_name, account_type, org_territory, first_touch_date, first_touch_source, first_order_date, first_order_quarter, last_order_date, total_orders, lifetime_revenue, catalog_revenue, custom_revenue, avg_order_value, segment_benchmark_quarterly_rev, segment_quiet_threshold_days

3. Table: mart_account_health (400 rows, one row per account)
   Columns: account_id, account_name, account_type, org_territory, first_order_date, last_order_date, days_since_last_order, segment_quiet_threshold_days, total_orders, lifetime_revenue, catalog_revenue, custom_revenue, trailing_180d_revenue, prior_180d_revenue, trailing_quarterly_avg, latest_qtr_revenue, trailing_180d_orders, segment_benchmark_quarterly_rev, benchmark_ratio, first_touch_source, health_status ('Healthy', 'Under-Buying', 'Quiet'), annualized_gap_value, recommended_action

4. Table: mart_attribution_comparison (64 rows, 8 quarters x 8 lead sources)
   Columns: fiscal_quarter, lead_source, program_spend, campaign_notes, first_touch_orders, first_touch_revenue, first_touch_roas, last_touch_orders, last_touch_revenue, last_touch_roas, attribution_delta_rev

5. Table: mart_quarterly_product_revenue
   Columns: fiscal_quarter, product_line, order_category, account_type, org_territory, buyer_type, order_count, total_units, total_revenue, buying_accounts
`;
  }

  public executeSafeReadQuery(rawSql: string): {
    sql: string;
    columns: string[];
    rows: Record<string, unknown>[];
    rowCount: number;
    executionMs: number;
  } {
    const cleaned = rawSql
      .trim()
      .replace(/^```sql\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim()
      .replace(/;+\s*$/, '');

    if (!cleaned) {
      throw new Error('SQL query is empty.');
    }

    // Disallow multiple statements
    if (cleaned.includes(';')) {
      throw new Error('Only a single read-only SELECT or WITH statement is permitted.');
    }

    const upper = cleaned.toUpperCase();
    if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) {
      throw new Error('Only SELECT or WITH queries are allowed against the warehouse.');
    }

    const forbidden = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|ATTACH|DETACH|PRAGMA|CREATE|REPLACE|VACUUM|REINDEX)\b/i;
    if (forbidden.test(cleaned)) {
      throw new Error('Query contains disallowed write or DDL keywords.');
    }

    const start = performance.now();
    const stmt = this.db.prepare(cleaned);
    const rows = stmt.all() as Record<string, unknown>[];
    const limitedRows = rows.slice(0, 250);
    const columns =
      limitedRows.length > 0
        ? Object.keys(limitedRows[0])
        : stmt.columns().map((c) => c.name);
    const executionMs = Number((performance.now() - start).toFixed(2));

    return {
      sql: cleaned,
      columns,
      rows: limitedRows,
      rowCount: rows.length,
      executionMs,
    };
  }
}

export const warehouse = new CommercialWarehouse();
