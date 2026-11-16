-- Dimension Layer: Account master dimension with segment benchmarks, territory mapping, and acquisition lineage

DROP TABLE IF EXISTS dim_account;
CREATE TABLE dim_account AS
WITH account_order_stats AS (
  SELECT
    account_id,
    MIN(order_date) AS first_order_date,
    MAX(order_date) AS last_order_date,
    COUNT(*) AS total_orders,
    SUM(revenue) AS lifetime_revenue,
    SUM(CASE WHEN order_category = 'Catalog' THEN revenue ELSE 0 END) AS catalog_revenue,
    SUM(CASE WHEN order_category = 'Custom' THEN revenue ELSE 0 END) AS custom_revenue,
    ROUND(AVG(revenue), 2) AS avg_order_value
  FROM stg_orders
  GROUP BY account_id
),
account_quarterly_avg AS (
  SELECT
    account_id,
    account_type,
    AVG(q_rev) AS avg_active_quarter_rev
  FROM (
    SELECT
      account_id,
      account_type,
      fiscal_quarter,
      SUM(revenue) AS q_rev
    FROM stg_orders
    GROUP BY account_id, account_type, fiscal_quarter
  )
  GROUP BY account_id, account_type
),
segment_benchmarks AS (
  SELECT
    account_type,
    ROUND(AVG(avg_active_quarter_rev), 2) AS segment_benchmark_quarterly_rev,
    CASE account_type
      WHEN 'Biopharma' THEN 75
      WHEN 'CDMO' THEN 85
      WHEN 'CRO' THEN 80
      WHEN 'Clinical Lab' THEN 70
      WHEN 'OEM' THEN 90
      WHEN 'Academic' THEN 95
      ELSE 85
    END AS segment_quiet_threshold_days
  FROM account_quarterly_avg
  GROUP BY account_type
)
SELECT
  a.account_id,
  a.account_name,
  a.account_type,
  a.org_territory,
  a.first_touch_date,
  a.first_touch_source,
  s.first_order_date,
  printf(
    '%s-Q%d',
    substr(s.first_order_date, 1, 4),
    ((CAST(substr(s.first_order_date, 6, 2) AS INTEGER) - 1) / 3) + 1
  ) AS first_order_quarter,
  s.last_order_date,
  s.total_orders,
  s.lifetime_revenue,
  s.catalog_revenue,
  s.custom_revenue,
  s.avg_order_value,
  b.segment_benchmark_quarterly_rev,
  b.segment_quiet_threshold_days
FROM raw_accounts a
JOIN account_order_stats s ON a.account_id = s.account_id
JOIN segment_benchmarks b ON a.account_type = b.account_type;
