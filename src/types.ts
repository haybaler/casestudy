export interface WarehouseMetadata {
  counts: {
    total_orders: number;
    total_accounts: number;
    product_lines: number;
    total_quarters: number;
    total_revenue: number;
    quiet_accounts: number;
    under_buying_accounts: number;
  };
  filters: {
    quarters: string[];
    accountTypes: string[];
    territories: string[];
  };
  snapshotDate: string;
}

export interface GlobalFilterState {
  quarter: string;
  accountType: string;
  territory: string;
}

export interface QuarterlyExecutiveRow {
  fiscal_quarter: string;
  revenue: number;
  orders: number;
  buying_accounts: number;
  new_account_revenue: number;
  repeat_account_revenue: number;
  catalog_revenue: number;
  custom_revenue: number;
  qoq_growth_pct: number | null;
}

export interface ExecutiveResponse {
  summary: {
    total_revenue: number;
    total_orders: number;
    buying_accounts: number;
    avg_order_value: number;
    new_account_revenue: number;
    repeat_account_revenue: number;
    catalog_revenue: number;
    custom_revenue: number;
    yoy_growth_pct: number | null;
  };
  quarterly: QuarterlyExecutiveRow[];
  productQuarterMatrix: Array<{
    fiscal_quarter: string;
    product_line: string;
    revenue: number;
    catalog_revenue: number;
    custom_revenue: number;
    units: number;
    orders: number;
  }>;
  productTotals: Array<{
    product_line: string;
    revenue: number;
    catalog_revenue: number;
    custom_revenue: number;
    orders: number;
    buying_accounts: number;
  }>;
  segmentTotals: Array<{
    account_type: string;
    revenue: number;
    buying_accounts: number;
    orders: number;
    custom_share_pct: number;
  }>;
}

export interface AttributionLeadSourceRow {
  lead_source: string;
  program_spend: number;
  campaign_notes: string;
  first_touch_orders: number;
  first_touch_revenue: number;
  first_touch_roas: number;
  last_touch_orders: number;
  last_touch_revenue: number;
  last_touch_roas: number;
  attribution_delta_rev: number;
}

export interface AttributionResponse {
  overview: {
    total_revenue: number;
    influenced_revenue: number;
    total_orders: number;
    influenced_orders: number;
    avg_touch_to_order_days: number;
    avg_journey_days: number;
    total_program_spend: number;
    blended_roas: number;
    influenced_share_pct: number;
  };
  byLeadSource: AttributionLeadSourceRow[];
  bySalesChannel: Array<{
    channel: string;
    orders: number;
    revenue: number;
    influenced_revenue: number;
    influenced_share_pct: number;
  }>;
  quarterlyAttributionTrend: Array<{
    fiscal_quarter: string;
    program_spend: number;
    influenced_revenue: number;
    total_revenue: number;
    blended_roas: number;
  }>;
}

export type HealthStatus = 'Healthy' | 'Under-Buying' | 'Quiet';

export interface AccountHealthRow {
  account_id: string;
  account_name: string;
  account_type: string;
  org_territory: string;
  health_status: HealthStatus;
  days_since_last_order: number;
  segment_quiet_threshold_days: number;
  last_order_date: string;
  total_orders: number;
  lifetime_revenue: number;
  trailing_quarterly_avg: number;
  segment_benchmark_quarterly_rev: number;
  benchmark_ratio: number;
  trailing_180d_revenue: number;
  prior_180d_revenue: number;
  annualized_gap_value: number;
  recommended_action: string;
  first_touch_source: string;
}

export interface SegmentBenchmarkRow {
  account_type: string;
  total_accounts: number;
  quiet_count: number;
  under_buying_count: number;
  healthy_count: number;
  segment_benchmark_quarterly_rev: number;
  quiet_threshold_days: number;
  actual_avg_quarterly_rev: number;
  segment_at_risk_arr: number;
}

export interface AccountHealthResponse {
  kpis: {
    total_accounts: number;
    quiet_count: number;
    under_buying_count: number;
    healthy_count: number;
    annualized_revenue_at_risk: number;
    avg_days_since_order: number;
  };
  segmentBenchmarks: SegmentBenchmarkRow[];
  accounts: AccountHealthRow[];
}

export interface AccountDetailResponse {
  account: AccountHealthRow & {
    first_order_date: string;
    catalog_revenue: number;
    custom_revenue: number;
    latest_qtr_revenue: number;
    trailing_180d_orders: number;
  };
  orders: Array<{
    order_id: string;
    order_date: string;
    fiscal_quarter: string;
    product_line: string;
    sku: string;
    order_category: 'Catalog' | 'Custom';
    units: number;
    revenue: number;
    channel: string;
    last_touch_source: string;
    last_touch_date: string | null;
    touch_to_order_days: number | null;
    buyer_type: 'New' | 'Repeat';
    is_marketing_influenced: number;
  }>;
  quarterlyTrend: Array<{
    fiscal_quarter: string;
    revenue: number;
    orders: number;
  }>;
  productMix: Array<{
    product_line: string;
    order_category: 'Catalog' | 'Custom';
    orders: number;
    revenue: number;
  }>;
}

export interface TextToSqlResult {
  question: string;
  sql: string;
  explanation: string;
  answerSummary: string;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionMs: number;
}

export interface SqlModelArtifact {
  name: string;
  layer: 'Staging' | 'Dimension' | 'Marts';
  sql: string;
}
