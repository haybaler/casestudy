-- Marts Layer: Order attribution, quarterly product revenue, first-vs-last touch comparison, and account health

DROP TABLE IF EXISTS mart_order_attribution;
CREATE TABLE mart_order_attribution AS
WITH sequenced_orders AS (
  SELECT
    s.*,
    ROW_NUMBER() OVER (PARTITION BY s.account_id ORDER BY s.order_date, s.order_id) AS account_order_seq
  FROM stg_orders s
)
SELECT
  o.order_id,
  o.order_date,
  o.fiscal_quarter,
  o.fiscal_year,
  o.account_id,
  d.account_name,
  d.account_type,
  d.org_territory,
  o.product_line,
  o.sku,
  o.order_category,
  o.units,
  o.revenue,
  o.channel,
  o.account_order_seq,
  CASE
    WHEN o.fiscal_quarter = d.first_order_quarter THEN 'New'
    ELSE 'Repeat'
  END AS buyer_type,
  d.first_touch_date,
  d.first_touch_source,
  o.last_touch_date,
  o.last_touch_source,
  o.touch_to_order_days,
  o.journey_length_days,
  o.is_marketing_influenced
FROM sequenced_orders o
JOIN dim_account d ON o.account_id = d.account_id;

DROP TABLE IF EXISTS mart_quarterly_product_revenue;
CREATE TABLE mart_quarterly_product_revenue AS
SELECT
  fiscal_quarter,
  product_line,
  order_category,
  account_type,
  org_territory,
  buyer_type,
  COUNT(*) AS order_count,
  SUM(units) AS total_units,
  SUM(revenue) AS total_revenue,
  COUNT(DISTINCT account_id) AS buying_accounts
FROM mart_order_attribution
GROUP BY
  fiscal_quarter,
  product_line,
  order_category,
  account_type,
  org_territory,
  buyer_type;

DROP TABLE IF EXISTS mart_attribution_comparison;
CREATE TABLE mart_attribution_comparison AS
WITH spend_by_source AS (
  SELECT
    fiscal_quarter,
    lead_source,
    SUM(program_spend) AS program_spend,
    MAX(campaign_notes) AS campaign_notes
  FROM stg_marketing_spend
  GROUP BY fiscal_quarter, lead_source
),
first_touch_agg AS (
  SELECT
    fiscal_quarter,
    first_touch_source AS lead_source,
    COUNT(*) AS first_touch_orders,
    SUM(revenue) AS first_touch_revenue
  FROM mart_order_attribution
  WHERE is_marketing_influenced = 1
  GROUP BY fiscal_quarter, first_touch_source
),
last_touch_agg AS (
  SELECT
    fiscal_quarter,
    last_touch_source AS lead_source,
    COUNT(*) AS last_touch_orders,
    SUM(revenue) AS last_touch_revenue
  FROM mart_order_attribution
  WHERE is_marketing_influenced = 1
  GROUP BY fiscal_quarter, last_touch_source
)
SELECT
  sp.fiscal_quarter,
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
FROM spend_by_source sp
LEFT JOIN first_touch_agg ft
  ON sp.fiscal_quarter = ft.fiscal_quarter AND sp.lead_source = ft.lead_source
LEFT JOIN last_touch_agg lt
  ON sp.fiscal_quarter = lt.fiscal_quarter AND sp.lead_source = lt.lead_source;

DROP TABLE IF EXISTS mart_account_health;
CREATE TABLE mart_account_health AS
WITH period_spend AS (
  SELECT
    account_id,
    SUM(CASE WHEN order_date >= '2026-04-01' THEN revenue ELSE 0 END) AS trailing_180d_revenue,
    SUM(CASE WHEN order_date >= '2025-10-01' AND order_date < '2026-04-01' THEN revenue ELSE 0 END) AS prior_180d_revenue,
    SUM(CASE WHEN order_date >= '2026-07-01' THEN revenue ELSE 0 END) AS latest_qtr_revenue,
    COUNT(CASE WHEN order_date >= '2026-04-01' THEN 1 END) AS trailing_180d_orders
  FROM mart_order_attribution
  GROUP BY account_id
),
scored AS (
  SELECT
    d.account_id,
    d.account_name,
    d.account_type,
    d.org_territory,
    d.first_order_date,
    d.last_order_date,
    CAST(julianday('2026-10-01') - julianday(d.last_order_date) AS INTEGER) AS days_since_last_order,
    d.segment_quiet_threshold_days,
    d.total_orders,
    d.lifetime_revenue,
    d.catalog_revenue,
    d.custom_revenue,
    COALESCE(p.trailing_180d_revenue, 0) AS trailing_180d_revenue,
    COALESCE(p.prior_180d_revenue, 0) AS prior_180d_revenue,
    ROUND(COALESCE(p.trailing_180d_revenue, 0) / 2.0, 2) AS trailing_quarterly_avg,
    COALESCE(p.latest_qtr_revenue, 0) AS latest_qtr_revenue,
    COALESCE(p.trailing_180d_orders, 0) AS trailing_180d_orders,
    d.segment_benchmark_quarterly_rev,
    ROUND((COALESCE(p.trailing_180d_revenue, 0) / 2.0) / NULLIF(d.segment_benchmark_quarterly_rev, 0), 3) AS benchmark_ratio,
    d.first_touch_source
  FROM dim_account d
  LEFT JOIN period_spend p ON d.account_id = p.account_id
)
SELECT
  *,
  CASE
    WHEN days_since_last_order > segment_quiet_threshold_days THEN 'Quiet'
    WHEN benchmark_ratio < 0.62
      OR (prior_180d_revenue > 0 AND trailing_180d_revenue < prior_180d_revenue * 0.65)
    THEN 'Under-Buying'
    ELSE 'Healthy'
  END AS health_status,
  CASE
    WHEN days_since_last_order > segment_quiet_threshold_days
      THEN ROUND(MAX(prior_180d_revenue * 2.0, segment_benchmark_quarterly_rev * 4.0), 0)
    WHEN benchmark_ratio < 0.62
      THEN ROUND((segment_benchmark_quarterly_rev - trailing_quarterly_avg) * 4.0, 0)
    ELSE 0
  END AS annualized_gap_value,
  CASE
    WHEN days_since_last_order > segment_quiet_threshold_days
      THEN 'Executive outreach + reagent supply audit'
    WHEN benchmark_ratio < 0.62
      THEN 'Custom assay / resin expansion QBR'
    ELSE 'Maintain automated reorder cadence'
  END AS recommended_action
FROM scored;
