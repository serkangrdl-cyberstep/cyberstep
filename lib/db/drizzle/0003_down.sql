-- Rollback: 0003_tech_stack_intelligence.sql
-- Reverses: report_leads, report_tech_trends, report_city_details, report_sector_details,
--           intelligence_reports, market_configs, customer_security_maturity,
--           customer_tech_stack (+ indexes)

-- 1. Tables that reference intelligence_reports (CASCADE handles child rows)
DROP TABLE IF EXISTS report_leads;
DROP TABLE IF EXISTS report_tech_trends;
DROP TABLE IF EXISTS report_city_details;
DROP TABLE IF EXISTS report_sector_details;

-- 2. intelligence_reports references market_configs
DROP TABLE IF EXISTS intelligence_reports;

-- 3. Indexes on customer_tech_stack (drop before table)
DROP INDEX IF EXISTS idx_tech_stack_sales;
DROP INDEX IF EXISTS idx_tech_stack_category;
DROP INDEX IF EXISTS idx_tech_stack_domain;

-- 4. Remaining tables
DROP TABLE IF EXISTS customer_tech_stack;
DROP TABLE IF EXISTS customer_security_maturity;
DROP TABLE IF EXISTS market_configs;
