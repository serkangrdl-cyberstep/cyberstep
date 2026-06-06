-- Rollback: 0001_subscription_reminder_cols.sql
-- Reverses: ADD COLUMN reminder1d_sent_at, reminder7d_sent_at on customer_service_subscriptions

ALTER TABLE "customer_service_subscriptions" DROP COLUMN IF EXISTS "reminder1d_sent_at";
ALTER TABLE "customer_service_subscriptions" DROP COLUMN IF EXISTS "reminder7d_sent_at";
