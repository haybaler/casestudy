-- Staging Layer: Normalize raw ERP orders and CRM marketing spend into typed, quarter-aligned relations

DROP VIEW IF EXISTS stg_orders;
CREATE VIEW stg_orders AS
SELECT
  o.order_id,
  o.order_date,
  printf(
    '%s-Q%d',
    substr(o.order_date, 1, 4),
    ((CAST(substr(o.order_date, 6, 2) AS INTEGER) - 1) / 3) + 1
  ) AS fiscal_quarter,
  CAST(substr(o.order_date, 1, 4) AS INTEGER) AS fiscal_year,
  o.account_id,
  TRIM(o.account_name) AS account_name,
  o.account_type,
  o.product_line,
  UPPER(TRIM(o.sku)) AS sku,
  o.order_category,
  CASE WHEN o.order_category = 'Catalog' THEN 1 ELSE 0 END AS is_catalog,
  o.units,
  o.revenue,
  o.channel,
  o.lead_source AS last_touch_source,
  o.first_touch_date,
  o.last_touch_date,
  o.org_territory,
  CAST(julianday(o.order_date) - julianday(o.first_touch_date) AS INTEGER) AS journey_length_days,
  CASE
    WHEN o.last_touch_date IS NOT NULL
    THEN CAST(julianday(o.order_date) - julianday(o.last_touch_date) AS INTEGER)
    ELSE NULL
  END AS touch_to_order_days,
  CASE
    WHEN o.last_touch_date IS NOT NULL
      AND (julianday(o.order_date) - julianday(o.last_touch_date)) BETWEEN 0 AND 90
    THEN 1
    ELSE 0
  END AS is_marketing_influenced
FROM raw_orders o;

DROP VIEW IF EXISTS stg_marketing_spend;
CREATE VIEW stg_marketing_spend AS
SELECT
  fiscal_quarter,
  lead_source,
  program_spend,
  campaign_notes
FROM raw_marketing_spend;
