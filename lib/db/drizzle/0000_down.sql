-- Rollback: 0000_calm_rumiko_fujikawa.sql
-- Reverses: all initial tables, foreign keys, and ENUM types.
-- Drop order respects FK dependencies (most dependent first).

-- ── ISR leaf tables (depend on isr_rfq_responses, isr_rfqs, isr_deals) ──────────
DROP TABLE IF EXISTS "isr_quote_lines";
DROP TABLE IF EXISTS "isr_rfq_responses";
DROP TABLE IF EXISTS "isr_email_inbox";
DROP TABLE IF EXISTS "isr_rfqs";
DROP TABLE IF EXISTS "isr_reminders";
DROP TABLE IF EXISTS "isr_quotes";
DROP TABLE IF EXISTS "isr_activities";
DROP TABLE IF EXISTS "isr_margin_rules";
DROP TABLE IF EXISTS "isr_distributors";
DROP TABLE IF EXISTS "isr_deals";
DROP TABLE IF EXISTS "isr_vendors";
DROP TABLE IF EXISTS "isr_customers";

-- ── TPRM (responses depend on links) ────────────────────────────────────────────
DROP TABLE IF EXISTS "tprm_questionnaire_responses";
DROP TABLE IF EXISTS "tprm_questionnaire_links";

-- ── Assessments chain (answers and reports depend on assessments) ────────────────
DROP TABLE IF EXISTS "assessment_answers";
DROP TABLE IF EXISTS "reports";
DROP TABLE IF EXISTS "assessments";

-- ── Conversation chain (messages depend on conversations) ───────────────────────
DROP TABLE IF EXISTS "messages";
DROP TABLE IF EXISTS "conversations";

-- ── Tenant chain (tenant_users depends on tenants) ──────────────────────────────
DROP TABLE IF EXISTS "tenant_users";
DROP TABLE IF EXISTS "tenants";

-- ── Independent tables ───────────────────────────────────────────────────────────
DROP TABLE IF EXISTS "integration_events";
DROP TABLE IF EXISTS "customer_integrations";
DROP TABLE IF EXISTS "scan_leads";
DROP TABLE IF EXISTS "ciso_leads";
DROP TABLE IF EXISTS "work_packages";
DROP TABLE IF EXISTS "badge_advantages";
DROP TABLE IF EXISTS "partners";
DROP TABLE IF EXISTS "email_sends";
DROP TABLE IF EXISTS "email_templates";
DROP TABLE IF EXISTS "domain_scans";
DROP TABLE IF EXISTS "questions";
DROP TABLE IF EXISTS "special_day_messages";
DROP TABLE IF EXISTS "social_media_links";
DROP TABLE IF EXISTS "newsletter_subscribers";
DROP TABLE IF EXISTS "blog_posts";
DROP TABLE IF EXISTS "white_label_partners";
DROP TABLE IF EXISTS "tech_partners";
DROP TABLE IF EXISTS "consulting_services";
DROP TABLE IF EXISTS "customers";
DROP TABLE IF EXISTS "site_settings";
DROP TABLE IF EXISTS "pricing_plans";
DROP TABLE IF EXISTS "payments";
DROP TABLE IF EXISTS "admin_users";

-- ── ENUM types ───────────────────────────────────────────────────────────────────
DROP TYPE IF EXISTS "public"."assessment_type";
DROP TYPE IF EXISTS "public"."assessment_status";
DROP TYPE IF EXISTS "public"."answer_type";
